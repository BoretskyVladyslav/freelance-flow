import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { LAST_RESORT_RATES } from "@/lib/exchange-rates";
import { createServiceRoleClient, getServiceRoleKey } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  buildWidgetSummary,
  transactionFromWidgetRow,
  type WidgetSummary,
} from "@/lib/widget-summary";
import type { Transaction } from "@/types/finance";

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

function hasServiceRoleKey(): boolean {
  const configured = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return Boolean(configured) && Boolean(getServiceRoleKey());
}

function logMissingWidgetConfig(): void {
  if (!hasServiceRoleKey()) {
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

export async function GET(request: Request) {
  if (!tokensMatch(providedToken(request), expectedToken())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    logMissingWidgetConfig();
    return NextResponse.json(
      { error: "Widget data source is not configured." },
      { status: 503 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("projects").select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    const transactions = (data ?? [])
      .map((row) => transactionFromWidgetRow(row as unknown as Record<string, unknown>))
      .filter((row): row is Transaction => row !== null);
    const summary: WidgetSummary = buildWidgetSummary(transactions, LAST_RESORT_RATES, new Date());

    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build the widget summary.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
