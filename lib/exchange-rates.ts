import Decimal from "decimal.js";
import {
  BASE_CURRENCY,
  CURRENCIES,
  isCurrency,
  type Currency,
  type ExchangeRates,
  type FxMode,
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

/** Stripe's typical effective FX haircut versus a mid-market / commercial base. */
export const DEFAULT_STRIPE_FX_SPREAD_PERCENT = -2;

const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=EUR&to=USD,PLN";
const MONOBANK_URL = "https://api.monobank.ua/bank/currency";
const NBU_URL = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json";
const ER_API_URL = "https://open.er-api.com/v6/latest/EUR";
const MONO_EUR = 978;
const MONO_UAH = 980;

export type FxSettings = {
  mode: FxMode;
  spreadPercent: number;
  /** Hryvnia per 1 euro, the figure on a Stripe EUR balance. */
  eurUah?: number;
  /** Euros per 1 dollar (`toEur.USD`). */
  usdEur?: number;
};

export const DEFAULT_FX_SETTINGS: FxSettings = {
  mode: "stripe_auto",
  spreadPercent: DEFAULT_STRIPE_FX_SPREAD_PERCENT,
};

export function roundFxRate(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toNumber();
}

export function sanitizeSpread(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= -50 || parsed >= 50) {
    return DEFAULT_STRIPE_FX_SPREAD_PERCENT;
  }
  return new Decimal(parsed).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}

function positiveRate(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseFxSettings(value: unknown): FxSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_FX_SETTINGS };
  const row = value as Record<string, unknown>;
  const eurUah = positiveRate(row.eurUah ?? row.eur_uah);
  const usdEur = positiveRate(row.usdEur ?? row.usd_eur);
  return {
    mode: row.mode === "manual" ? "manual" : "stripe_auto",
    spreadPercent: sanitizeSpread(row.spreadPercent ?? row.spread_percent),
    eurUah: eurUah !== undefined && eurUah > 5 ? roundFxRate(eurUah) : undefined,
    usdEur: usdEur !== undefined && usdEur < 5 ? roundFxRate(usdEur) : undefined,
  };
}

export function toEurFromPerEur(perEur: number): number {
  return roundFxRate(new Decimal(1).div(perEur));
}

export function applyStripeSpread(
  rates: ExchangeRates,
  spreadPercent: number = DEFAULT_STRIPE_FX_SPREAD_PERCENT,
): ExchangeRates {
  const spread = sanitizeSpread(spreadPercent);
  const factor = new Decimal(1).plus(new Decimal(spread).div(100));
  if (factor.lte(0)) {
    throw new Error("Stripe FX spread must leave a positive rate.");
  }

  const toEur = { EUR: 1 } as Record<Currency, number>;
  for (const currency of CURRENCIES) {
    if (currency === BASE_CURRENCY) continue;
    const current = rates.toEur[currency];
    if (!Number.isFinite(current) || current <= 0) {
      throw new Error(`Missing ${currency} rate.`);
    }
    toEur[currency] = new Decimal(current).times(factor).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toNumber();
  }

  return {
    ...rates,
    toEur,
    spreadPercent: spread,
    fxMode: "stripe_auto",
    source: rates.stale ? "fallback" : "stripe_spread",
  };
}

export function overlayToEur(
  rates: ExchangeRates,
  overrides: Partial<Record<Currency, number>> | undefined,
): ExchangeRates {
  if (!overrides) return rates;
  const toEur = { ...rates.toEur, EUR: 1 as const };
  for (const currency of CURRENCIES) {
    if (currency === BASE_CURRENCY) continue;
    const next = overrides[currency];
    if (typeof next === "number" && Number.isFinite(next) && next > 0) {
      toEur[currency] = roundFxRate(next);
    }
  }
  return { ...rates, toEur };
}

function hasRate(overrides: Partial<Record<Currency, number>> | undefined): boolean {
  if (!overrides) return false;
  return CURRENCIES.some((currency) => {
    const rate = overrides[currency];
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
  });
}

export function composeStripeRates(input: {
  market: ExchangeRates;
  spreadPercent?: number;
  settled?: Partial<Record<Currency, number>>;
  quotes?: Partial<Record<Currency, number>>;
  publishedBases?: Partial<Record<Currency, number>>;
}): ExchangeRates {
  const spreadPercent = sanitizeSpread(input.spreadPercent);
  const factor = new Decimal(1).plus(new Decimal(spreadPercent).div(100));
  let rates = applyStripeSpread(input.market, spreadPercent);

  const published: Partial<Record<Currency, number>> = {};
  for (const currency of CURRENCIES) {
    if (currency === BASE_CURRENCY) continue;
    const base = input.publishedBases?.[currency];
    if (typeof base === "number" && Number.isFinite(base) && base > 0) {
      published[currency] = roundFxRate(new Decimal(base).times(factor));
    }
  }
  if (hasRate(published)) rates = overlayToEur(rates, published);
  if (hasRate(input.quotes)) rates = overlayToEur(rates, input.quotes);
  if (hasRate(input.settled)) rates = overlayToEur(rates, input.settled);

  const source = hasRate(input.settled) || hasRate(input.quotes)
    ? "stripe_settlement"
    : input.market.stale && !hasRate(published)
      ? "fallback"
      : "stripe_spread";

  return {
    ...rates,
    source,
    fxMode: "stripe_auto",
    spreadPercent,
    stale: Boolean(input.market.stale) && source === "fallback",
  };
}

