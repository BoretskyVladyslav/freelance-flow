import { describe, expect, it } from "vitest";
import {
  applyFxSettings,
  applyStripeSpread,
  buildMarketRates,
  composeStripeRates,
  fetchStripeAwareRates,
  parseFxSettings,
  settlementToEurFromBalance,
  stripeAutoLabel,
  stripeUahQuote,
  toEurFromPerEur,
  uahPerUnit,
} from "@/lib/exchange-rates";
import type { ExchangeRates } from "@/types/finance";

const market: ExchangeRates = {
  base: "EUR",
  fetchedAt: "2026-10-14T00:00:00.000Z",
  toEur: { EUR: 1, USD: 0.92, UAH: 0.022, PLN: 0.23 },
};

describe("Stripe FX engine", () => {
  it("adds Stripe's 4% conversion fee on the NBU mid-market euro quote", () => {
    const nbu = {
      ...market,
      toEur: { ...market.toEur, UAH: toEurFromPerEur(50.0045) },
    };
    const adjusted = applyStripeSpread(nbu, 4);

    expect(stripeUahQuote(50.0045, 4)).toBe(52.0047);
    expect(stripeAutoLabel(4)).toBe("Stripe Auto (includes 4% conversion fee)");
    expect(adjusted.toEur.EUR).toBe(1);
    expect(adjusted.toEur.USD).toBe(0.88461538);
    expect(Number(uahPerUnit("EUR", adjusted).toFixed(4))).toBe(52.0047);
    expect(adjusted.toEur.UAH).toBe(toEurFromPerEur(52.0047));
  });

  it("stores a manual Stripe invoice rate without applying the fee again", () => {
    const auto = applyStripeSpread(market, 4);
    const manual = applyFxSettings(auto, {
      mode: "manual",
      spreadPercent: 4,
      eurUah: 52.0047,
      usdEur: 0.851234567,
    });

    expect(manual.toEur.EUR).toBe(1);
    expect(manual.toEur.USD).toBe(0.85123457);
    expect(manual.toEur.UAH).toBe(toEurFromPerEur(52.0047));
    expect(manual.source).toBe("manual");
    expect(manual.stale).toBe(false);
  });

  it("prefers a settled Stripe balance rate over the spread estimate", () => {
    const composed = composeStripeRates({
      market,
      spreadPercent: 4,
      publishedBases: { USD: 0.92 },
      settled: { USD: 0.85111111 },
    });

    expect(composed.toEur.USD).toBe(0.85111111);
    expect(composed.toEur.UAH).toBe(applyStripeSpread(market, 4).toEur.UAH);
    expect(composed.source).toBe("stripe_settlement");
  });

  it("reads the newest EUR settlement from Stripe balance transactions", () => {
    const settled = settlementToEurFromBalance({
      data: [
        {
          currency: "eur",
          exchange_rate: 0.84,
          source: { currency: "usd" },
        },
        {
          currency: "eur",
          exchange_rate: 0.9,
          source: { currency: "usd" },
        },
        {
          currency: "usd",
          exchange_rate: 1.1,
          source: { currency: "uah" },
        },
      ],
    });

    expect(settled.USD).toBe(0.84);
    expect(settled.UAH).toBeUndefined();
  });

  it("builds an NBU euro quote and an ECB dollar quote", () => {
    const built = buildMarketRates({
      frankfurter: { date: "2026-10-13", rates: { USD: 1.08, PLN: 4.25 } },
      nbu: [
        { cc: "EUR", rate: 50.0045 },
        { cc: "USD", rate: 42.1 },
      ],
      now: "2026-10-14T00:00:00.000Z",
    });

    expect(built?.toEur.USD).toBe(toEurFromPerEur(1.08));
    expect(built?.toEur.UAH).toBe(toEurFromPerEur(50.0045));
    expect(built?.stale).toBe(false);
  });

  it("falls back when every live source fails", async () => {
    const rates = await fetchStripeAwareRates({
      fetchImpl: async () => {
        throw new Error("offline");
      },
      now: "2026-10-14T00:00:00.000Z",
    });

    expect(rates.stale).toBe(true);
    expect(rates.toEur.EUR).toBe(1);
    expect(rates.toEur.USD).toBe(0.88461538);
  });

  it("ignores a swapped manual pair", () => {
    expect(parseFxSettings({ mode: "manual", eurUah: 0.85, usdEur: 49.2 })).toEqual({
      mode: "manual",
      spreadPercent: 4,
      eurUah: undefined,
      usdEur: undefined,
    });
  });
});
