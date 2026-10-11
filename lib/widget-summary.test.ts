import { describe, expect, it } from "vitest";
import { LAST_RESORT_RATES } from "@/lib/exchange-rates";
import { buildWidgetSummary, transactionFromWidgetRow } from "@/lib/widget-summary";
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
    ...patch,
  };
}

describe("buildWidgetSummary", () => {
  it("sums the current month and counts pending or in-progress projects", () => {
    const summary = buildWidgetSummary(
      [
        project({
          id: "pending",
          status: "Pending",
          date: "2026-10-02",
          tax_model: "fop_3",
          gross_uah: 4500,
          net_uah: 2550,
        }),
        project({
          id: "paid",
          status: "Paid",
          date: "2026-10-05",
          tax_model: "fop_3",
          gross_uah: 1000,
          net_uah: 600,
        }),
        project({
          id: "old",
          status: "In Progress",
          date: "2026-08-01",
          gross_uah: 99999,
          net_uah: 99999,
        }),
      ],
      LAST_RESORT_RATES,
      now,
    );

    expect(summary.updatedAt).toBe("2026-10-11T20:00:00.000Z");
    expect(summary.grossUah).toBe(5500);
    expect(summary.netUah).toBe(3150);
    expect(summary.netEur).toBe(131.6);
    expect(summary.activeProjects).toBe(1);
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
