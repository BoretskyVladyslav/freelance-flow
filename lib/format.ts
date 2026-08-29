import { BASE_CURRENCY, type Currency } from "@/types/finance";

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatter(currency: Currency): Intl.NumberFormat {
  const cached = FORMATTERS.get(currency);
  if (cached) return cached;
  const next = new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  FORMATTERS.set(currency, next);
  return next;
}

export function formatMoney(amount: number, currency: Currency = BASE_CURRENCY): string {
  return formatter(currency).format(amount);
}

export function formatSignedMoney(
  amount: number,
  currency: Currency = BASE_CURRENCY,
): string {
  const abs = formatMoney(Math.abs(amount), currency);
  if (amount > 0) return `+${abs}`;
  if (amount < 0) return `-${abs}`;
  return abs;
}

export function formatRate(rate: number): string {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(rate);
}

export function formatCompactMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