export function applyFxSettings(rates: ExchangeRates, settings: FxSettings): ExchangeRates {
  const spreadPercent = sanitizeSpread(settings.spreadPercent);
  if (settings.mode !== "manual") {
    return { ...rates, fxMode: "stripe_auto", spreadPercent };
  }

  const toEur = { ...rates.toEur, EUR: 1 as const };
  let manual = false;
  if (settings.usdEur !== undefined && settings.usdEur > 0 && settings.usdEur < 5) {
    toEur.USD = roundFxRate(settings.usdEur);
    manual = true;
  }
  if (settings.eurUah !== undefined && settings.eurUah > 5) {
    toEur.UAH = roundFxRate(new Decimal(1).div(settings.eurUah));
    manual = true;
  }

  return {
    ...rates,
    toEur,
    fxMode: "manual",
    source: manual ? "manual" : rates.source,
    spreadPercent,
    stale: manual ? false : rates.stale,
  };
}

export function settlementToEurFromBalance(payload: unknown): Partial<Record<Currency, number>> {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  const found: Partial<Record<Currency, number>> = {};
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as { currency?: unknown; exchange_rate?: unknown; source?: unknown };
    if (String(row.currency ?? "").toUpperCase() !== "EUR") continue;
    const source = row.source && typeof row.source === "object"
      ? (row.source as { currency?: unknown })
      : null;
    const code = String(source?.currency ?? "").toUpperCase();
    if (!isCurrency(code) || code === BASE_CURRENCY || found[code] !== undefined) continue;
    const rate = positiveRate(row.exchange_rate);
    if (rate === undefined) continue;
    found[code] = roundFxRate(rate);
  }
  return found;
}

export function quotesToEur(payload: unknown): Partial<Record<Currency, number>> {
  if (!payload || typeof payload !== "object") return {};
  const rates = (payload as { rates?: unknown }).rates;
  if (!rates || typeof rates !== "object") return {};
  const found: Partial<Record<Currency, number>> = {};
  for (const [code, value] of Object.entries(rates as Record<string, unknown>)) {
    const currency = code.toUpperCase();
    if (!isCurrency(currency) || currency === BASE_CURRENCY) continue;
    const exchangeRate =
      value && typeof value === "object"
        ? (value as { exchange_rate?: unknown }).exchange_rate
        : value;
    const rate = positiveRate(exchangeRate);
    if (rate === undefined) continue;
    found[currency] = roundFxRate(rate);
  }
  return found;
}

export function publishedEurRate(payload: unknown): number | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const rates = (payload as { rates?: Record<string, unknown> }).rates;
  return positiveRate(rates?.eur ?? rates?.EUR);
}

function commercialUah(row: { rateCross?: unknown; rateBuy?: unknown; rateSell?: unknown }): number | undefined {
  const buy = positiveRate(row.rateBuy);
  const sell = positiveRate(row.rateSell);
  if (buy !== undefined && sell !== undefined) {
    return new Decimal(buy).plus(sell).div(2).toNumber();
  }
  return positiveRate(row.rateCross) ?? sell ?? buy;
}

export function uahPerEurFromMonobank(payload: unknown): number | undefined {
  if (!Array.isArray(payload)) return undefined;
  const row = payload.find((item) => {
    if (!item || typeof item !== "object") return false;
    const pair = item as { currencyCodeA?: unknown; currencyCodeB?: unknown };
    return pair.currencyCodeA === MONO_EUR && pair.currencyCodeB === MONO_UAH;
  }) as { rateCross?: unknown; rateBuy?: unknown; rateSell?: unknown } | undefined;
  return row ? commercialUah(row) : undefined;
}

export function uahPerUnitFromNbu(payload: unknown, code: "EUR" | "USD"): number | undefined {
  if (!Array.isArray(payload)) return undefined;
  const row = payload.find((item) => item && typeof item === "object" && (item as { cc?: unknown }).cc === code) as
    | { rate?: unknown }
    | undefined;
  return row ? positiveRate(row.rate) : undefined;
}

export function perEurFromFrankfurter(payload: unknown): {
  usdPerEur?: number;
  plnPerEur?: number;
  fetchedAt?: string;
} {
  if (!payload || typeof payload !== "object") return {};
  const row = payload as { date?: unknown; rates?: Record<string, unknown> };
  const usdPerEur = positiveRate(row.rates?.USD);
  const plnPerEur = positiveRate(row.rates?.PLN);
  const fetchedAt =
    typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
      ? new Date(`${row.date}T00:00:00.000Z`).toISOString()
      : undefined;
  return { usdPerEur, plnPerEur, fetchedAt };
}

