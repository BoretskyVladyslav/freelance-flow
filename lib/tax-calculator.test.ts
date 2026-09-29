import { describe, expect, it } from "vitest";
import { calculateFinancialBreakdown } from "@/lib/finance";
import { normalizeEurRates, uahPerUnit } from "@/lib/exchange-rates";
import {
  calculateProjectTaxes,
  calculateTaxSequence,
  calculateTransaction,
  convertFromEur,
  convertOriginalToUah,
  convertToDisplay,
  displayCurrencyGainLoss,
  eurAmountToLockedUah,
  moneyNumber,
  MONTHLY_ESV_UAH,
  monthlyEsvDisplayAmount,
  netAfterMonthlyEsv,
  resolveUahSnapshot,
  shouldApplyMonthlyEsv,
} from "@/lib/tax-calculator";
import { formatLedgerTaxTooltip } from "@/lib/format";

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

  it("applies FOP 30% fee first, then 6% tax on the remainder", () => {
    const result = calculateTaxSequence({
      grossAmount: 1000,
      customFee: 50,
      exchangeRate: 0.9,
      taxModel: "fop_3",
    });

    expect(result).toEqual({
      grossInBase: 900,
      feeInBase: 45,
      taxableBase: 855,
      spainTax: 35.91,
      postSpainBase: 598.5,
      companyTax: 256.5,
      netPayout: 562.59,
    });
  });

  it("keeps Spain 19% figures when taxModel is omitted or spain_19", () => {
    const omitted = calculateTaxSequence({
      grossAmount: 200,
      customFee: 0,
      exchangeRate: 1,
    });
    const explicit = calculateTaxSequence({
      grossAmount: 200,
      customFee: 0,
      exchangeRate: 1,
      taxModel: "spain_19",
    });

    expect(omitted).toEqual(explicit);
    expect(omitted.spainTax).toBe(38);
    expect(omitted.companyTax).toBe(48.6);
    expect(omitted.netPayout).toBe(113.4);
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

  it("does not change historical Spain nets when tax_model is missing", () => {
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
    expect(result.spainTax).toBe(162.45);
  });
});

