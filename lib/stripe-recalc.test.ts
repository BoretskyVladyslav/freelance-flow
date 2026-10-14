import { describe, expect, it } from "vitest";
import { applyStripeSpread } from "@/lib/exchange-rates";
import { isInStripeRecalcWindow, recalculateStripeWindow } from "@/lib/stripe-recalc";
import type { ExchangeRates, Transaction } from "@/types/finance";

const market: ExchangeRates = {
  base: "EUR",
  fetchedAt: "2026-10-14T00:00:00.000Z",
  toEur: { EUR: 1, USD: 0.92, UAH: 0.022, PLN: 0.23 },
};

function project(patch: Partial<Transaction> & Pick<Transaction, "id" | "date">): Transaction {
  return {
    title: patch.id,
    platform: "Direct Client",
    grossAmount: 1000,
    currency: "USD",
    customFee: 0,
    exchangeRateAtCreation: 0.92,
    status: "Paid",
    weekNumber: 32,
    ...patch,
  };
}

describe("Stripe two-month recalculation", () => {
  const rates = applyStripeSpread(market, 4);

  it("includes projects created or started from 1 August through 14 October 2026", () => {
    expect(isInStripeRecalcWindow(project({ id: "july", date: "2026-07-31" }))).toBe(false);
    expect(isInStripeRecalcWindow(project({ id: "open", date: "2026-08-01" }))).toBe(true);
    expect(isInStripeRecalcWindow(project({ id: "mid", date: "2026-08-14" }))).toBe(true);
    expect(isInStripeRecalcWindow(project({ id: "close", date: "2026-10-14" }))).toBe(true);
    expect(isInStripeRecalcWindow(project({ id: "after", date: "2026-10-15" }))).toBe(false);
    expect(
      isInStripeRecalcWindow(
        project({ id: "started-later", date: "2026-07-20", startDate: "2026-09-01" }),
      ),
    ).toBe(true);
    expect(
      isInStripeRecalcWindow(
        project({ id: "created-in-window", date: "2026-08-20", startDate: "2026-07-01" }),
      ),
    ).toBe(true);
  });

  it("rewrites locked EUR and UAH amounts inside the window and leaves older rows", () => {
    const older = project({ id: "older", date: "2026-07-15", gross_uah: 100, net_uah: 50 });
    const recent = project({ id: "recent", date: "2026-09-02", title: "September" });
    const result = recalculateStripeWindow([older, recent], rates);
    const updated = result.transactions.find((row) => row.id === "recent");

    expect(result.transactions[0]).toBe(older);
    expect(updated?.grossAmount).toBe(1000);
    expect(updated?.exchangeRateAtCreation).toBe(0.88461538);
    expect(updated?.gross_uah).not.toBeUndefined();
    expect(result.changedCount).toBe(1);
    expect(result.report[0]).toMatchObject({
      title: "September",
      currency: "USD",
      rateBefore: 0.92,
      rateAfter: 0.88461538,
      grossEurBefore: 920,
      grossEurAfter: 884.62,
    });
    expect(result.report[0]?.deltaNetEur).toBeLessThan(0);
  });
});
