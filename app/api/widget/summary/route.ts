import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { LAST_RESORT_RATES, normalizeEurRates } from "@/lib/exchange-rates";
import { isSupabaseConfigured, normalizeSupabaseUrl } from "@/lib/supabase/env";
import {
  buildWidgetSummary,
  resolveWidgetPeriod,
  transactionFromWidgetRow,
  type WidgetSummary,
} from "@/lib/widget-summary";
import type { Database } from "@/types/database";
import type { ExchangeRates, Transaction } from "@/types/finance";

export const dynamic = "force-dynamic";

const DEFAULT_WIDGET_TOKEN = "flow-widget-token-2026";

function expectedToken(): string {
  const configured = process.env.WIDGET_SECRET_KEY?.trim();
  return configured || DEFAULT_WIDGET_TOKEN;
}

function providedToken(request: Request): string {
  const query = new URL(request.url).searchParams.get("token");
  if (query) return query;
  const header = request.headers.get("x-widget-token")?.trim();
  if (header) return header;
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return "";
}

function tokensMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function serviceRoleKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length < 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      role?: unknown;
    };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function logMissingWidgetConfig(): void {
  if (!serviceRoleKey()) {
    console.error(
      "[widget/summary] SUPABASE_SERVICE_ROLE_KEY is missing. Refusing to read projects and returning 503.",
    );
  }
  if (!isSupabaseConfigured()) {
    console.error(
      "[widget/summary] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Returning 503.",
    );
  }
}

async function loadWidgetRates(): Promise<ExchangeRates> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/EUR", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return LAST_RESORT_RATES;
    return normalizeEurRates((await response.json()) as Parameters<typeof normalizeEurRates>[0]);
  } catch (error) {
    console.error(
      "[widget/summary] Live exchange rates are unavailable. Using the last-resort EUR table.",
      error instanceof Error ? error.message : "",
    );
    return LAST_RESORT_RATES;
  }
}

function createWidgetAdminClient() {
  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const key = serviceRoleKey();
  const role = jwtRole(key);
  if (role && role !== "service_role") {
    console.error(
      `[widget/summary] SUPABASE_SERVICE_ROLE_KEY is a ${role} credential. The widget query requires the service_role key.`,
    );
    return null;
  }

  return createClient<Database>(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    },
  });
}

export async function GET(request: Request) {
  if (!tokensMatch(providedToken(request), expectedToken())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !serviceRoleKey()) {
    logMissingWidgetConfig();
    return NextResponse.json(
      { error: "Widget data source is not configured." },
      { status: 503 },
    );
  }

  const supabaseAdmin = createWidgetAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Widget data source is not configured." },
      { status: 503 },
    );
  }

  try {
    const { data, error } = await supabaseAdmin.from("projects").select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    const transactions = (data ?? [])
      .map((row) => transactionFromWidgetRow(row as unknown as Record<string, unknown>))
      .filter((row): row is Transaction => row !== null);
    const period = resolveWidgetPeriod(new URL(request.url).searchParams.get("period"));
    const rates = await loadWidgetRates();
    const summary: WidgetSummary = buildWidgetSummary(transactions, rates, new Date(), period);

    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build the widget summary.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