export function buildMarketRates(input: {
  frankfurter?: unknown;
  monobank?: unknown;
  nbu?: unknown;
  erApi?: unknown;
  now?: string;
}): ExchangeRates | null {
  let base: ExchangeRates | null = null;
  if (input.erApi) {
    try {
      base = normalizeEurRates(input.erApi as ErApiResponse);
    } catch {
      base = null;
    }
  }

  const frankfurter = perEurFromFrankfurter(input.frankfurter);
  const uahPerEur = uahPerEurFromMonobank(input.monobank) ?? uahPerUnitFromNbu(input.nbu, "EUR");
  const usdLive = Boolean(frankfurter.usdPerEur) || Boolean(base);
  const uahLive = Boolean(uahPerEur) || Boolean(base);
  if (!usdLive || !uahLive) return null;

  const toEur = { ...(base?.toEur ?? LAST_RESORT_RATES.toEur), EUR: 1 as const };
  if (frankfurter.usdPerEur) toEur.USD = toEurFromPerEur(frankfurter.usdPerEur);
  if (frankfurter.plnPerEur) toEur.PLN = toEurFromPerEur(frankfurter.plnPerEur);
  if (uahPerEur) toEur.UAH = toEurFromPerEur(uahPerEur);

  return {
    base: BASE_CURRENCY,
    fetchedAt: frankfurter.fetchedAt ?? base?.fetchedAt ?? input.now ?? new Date().toISOString(),
    toEur,
    stale: false,
  };
}

async function fetchJson(
  url: string,
  init: RequestInit | undefined,
  fetchImpl: typeof fetch,
  mode: "cached" | "fresh",
): Promise<unknown | null> {
  try {
    const response = await fetchImpl(url, {
      ...init,
      cache: mode === "fresh" ? "no-store" : "force-cache",
      signal: init?.signal ?? AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
        ...(init?.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : Array.isArray(init?.headers)
            ? Object.fromEntries(init.headers)
            : (init?.headers ?? {})),
      },
      next: mode === "fresh" ? { revalidate: 0 } : { revalidate: 3600 },
    } as RequestInit);
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export async function fetchStripeAwareRates(options?: {
  secretKey?: string | null;
  spreadPercent?: number;
  fetchImpl?: typeof fetch;
  cache?: "cached" | "fresh";
  now?: string;
}): Promise<ExchangeRates> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const mode = options?.cache ?? "cached";
  const spreadPercent = sanitizeSpread(options?.spreadPercent);
  const secret = options?.secretKey?.trim() ?? "";

  const [frankfurter, monobank, nbu, erApi] = await Promise.all([
    fetchJson(FRANKFURTER_URL, undefined, fetchImpl, mode),
    fetchJson(MONOBANK_URL, undefined, fetchImpl, mode),
    fetchJson(NBU_URL, undefined, fetchImpl, mode),
    fetchJson(ER_API_URL, undefined, fetchImpl, mode),
  ]);

  const market =
    buildMarketRates({ frankfurter, monobank, nbu, erApi, now: options?.now }) ?? {
      ...LAST_RESORT_RATES,
      stale: true,
    };

  let settled: Partial<Record<Currency, number>> | undefined;
  let quotes: Partial<Record<Currency, number>> | undefined;
  let publishedBases: Partial<Record<Currency, number>> | undefined;

  if (secret) {
    const auth = { Authorization: `Bearer ${secret}` };
    const balance = await fetchJson(
      "https://api.stripe.com/v1/balance_transactions?limit=20&expand[]=data.source",
      { headers: auth },
      fetchImpl,
      mode,
    );
    settled = settlementToEurFromBalance(balance);

    const quotePayload = await fetchJson(
      "https://api.stripe.com/v1/fx_quotes",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: "to_currency=eur&from_currencies[]=usd&from_currencies[]=uah&from_currencies[]=pln&lock_duration=none",
      },
      fetchImpl,
      mode,
    );
    quotes = quotesToEur(quotePayload);

    const [usd, uah, pln] = await Promise.all([
      fetchJson("https://api.stripe.com/v1/exchange_rates/usd", { headers: auth }, fetchImpl, mode),
      fetchJson("https://api.stripe.com/v1/exchange_rates/uah", { headers: auth }, fetchImpl, mode),
      fetchJson("https://api.stripe.com/v1/exchange_rates/pln", { headers: auth }, fetchImpl, mode),
    ]);
    publishedBases = {};
    const usdRate = publishedEurRate(usd);
    const uahRate = publishedEurRate(uah);
    const plnRate = publishedEurRate(pln);
    if (usdRate) publishedBases.USD = usdRate;
    if (uahRate) publishedBases.UAH = uahRate;
    if (plnRate) publishedBases.PLN = plnRate;
  }

  return composeStripeRates({
    market,
    spreadPercent,
    settled,
    quotes,
    publishedBases,
  });
}
