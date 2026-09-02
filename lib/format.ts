import { BASE_CURRENCY, type Currency } from "@/types/finance";
import { isoWeekRange } from "@/lib/week";

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function normalizeIntl(value: string): string {
  return value.replace(/[\u00A0\u202F\u2009]/g, " ");
}

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
  return normalizeIntl(formatter(currency).format(amount));
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
  return normalizeIntl(
    new Intl.NumberFormat("uk-UA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(rate),
  );
}

export function formatCompactMoney(amount: number, currency: Currency): string {
  return normalizeIntl(
    new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount),
  );
}

export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function utcNoon(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ukDayUnpadded(isoDate: string): string {
  return String(Number(isoDate.slice(8, 10)));
}

function ukShortMonth(isoDate: string): string {
  const date = utcNoon(isoDate);
  if (!date) return isoDate;
  return new Intl.DateTimeFormat("uk-UA", {
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateDayMonth(isoDate: string): string {
  const date = utcNoon(isoDate);
  if (!date) return isoDate;
  return `${ukDayUnpadded(isoDate)} ${ukShortMonth(isoDate)}`;
}

export function formatWeekSpan(weekKey: string): string {
  const { start, end } = isoWeekRange(weekKey);
  const startDay = ukDayUnpadded(start);
  const endDay = ukDayUnpadded(end);
  const startMonth = ukShortMonth(start);
  const endMonth = ukShortMonth(end);
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${startDay}–${endDay} ${endMonth}`;
  }
  return `${startDay} ${startMonth}–${endDay} ${endMonth}`;
}

export function formatWeekFilterLabel(weekKey: string): string {
  return `Тиждень ${formatWeekSpan(weekKey)} ${weekKey.slice(0, 4)}`;
}

export function formatMonthFilterLabel(monthKey: string): string {
  const date = utcNoon(`${monthKey}-01`);
  if (!date) return monthKey;
  const raw = new Intl.DateTimeFormat("uk-UA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const withoutYearMark = raw.replace(/\s*р\.?\s*$/, "").trim();
  return withoutYearMark.charAt(0).toLocaleUpperCase("uk-UA") + withoutYearMark.slice(1);
}
