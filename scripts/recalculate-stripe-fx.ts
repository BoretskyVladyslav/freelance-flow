import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  applyFxSettings,
  DEFAULT_FX_SETTINGS,
  fetchStripeAwareRates,
  parseFxSettings,
} from "@/lib/exchange-rates";
import { recalculateStripeWindow, STRIPE_RECALC_FROM, STRIPE_RECALC_UNTIL } from "@/lib/stripe-recalc";
import { transactionFromWidgetRow } from "@/lib/widget-summary";
import type { Database } from "@/types/database";
import type { Transaction } from "@/types/finance";

function loadEnvFiles(): void {
  for (const name of [".env", ".env.local"]) {
    const full = path.join(process.cwd(), name);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

async function main(): Promise<void> {
  loadEnvFiles();
  const write = process.argv.includes("--write");
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) {
    console.error(
      "Supabase service role is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or use the dashboard button.",
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const settingsResult = await supabase.from("fx_settings").select("*").eq("id", "default").maybeSingle();
  const settings = settingsResult.error || !settingsResult.data
    ? DEFAULT_FX_SETTINGS
    : parseFxSettings({
        mode: settingsResult.data.mode,
        spreadPercent: Number(settingsResult.data.spread_percent),
        eurUah: settingsResult.data.eur_uah == null ? undefined : Number(settingsResult.data.eur_uah),
        usdEur: settingsResult.data.usd_eur == null ? undefined : Number(settingsResult.data.usd_eur),
      });

  const auto = await fetchStripeAwareRates({
    secretKey: process.env.STRIPE_SECRET_KEY,
    spreadPercent: settings.spreadPercent,
    cache: "fresh",
  });
  const rates = applyFxSettings(auto, settings);
  if (rates.stale && settings.mode !== "manual") {
    console.error("Refusing to recalculate: live Stripe rates are unavailable.");
    process.exitCode = 1;
    return;
  }

  const { data, error } = await supabase.from("projects").select("*");
  if (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const transactions = (data ?? [])
    .map((row) => transactionFromWidgetRow(row as unknown as Record<string, unknown>))
    .filter((row): row is Transaction => row !== null);
  const result = recalculateStripeWindow(transactions, rates);

  console.info(
    `[stripe-fx] ${write ? "Writing" : "Dry run"} ${STRIPE_RECALC_FROM} .. ${STRIPE_RECALC_UNTIL}. Inspected ${result.report.length}, adjusted ${result.changedCount}.`,
  );
  console.table(
    result.report.map((row) => ({
      title: row.title,
      currency: row.currency,
      start: row.startDate,
      rateBefore: row.rateBefore,
      rateAfter: row.rateAfter,
      grossEurBefore: row.grossEurBefore,
      grossEurAfter: row.grossEurAfter,
      netEurBefore: row.netEurBefore,
      netEurAfter: row.netEurAfter,
      deltaNetEur: row.deltaNetEur,
      grossUahBefore: row.grossUahBefore,
      grossUahAfter: row.grossUahAfter,
      netUahBefore: row.netUahBefore,
      netUahAfter: row.netUahAfter,
      deltaNetUah: row.deltaNetUah,
      adjusted: row.adjusted,
    })),
  );

  if (!write) {
    console.info("Dry run only. Re-run with --write to persist the adjusted rows.");
    return;
  }

  for (const row of result.report) {
    if (!row.adjusted) continue;
    const next = result.transactions.find((item) => item.id === row.id);
    if (!next) continue;
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        exchange_rate_at_creation: next.exchangeRateAtCreation,
        uah_rate_at_creation: next.uahRateAtCreation ?? null,
        gross_uah: next.gross_uah ?? null,
        net_uah: next.net_uah ?? null,
      })
      .eq("id", next.id);
    if (updateError) {
      console.error(`${next.id}: ${updateError.message}`);
      process.exitCode = 1;
      return;
    }
  }

  console.info(`Updated ${result.changedCount} projects. Original currency amounts were left unchanged.`);
}

const entry = (process.argv[1] ?? "").replace(/\\/g, "/");
if (entry.endsWith("scripts/recalculate-stripe-fx.ts")) {
  void main();
}