describe("calculateProjectTaxes", () => {
  it("returns Spain 19% then 30% company fee by default", () => {
    expect(calculateProjectTaxes(1000)).toEqual({
      taxes: 190,
      companyFee: 243,
      net: 567,
      taxLabel: "Іспанія (19%)",
    });
  });

  it("returns FOP 30% fee first, then 6% tax on the remainder", () => {
    expect(calculateProjectTaxes(1000, "fop_3")).toEqual({
      taxes: 42,
      companyFee: 300,
      net: 658,
      taxLabel: "ФОП 3 гр. (6%)",
    });
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

describe("UAH snapshot and monthly ESV", () => {
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

  it("converts original FX amounts to UAH without rounding the rate to 2 decimals", () => {
    expect(convertOriginalToUah(102.4, "USD", rates)).toBe(4282.18);
    expect(convertOriginalToUah(1000, "UAH", rates)).toBe(1000);
  });

  it("locks gross_uah and net_uah from the creation rate", () => {
    const snapshot = resolveUahSnapshot({
      grossAmount: 1000,
      currency: "USD",
      netPayoutEur: 547.2,
      exchangeRateAtCreation: 0.9,
      rates,
    });
    expect(snapshot.uahRateAtCreation).toBeCloseTo(0.9 / 0.022, 8);
    expect(snapshot.gross_uah).toBe(40909.09);
    expect(snapshot.net_uah).toBe(24872.73);
  });

  it("subtracts the fixed monthly ESV from month-filtered net", () => {
    expect(MONTHLY_ESV_UAH).toBe(1760);
    expect(shouldApplyMonthlyEsv({ month: "2026-09" })).toBe(true);
    expect(shouldApplyMonthlyEsv({ month: "all" })).toBe(false);
    expect(monthlyEsvDisplayAmount("UAH", rates)).toBe(1760);
    expect(netAfterMonthlyEsv(5000, "UAH", rates)).toBe(3240);
  });
});

describe("calculateFinancialBreakdown", () => {
  const input = {
    gross: 1000,
    platformFee: 50,
    currency: "USD" as const,
    exchangeRate: 0.9,
    taxModel: "fop_3" as const,
  };

  it("matches calculateTransaction historical figures for the same modal and ledger inputs", () => {
    const modal = calculateFinancialBreakdown(input);
    const ledger = calculateTransaction(
      {
        grossAmount: input.gross,
        customFee: input.platformFee,
        currency: input.currency,
        exchangeRateAtCreation: input.exchangeRate,
        tax_model: input.taxModel,
      },
      0.95,
    );

    expect(modal).toEqual({
      grossInBase: 900,
      feeInBase: 45,
      taxableBase: 855,
      spainTax: 35.91,
      postSpainBase: 598.5,
      companyTax: 256.5,
      netPayout: 562.59,
    });
    expect(ledger.grossInBase).toBe(modal.grossInBase);
    expect(ledger.feeInBase).toBe(modal.feeInBase);
    expect(ledger.taxableBase).toBe(modal.taxableBase);
    expect(ledger.spainTax).toBe(modal.spainTax);
    expect(ledger.companyTax).toBe(modal.companyTax);
    expect(ledger.netPayout).toBe(modal.netPayout);
  });

  it("uses FOP math for post-cutover ledger rows even when tax_model is missing", () => {
    const modal = calculateFinancialBreakdown(input);
    const ledger = calculateTransaction({
      grossAmount: input.gross,
      customFee: input.platformFee,
      currency: input.currency,
      exchangeRateAtCreation: input.exchangeRate,
      date: "2026-09-15",
      startDate: "2026-09-15",
    });

    expect(ledger.spainTax).toBe(modal.spainTax);
    expect(ledger.companyTax).toBe(modal.companyTax);
    expect(ledger.netPayout).toBe(modal.netPayout);
  });

  it("matches the UAH cascading example to the kopeck", () => {
    const result = calculateFinancialBreakdown({
      gross: 13450.46,
      platformFee: 0,
      currency: "UAH",
      exchangeRate: 1,
      taxModel: "fop_3",
    });

    expect(result.companyTax).toBe(4035.14);
    expect(result.postSpainBase).toBe(9415.32);
    expect(result.spainTax).toBe(564.92);
    expect(result.netPayout).toBe(8850.4);
    expect(formatLedgerTaxTooltip("fop_3", result.spainTax, result.companyTax)).toBe(
      "ФОП (5% + 1%): 564,92 грн | Фірма (30%): 4 035,14 грн",
    );
  });

  it("keeps Spain 19% for pre-cutover rows without a stored model", () => {
    const spain = calculateFinancialBreakdown({ ...input, taxModel: "spain_19" });
    const ledger = calculateTransaction({
      grossAmount: input.gross,
      customFee: input.platformFee,
      currency: input.currency,
      exchangeRateAtCreation: input.exchangeRate,
      date: "2026-08-15",
      startDate: "2026-08-15",
    });

    expect(ledger.spainTax).toBe(spain.spainTax);
    expect(ledger.companyTax).toBe(spain.companyTax);
    expect(ledger.netPayout).toBe(spain.netPayout);
  });
});

describe("formatLedgerTaxTooltip", () => {
  it("labels FOP and Spain tooltips in locked UAH", () => {
    expect(formatLedgerTaxTooltip("fop_3", 2331.82, 11659.09)).toBe(
      "ФОП (5% + 1%): 2 331,82 грн | Фірма (30%): 11 659,09 грн",
    );
    expect(formatLedgerTaxTooltip("spain_19", 7384.09, 9443.18)).toBe(
      "Іспанія (19%): 7 384,09 грн | Фірма (30%): 9 443,18 грн",
    );
  });
});

describe("eurAmountToLockedUah", () => {
  const rates = {
    base: "EUR" as const,
    fetchedAt: "2026-09-02T00:00:00.000Z",
    toEur: {
      EUR: 1,
      USD: 0.9,
      UAH: 0.022,
      PLN: 0.23,
    },
  };

  it("converts modal and ledger EUR tax amounts with the same locked UAH rate", () => {
    const breakdown = calculateFinancialBreakdown({
      gross: 1000,
      platformFee: 50,
      currency: "USD",
      exchangeRate: 0.9,
      taxModel: "fop_3",
    });
    const taxesUah = eurAmountToLockedUah(breakdown.spainTax, {
      currency: "USD",
      exchangeRateAtCreation: 0.9,
      rates,
      uahRateAtCreation: 40.90909091,
    });
    const feeUah = eurAmountToLockedUah(breakdown.companyTax, {
      currency: "USD",
      exchangeRateAtCreation: 0.9,
      rates,
      uahRateAtCreation: 40.90909091,
    });

    expect(taxesUah).toBe(eurAmountToLockedUah(breakdown.spainTax, {
      currency: "USD",
      exchangeRateAtCreation: 0.9,
      rates,
      uahRateAtCreation: 40.90909091,
    }));
    expect(formatLedgerTaxTooltip("fop_3", taxesUah, feeUah)).toContain("ФОП (5% + 1%)");
    expect(formatLedgerTaxTooltip("fop_3", taxesUah, feeUah)).toContain("грн");
  });
});
