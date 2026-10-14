import { describe, expect, it } from "vitest";
import {
  applyFxSettings,
  applyStripeSpread,
  buildMarketRates,
  composeStripeRates,
  fetchStripeAwareRates,
  parseFxSettings,
  settlementToEurFromBalance,
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
  it("applies a -2% settlement spread and keeps EUR at 1", () => {
    const adjusted = applyStripeSpread(market, -2);

    expect(adjusted.toEur.EUR).toBe(1);
    expect(adjusted.toEur.USD).toBe(0.9016);
    expect(adjusted.toEur.UAH).toBe(0.02156);
    expect(adjusted.toEur.PLN).toBe(0.2254);
    expect(adjusted.toEur.USD).not.toBe(Number(adjusted.toEur.USD.toFixed(2)));
    expect(uahPerUnit("EUR", adjusted)).toBeCloseTo(46.38218924, 5);
  });

  it("stores a manual Stripe invoice rate without applying the spread again", () => {
    const auto = applyStripeSpread(market, -2);
    const manual = applyFxSettings(auto, {
      mode: "manual",
      spreadPercent: -2,
      eurUah: 50,
      usdEur: 0.851234567,
    });

    expect(manual.toEur.EUR).toBe(1);
    expect(manual.toEur.USD).toBe(0.85123457);
    expect(manual.toEur.UAH).toBe(0.02);
    expect(manual.source).toBe("manual");
    expect(manual.stale).toBe(false);
  });

  it("prefers a settled Stripe balance rate over the spread estimate", () => {
    const composed = composeStripeRates({
      market,
      spreadPercent: -2,
      publishedBases: { USD: 0.92 },
      settled: { USD: 0.85111111 },
    });

    expect(composed.toEur.USD).toBe(0.85111111);
    expect(composed.toEur.UAH).toBe(0.02156);
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

  it("builds a commercial EUR/UAH base and an ECB USD base", () => {
    const built = buildMarketRates({
      frankfurter: { date: "2026-10-13", rates: { USD: 1.08, PLN: 4.25 } },
      monobank: [{ currencyCodeA: 978, currencyCodeB: 980, rateBuy: 48, rateSell: 50 }],
      now: "2026-10-14T00:00:00.000Z",
    });

    expect(built?.toEur.USD).toBe(toEurFromPerEur(1.08));
    expect(built?.toEur.UAH).toBe(toEurFromPerEur(49));
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
    expect(rates.toEur.USD).toBe(0.9016);
  });

  it("ignores a swapped manual pair", () => {
    expect(parseFxSettings({ mode: "manual", eurUah: 0.85, usdEur: 49.2 })).toEqual({
      mode: "manual",
      spreadPercent: -2,
      eurUah: undefined,
      usdEur: undefined,
    });
  });
});
