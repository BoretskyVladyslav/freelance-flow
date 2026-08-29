import Decimal from "decimal.js";
import {
  BASE_CURRENCY,
  CURRENCIES,
  type Currency,
  type ExchangeRates,
} from "@/types/finance";

export const LAST_RESORT_RATES: ExchangeRates = {
  base: BASE_CURRENCY,
  fetchedAt: "1970-01-01T00:00:00.000Z",
  stale: true,
  toEur: {
    EUR: 1,
    USD: 0.92,
    UAH: 0.022,
    PLN: 0.23,
  },
};

type ErApiResponse = {
  result?: string;
  time_last_update_utc?: string;
  base_code?: string;
  rates?: Record<string, number>;
};

function invertToEur(fromEurRate: number): number {
  return new Decimal(1).div(fromEurRate).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toNumber();
}

export function normalizeEurRates(payload: ErApiResponse): ExchangeRates {
  if (payload.result !== "success") {
    throw new Error("Exchange rate API returned an unsuccessful result.");
  }
  if (payload.base_code !== BASE_CURRENCY) {
    throw new Error(`Expected ${BASE_CURRENCY} base rates.`);
  }
  const rates = payload.rates;
  if (!rates || typeof rates !== "object") {
    throw new Error("Exchange rate payload is missing rates.");
  }

  const toEur = { EUR: 1 } as Record<Currency, number>;
  for (const currency of CURRENCIES) {
    if (currency === BASE_CURRENCY) continue;
    const fromEur = rates[currency];
    if (!Number.isFinite(fromEur) || fromEur <= 0) {
      throw new Error(`Missing or invalid ${currency} rate.`);
    }
    toEur[currency] = invertToEur(fromEur);
  }

  const fetchedAt = payload.time_last_update_utc
    ? new Date(payload.time_last_update_utc).toISOString()
    : new Date().toISOString();

  return {
    base: BASE_CURRENCY,
    fetchedAt,
    toEur,
    stale: false,
  };
}

export function resolveRate(
  currency: Currency,
  rates: ExchangeRates | null | undefined,
): number {
  if (currency === BASE_CURRENCY) return 1;
  return rates?.toEur[currency] ?? LAST_RESORT_RATES.toEur[currency];
}

export function uahPerUnit(
  currency: Currency,
  rates: ExchangeRates | null | undefined,
): number {
  const source = rates ?? LAST_RESORT_RATES;
  const uahToEur =
    Number.isFinite(source.toEur.UAH) && source.toEur.UAH > 0
      ? source.toEur.UAH
      : LAST_RESORT_RATES.toEur.UAH;
  if (currency === "UAH") return 1;
  const unitToEur =
    currency === BASE_CURRENCY
      ? 1
      : source.toEur[currency] ?? LAST_RESORT_RATES.toEur[currency];
  return new Decimal(unitToEur).div(uahToEur).toNumber();
}
