import Decimal from "decimal.js";
import { LAST_RESORT_RATES, uahPerUnit } from "@/lib/exchange-rates";
import {
  BASE_CURRENCY,
  getTaxModel,
  type Currency,
  type ExchangeRates,
  type LedgerFilters,
  type TaxBreakdown,
  type TaxModel,
  type Transaction,
} from "@/types/finance";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 20 });

export const SPAIN_TAX_RATE = new Decimal("0.19");
export const FOP_TAX_RATE = new Decimal("0.06"); // 5% ЄП + 1% ВЗ
export const COMPANY_TAX_RATE = new Decimal("0.30");

export const SPAIN_TAX_LABEL = "Іспанія (19%)";
export const FOP_TAX_LABEL = "ФОП 3 гр. (6%)";
export const MONTHLY_ESV_UAH = 1760;

export function roundMoney(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function moneyNumber(value: Decimal.Value): number {
  return roundMoney(value).toNumber();
}

export function resolveIncomeTaxRate(taxModel?: TaxModel | null): Decimal {
  return taxModel === "fop_3" ? FOP_TAX_RATE : SPAIN_TAX_RATE;
}

export function taxModelLabel(taxModel?: TaxModel | null): string {
  return taxModel === "fop_3" ? FOP_TAX_LABEL : SPAIN_TAX_LABEL;
}

export type TaxSequenceInput = {
  grossAmount: number;
  customFee: number;
  exchangeRate: number;
  taxModel?: TaxModel;
};

export type HistoricalTaxResult = {
  grossInBase: number;
  feeInBase: number;
  taxableBase: number;
  spainTax: number;
  postSpainBase: number;
  companyTax: number;
  netPayout: number;
};

export function calculateTaxSequence(input: TaxSequenceInput): HistoricalTaxResult {
  const grossAmount = new Decimal(input.grossAmount);
  const customFee = new Decimal(input.customFee);
  const exchangeRate = new Decimal(input.exchangeRate);
  const taxRate = resolveIncomeTaxRate(input.taxModel);

  if (!grossAmount.isFinite() || grossAmount.lt(0)) {
    throw new Error("grossAmount must be a finite number >= 0.");
  }
  if (!customFee.isFinite() || customFee.lt(0)) {
    throw new Error("customFee must be a finite number >= 0.");
  }
  if (!exchangeRate.isFinite() || exchangeRate.lte(0)) {
    throw new Error("exchangeRate must be a finite number > 0.");
  }

  const grossInBase = roundMoney(grossAmount.times(exchangeRate));
  const feeInBase = roundMoney(customFee.times(exchangeRate));
  const taxableBase = roundMoney(grossInBase.minus(feeInBase));

  if (input.taxModel === "fop_3") {
    const companyTax = roundMoney(taxableBase.times(COMPANY_TAX_RATE));
    const spainTax = roundMoney(taxableBase.times(FOP_TAX_RATE));
    const afterCompany = roundMoney(taxableBase.minus(companyTax));
    const netPayout = roundMoney(afterCompany.minus(spainTax));
    const postSpainBase = roundMoney(taxableBase.minus(spainTax));
    return {
      grossInBase: grossInBase.toNumber(),
      feeInBase: feeInBase.toNumber(),
      taxableBase: taxableBase.toNumber(),
      spainTax: spainTax.toNumber(),
      postSpainBase: postSpainBase.toNumber(),
      companyTax: companyTax.toNumber(),
      netPayout: netPayout.toNumber(),
    };
  }

  const spainTax = roundMoney(taxableBase.times(taxRate));
  const postSpainBase = roundMoney(taxableBase.minus(spainTax));
  const companyTax = roundMoney(postSpainBase.times(COMPANY_TAX_RATE));
  const netPayout = roundMoney(postSpainBase.minus(companyTax));

  return {
    grossInBase: grossInBase.toNumber(),
    feeInBase: feeInBase.toNumber(),
    taxableBase: taxableBase.toNumber(),
    spainTax: spainTax.toNumber(),
    postSpainBase: postSpainBase.toNumber(),
    companyTax: companyTax.toNumber(),
    netPayout: netPayout.toNumber(),
  };
}

export type FinancialBreakdownInput = {
  gross: number;
  platformFee: number;
  currency: Currency;
  exchangeRate: number;
  taxModel: TaxModel;
};

export function calculateFinancialBreakdown(
  input: FinancialBreakdownInput,
): HistoricalTaxResult {
  return calculateTaxSequence({
    grossAmount: input.gross,
    customFee: input.platformFee,
    exchangeRate: input.exchangeRate,
    taxModel: input.taxModel,
  });
}

export function calculateProjectTaxes(
  gross: number,
  taxModel: TaxModel = "spain_19",
): { taxes: number; companyFee: number; net: number; taxLabel: string } {
  const result = calculateTaxSequence({
    grossAmount: gross,
    customFee: 0,
    exchangeRate: 1,
    taxModel,
  });
  return {
    taxes: result.spainTax,
    companyFee: result.companyTax,
    net: result.netPayout,
    taxLabel: taxModelLabel(taxModel),
  };
}

export function calculateTransaction(
  transaction: Pick<
    Transaction,
    "grossAmount" | "customFee" | "exchangeRateAtCreation" | "currency"
  > &
    Partial<Pick<Transaction, "tax_model" | "startDate" | "date">>,
  liveToEur?: number,
): TaxBreakdown {
  const taxModel = getTaxModel(transaction);
  const historical = calculateFinancialBreakdown({
    gross: transaction.grossAmount,
    platformFee: transaction.customFee,
    currency: transaction.currency,
    exchangeRate: transaction.exchangeRateAtCreation,
    taxModel,
  });

  const liveRate =
    liveToEur && Number.isFinite(liveToEur) && liveToEur > 0
      ? liveToEur
      : transaction.exchangeRateAtCreation;

  const live = calculateFinancialBreakdown({
    gross: transaction.grossAmount,
    platformFee: transaction.customFee,
    currency: transaction.currency,
    exchangeRate: liveRate,
    taxModel,
  });

  const currencyGainLoss = moneyNumber(
    new Decimal(live.netPayout).minus(historical.netPayout),
  );

  return {
    ...historical,
    currentNetPayoutAtLiveRate: live.netPayout,
    currencyGainLoss,
  };
}

export function getToEurRate(
  currency: Currency,
  rates: ExchangeRates | null | undefined,
): number {
  if (currency === BASE_CURRENCY) return 1;
  const rate = rates?.toEur[currency];
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Missing live EUR rate for ${currency}.`);
  }
  return rate;
}

export function convertFromEur(
  amountEur: number,
  displayCurrency: Currency,
  rates: ExchangeRates,
): number {
  const toEur = getToEurRate(displayCurrency, rates);
  return moneyNumber(new Decimal(amountEur).div(toEur));
}

export function convertToDisplay(
  amountEur: number,
  displayCurrency: Currency,
  rates: ExchangeRates | null | undefined,
): number {
  if (displayCurrency === BASE_CURRENCY) {
    return moneyNumber(amountEur);
  }
  if (!rates) {
    return moneyNumber(amountEur);
  }
  return convertFromEur(amountEur, displayCurrency, rates);
}

export function displayCurrencyGainLoss(
  originalCurrency: Currency,
  gainEur: number,
  displayCurrency: Currency,
  rates: ExchangeRates | null | undefined,
): number {
  if (originalCurrency === displayCurrency) return 0;
  return convertToDisplay(gainEur, displayCurrency, rates);
}

function ratesWithLockedToEur(
  currency: Currency,
  lockedToEur: number,
  rates: ExchangeRates | null | undefined,
): ExchangeRates {
  const source = rates ?? LAST_RESORT_RATES;
  return {
    ...source,
    toEur: { ...source.toEur, [currency]: lockedToEur },
  };
}

export function eurAmountToLockedUah(
  amountEur: number,
  input: {
    currency: Currency;
    exchangeRateAtCreation: number;
    rates: ExchangeRates | null | undefined;
    uahRateAtCreation?: number;
  },
): number {
  const lockedRates = ratesWithLockedToEur(
    input.currency,
    input.exchangeRateAtCreation,
    input.rates,
  );
  const original = convertToDisplay(amountEur, input.currency, lockedRates);
  return convertOriginalToUah(
    original,
    input.currency,
    lockedRates,
    input.uahRateAtCreation,
  );
}

export function convertOriginalToUah(
  amountOriginal: number,
  currency: Currency,
  rates: ExchangeRates | null | undefined,
  lockedUahPerUnit?: number,
): number {
  if (currency === "UAH") return moneyNumber(amountOriginal);
  const rate =
    lockedUahPerUnit && Number.isFinite(lockedUahPerUnit) && lockedUahPerUnit > 0
      ? lockedUahPerUnit
      : uahPerUnit(currency, rates);
  return moneyNumber(new Decimal(amountOriginal).times(rate));
}

export function resolveUahSnapshot(input: {
  grossAmount: number;
  currency: Currency;
  netPayoutEur: number;
  exchangeRateAtCreation: number;
  rates: ExchangeRates | null | undefined;
  uahRateAtCreation?: number;
}): { uahRateAtCreation: number; gross_uah: number; net_uah: number } {
  const lockedRates = ratesWithLockedToEur(
    input.currency,
    input.exchangeRateAtCreation,
    input.rates,
  );
  const uahRateAtCreation =
    input.uahRateAtCreation &&
    Number.isFinite(input.uahRateAtCreation) &&
    input.uahRateAtCreation > 0
      ? new Decimal(input.uahRateAtCreation).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toNumber()
      : new Decimal(uahPerUnit(input.currency, lockedRates))
          .toDecimalPlaces(8, Decimal.ROUND_HALF_UP)
          .toNumber();
  const netOriginal = convertToDisplay(input.netPayoutEur, input.currency, lockedRates);
  return {
    uahRateAtCreation,
    gross_uah: convertOriginalToUah(
      input.grossAmount,
      input.currency,
      lockedRates,
      uahRateAtCreation,
    ),
    net_uah: convertOriginalToUah(netOriginal, input.currency, lockedRates, uahRateAtCreation),
  };
}

export function shouldApplyMonthlyEsv(filters: Pick<LedgerFilters, "month">): boolean {
  return filters.month !== "all";
}

export function monthlyEsvDisplayAmount(
  displayCurrency: Currency,
  rates: ExchangeRates | null | undefined,
): number {
  if (displayCurrency === "UAH") return moneyNumber(MONTHLY_ESV_UAH);
  const source = rates ?? LAST_RESORT_RATES;
  const esvEur = moneyNumber(new Decimal(MONTHLY_ESV_UAH).times(getToEurRate("UAH", source)));
  return convertToDisplay(esvEur, displayCurrency, source);
}

export function netAfterMonthlyEsv(
  netDisplay: number,
  displayCurrency: Currency,
  rates: ExchangeRates | null | undefined,
): number {
  return moneyNumber(
    new Decimal(netDisplay).minus(monthlyEsvDisplayAmount(displayCurrency, rates)),
  );
}
