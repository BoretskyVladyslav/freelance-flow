import { describe, expect, it } from "vitest";
import { normalizeEurRates, uahPerUnit } from "@/lib/exchange-rates";
import {
  calculateTaxSequence,
  calculateTransaction,
  convertFromEur,
  convertToDisplay,
  displayCurrencyGainLoss,
  moneyNumber,
} from "@/lib/tax-calculator";

describe("calculateTaxSequence", () => {
  it("rounds every mandated step to 2 decimals", () => {
    const result = calculateTaxSequence({
      grossAmount: 1000,
      customFee: 50,
      exchangeRate: 0.9,
    });

    expect(result).toEqual({
      grossInBase: 900,
      feeInBase: 45,
      taxableBase: 855,
      spainTax: 162.45,
      postSpainBase: 692.55,
      companyTax: 207.77,
      netPayout: 484.78,
    });
  });

  it("keeps EUR amounts unchanged at rate 1 with zero fees", () => {
    const result = calculateTaxSequence({
      grossAmount: 200,
      customFee: 0,
      exchangeRate: 1,
    });

    expect(result.grossInBase).toBe(200);
    expect(result.feeInBase).toBe(0);
    expect(result.taxableBase).toBe(200);
    expect(result.spainTax).toBe(38);
    expect(result.companyTax).toBe(48.6);
    expect(result.netPayout).toBe(113.4);
  });

  it("supports UAH and PLN conversion before tax", () => {
    const uah = calculateTaxSequence({
      grossAmount: 10000,
      customFee: 0,
      exchangeRate: 0.022,
    });
    const pln = calculateTaxSequence({
      grossAmount: 1000,
      customFee: 20,
      exchangeRate: 0.23,
    });

    expect(uah.grossInBase).toBe(220);
    expect(pln.grossInBase).toBe(230);
    expect(pln.feeInBase).toBe(4.6);
    expect(pln.taxableBase).toBe(225.4);
  });
});

describe("calculateTransaction", () => {
  it("locks historical net and reports live-rate gain", () => {
    const result = calculateTransaction(
      {
        grossAmount: 1000,
        customFee: 50,
        currency: "USD",
        exchangeRateAtCreation: 0.9,
      },
      0.95,
    );

    expect(result.netPayout).toBe(484.78);
    expect(result.currentNetPayoutAtLiveRate).toBe(511.71);
    expect(result.currencyGainLoss).toBe(26.93);
  });

  it("reports zero gain when live rate matches creation rate", () => {
    const result = calculateTransaction({
      grossAmount: 500,
      customFee: 0,
      currency: "EUR",
      exchangeRateAtCreation: 1,
    });

    expect(result.currencyGainLoss).toBe(0);
    expect(result.currentNetPayoutAtLiveRate).toBe(result.netPayout);
  });
});

describe("displayCurrencyGainLoss", () => {
  const rates = {
    base: "EUR" as const,
    fetchedAt: "2026-09-02T00:00:00.000Z",
    toEur: {
      EUR: 1,
      USD: 0.95,
      UAH: 0.025,
      PLN: 0.23,
    },
  };

  it("is 0.00 when original currency equals display currency (UAH viewed in UAH)", () => {
    const breakdown = calculateTransaction(
      {
        grossAmount: 10000,
        customFee: 0,
        currency: "UAH",
        exchangeRateAtCreation: 0.022,
      },
      0.025,
    );

    expect(breakdown.currencyGainLoss).not.toBe(0);
    expect(
      displayCurrencyGainLoss("UAH", breakdown.currencyGainLoss, "UAH", rates),
    ).toBe(0);
  });

  it("is 0.00 when a USD project is viewed in USD", () => {
    const breakdown = calculateTransaction(
      {
        grossAmount: 1000,
        customFee: 50,
        currency: "USD",
        exchangeRateAtCreation: 0.9,
      },
      0.95,
    );

    expect(breakdown.currencyGainLoss).toBe(26.93);
    expect(
      displayCurrencyGainLoss("USD", breakdown.currencyGainLoss, "USD", rates),
    ).toBe(0);
  });

  it("is 0.00 when an EUR project is viewed in EUR", () => {
    const breakdown = calculateTransaction({
      grossAmount: 500,
      customFee: 0,
      currency: "EUR",
      exchangeRateAtCreation: 1,
    });

    expect(
      displayCurrencyGainLoss("EUR", breakdown.currencyGainLoss, "EUR", rates),
    ).toBe(0);
  });

  it("converts a USD EUR-delta when viewed in UAH", () => {
    const breakdown = calculateTransaction(
      {
        grossAmount: 1000,
        customFee: 50,
        currency: "USD",
        exchangeRateAtCreation: 0.9,
      },
      0.95,
    );

    expect(breakdown.currencyGainLoss).toBe(26.93);
    expect(
      displayCurrencyGainLoss("USD", breakdown.currencyGainLoss, "UAH", rates),
    ).toBe(convertToDisplay(26.93, "UAH", rates));
    expect(
      displayCurrencyGainLoss("USD", breakdown.currencyGainLoss, "UAH", rates),
    ).toBe(1077.2);
  });
});

describe("exchange rate helpers", () => {
  it("inverts EUR-quoted API rates without 2-decimal rounding", () => {
    const rates = normalizeEurRates({
      result: "success",
      base_code: "EUR",
      time_last_update_utc: "Sat, 29 Aug 2026 00:00:00 +0000",
      rates: { EUR: 1, USD: 1.087, UAH: 45.12, PLN: 4.26 },
    });

    expect(rates.toEur.EUR).toBe(1);
    expect(rates.toEur.USD).toBe(0.9199632);
    expect(convertFromEur(100, "USD", rates)).toBe(108.7);
  });

  it("uses half-up rounding for display money", () => {
    expect(moneyNumber(207.765)).toBe(207.77);
    expect(moneyNumber(207.764)).toBe(207.76);
  });

  it("quotes USD and EUR against UAH without rounding the rate to 2 decimals", () => {
    const rates = {
      base: "EUR" as const,
      fetchedAt: "2026-08-29T00:00:00.000Z",
      toEur: {
        EUR: 1,
        USD: 0.92,
        UAH: 0.022,
        PLN: 0.23,
      },
    };

    expect(uahPerUnit("USD", rates)).toBeCloseTo(41.81818182, 5);
    expect(uahPerUnit("EUR", rates)).toBeCloseTo(45.45454545, 5);
    expect(uahPerUnit("UAH", rates)).toBe(1);
  });
});
