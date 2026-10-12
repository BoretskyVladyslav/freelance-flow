import { describe, expect, it } from "vitest";
import { summarize, toDisplayTotals, withBreakdowns } from "@/lib/aggregates";
import { LAST_RESORT_RATES } from "@/lib/exchange-rates";
import { buildWidgetSummary, resolveWidgetView, transactionFromWidgetRow } from "@/lib/widget-summary";
import type { Transaction } from "@/types/finance";

const now = new Date("2026-10-11T20:00:00.000Z");

function project(patch: Partial<Transaction> & Pick<Transaction, "id" | "status" | "date">): Transaction {
  return {
    title: patch.id,
    platform: "Direct Client",
    grossAmount: 100,
    currency: "EUR",
    customFee: 0,
    exchangeRateAtCreation: 1,
    startDate: patch.date,
    weekNumber: 41,
    tax_model: "fop_3",
    ...patch,
  };
}

function dashboardUah(rows: Transaction[]) {
  const views = withBreakdowns(rows, LAST_RESORT_RATES);
  const totals = summarize(views);
  const display = toDisplayTotals(totals, "UAH", LAST_RESORT_RATES);
  return { totals, display };
}

describe("buildWidgetSummary", () => {
  const rows = [
    project({
      id: "pending",
      status: "Pending",
      date: "2026-10-02",
      net_uah: 1,
      gross_uah: 1,
    }),
    project({
      id: "progress",
      status: "In Progress",
      date: "2026-10-05",
    }),
    project({
      id: "paid",
      status: "Paid",
      date: "2026-10-08",
    }),
    project({
      id: "carry",
      status: "In Progress",
      date: "2026-08-01",
      net_uah: 99999,
    }),
  ];

  it("defaults to the unpaid pipeline and ignores stored UAH snapshots", () => {
    const summary = buildWidgetSummary(rows, LAST_RESORT_RATES, now);
    const unpaid = rows.filter((row) => row.status === "In Progress" || row.status === "Pending");
    const expected = dashboardUah(unpaid);

    expect(summary.periodLabel).toBe("До виплати");
    expect(summary.netEur).toBe(expected.totals.netPayout);
    expect(summary.grossEur).toBe(expected.totals.grossInBase);
    expect(summary.netUah).toBe(expected.display.netPayout);
    expect(summary.grossUah).toBe(expected.display.grossInBase);
    expect(summary.firmFeeUah).toBe(expected.display.companyTax);
    expect(summary.taxesUah).toBe(expected.display.spainTax);
    expect(summary.netUah).not.toBe(1);
    expect(summary.activeCount).toBe(2);
    expect(summary.pendingCount).toBe(1);
    expect(summary.paidCount).toBe(0);
  });

  it("limits view=month to the current ledger month", () => {
    const summary = buildWidgetSummary(rows, LAST_RESORT_RATES, now, "month");
    const october = rows.filter((row) => row.date.startsWith("2026-10"));
    const expected = dashboardUah(october);

    expect(summary.periodLabel).toBe("Жовтень 2026");
    expect(summary.netUah).toBe(expected.display.netPayout);
    expect(summary.netEur).toBe(expected.totals.netPayout);
    expect(summary.activeCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.paidCount).toBe(1);
  });

  it("treats period=month as the month view when view is omitted", () => {
    expect(resolveWidgetView({ view: null, period: "month" })).toBe("month");
    expect(resolveWidgetView({ view: null, period: "current" })).toBe("unpaid");
    expect(resolveWidgetView({ view: "unpaid", period: "all" })).toBe("unpaid");
  });
});

describe("transactionFromWidgetRow", () => {
  it("maps a Supabase project row and drops invalid rows", () => {
    const row = transactionFromWidgetRow({
      id: "p1",
      title: "Landing",
      client_name: "Acme",
      platform: "Direct Client",
      gross_amount: 100,
      currency: "EUR",
      custom_fee: 0,
      exchange_rate_at_creation: 1,
      date: "2026-10-02",
      start_date: "2026-10-02",
      status: "Pending",
      week_number: 40,
      gross_uah: 4500,
      net_uah: 2550,
    });

    expect(row?.title).toBe("Landing");
    expect(row?.gross_uah).toBe(4500);
    expect(transactionFromWidgetRow({ id: "bad" })).toBeNull();
  });
});
