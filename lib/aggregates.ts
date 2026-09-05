import Decimal from "decimal.js";
import { monthKeyFromIsoDate, weekKeyFromIsoDate } from "@/lib/week";
import { formatWeekSpan } from "@/lib/format";
import {
  calculateTransaction,
  convertToDisplay,
  displayCurrencyGainLoss,
  moneyNumber,
} from "@/lib/tax-calculator";
import {
  getTransactionStartDate,
  type Currency,
  type ExchangeRates,
  type LedgerFilters,
  type TaxBreakdown,
  type Transaction,
} from "@/types/finance";

export type ChartPeriod = "3d" | "week" | "month";

export type ChartPoint = {
  key: string;
  label: string;
  gross: number;
  net: number;
};

export type TransactionView = Transaction & {
  breakdown: TaxBreakdown;
};

export type DashboardTotals = {
  grossInBase: number;
  spainTax: number;
  companyTax: number;
  netPayout: number;
  remainingToBePaid: number;
  currencyGainLoss: number;
  expenses?: number;
  trueNet?: number;
};

export type WeeklyPoint = {
  weekKey: string;
  label: string;
  gross: number;
  net: number;
};

export function withBreakdowns(
  transactions: Transaction[],
  rates: ExchangeRates | null,
): TransactionView[] {
  return transactions.map((transaction) => ({
    ...transaction,
    breakdown: calculateTransaction(transaction, rates?.toEur[transaction.currency]),
  }));
}

export function applyFilters(
  transactions: TransactionView[],
  filters: LedgerFilters,
): TransactionView[] {
  return transactions.filter((transaction) => {
    if (filters.platform !== "all" && transaction.platform !== filters.platform) {
      return false;
    }
    if (filters.status !== "all" && transaction.status !== filters.status) {
      return false;
    }
    const startDate = getTransactionStartDate(transaction);
    if (filters.month !== "all" && monthKeyFromIsoDate(startDate) !== filters.month) {
      return false;
    }
    if (filters.week !== "all" && weekKeyFromIsoDate(startDate) !== filters.week) {
      return false;
    }
    return true;
  });
}

export function summarize(transactions: TransactionView[]): DashboardTotals {
  const totals = transactions.reduce(
    (acc, transaction) => {
      acc.grossInBase = acc.grossInBase.plus(transaction.breakdown.grossInBase);
      acc.spainTax = acc.spainTax.plus(transaction.breakdown.spainTax);
      acc.companyTax = acc.companyTax.plus(transaction.breakdown.companyTax);
      acc.netPayout = acc.netPayout.plus(transaction.breakdown.netPayout);
      acc.currencyGainLoss = acc.currencyGainLoss.plus(
        transaction.breakdown.currencyGainLoss,
      );
      if (transaction.status !== "Paid") {
        acc.remainingToBePaid = acc.remainingToBePaid.plus(transaction.breakdown.netPayout);
      }
      return acc;
    },
    {
      grossInBase: new Decimal(0),
      spainTax: new Decimal(0),
      companyTax: new Decimal(0),
      netPayout: new Decimal(0),
      remainingToBePaid: new Decimal(0),
      currencyGainLoss: new Decimal(0),
    },
  );

  return {
    grossInBase: moneyNumber(totals.grossInBase),
    spainTax: moneyNumber(totals.spainTax),
    companyTax: moneyNumber(totals.companyTax),
    netPayout: moneyNumber(totals.netPayout),
    remainingToBePaid: moneyNumber(totals.remainingToBePaid),
    currencyGainLoss: moneyNumber(totals.currencyGainLoss),
  };
}

export function toDisplayTotals(
  totals: DashboardTotals,
  displayCurrency: Currency,
  rates: ExchangeRates | null,
  views: TransactionView[],
): DashboardTotals {
  const currencyGainLoss = moneyNumber(
    views.reduce(
      (acc, transaction) =>
        acc.plus(
          displayCurrencyGainLoss(
            transaction.currency,
            transaction.breakdown.currencyGainLoss,
            displayCurrency,
            rates,
          ),
        ),
      new Decimal(0),
    ),
  );

  return {
    grossInBase: convertToDisplay(totals.grossInBase, displayCurrency, rates),
    spainTax: convertToDisplay(totals.spainTax, displayCurrency, rates),
    companyTax: convertToDisplay(totals.companyTax, displayCurrency, rates),
    netPayout: convertToDisplay(totals.netPayout, displayCurrency, rates),
    remainingToBePaid: convertToDisplay(totals.remainingToBePaid, displayCurrency, rates),
    currencyGainLoss,
  };
}

export function weeklySeries(
  transactions: TransactionView[],
  displayCurrency: Currency,
  rates: ExchangeRates | null,
): WeeklyPoint[] {
  const grouped = new Map<string, { gross: Decimal; net: Decimal }>();

  for (const transaction of transactions) {
    const weekKey = weekKeyFromIsoDate(getTransactionStartDate(transaction));
    const current = grouped.get(weekKey) ?? { gross: new Decimal(0), net: new Decimal(0) };
    grouped.set(weekKey, {
      gross: current.gross.plus(transaction.breakdown.grossInBase),
      net: current.net.plus(transaction.breakdown.netPayout),
    });
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, values]) => ({
      weekKey,
      label: formatWeekSpan(weekKey),
      gross: convertToDisplay(moneyNumber(values.gross), displayCurrency, rates),
      net: convertToDisplay(moneyNumber(values.net), displayCurrency, rates),
    }));
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodKey(transaction: TransactionView, period: ChartPeriod): string {
  const date = getTransactionStartDate(transaction);
  if (period === "3d") return date.slice(0, 10);
  if (period === "month") return monthKeyFromIsoDate(date);
  return weekKeyFromIsoDate(date);
}

function periodLabel(key: string, period: ChartPeriod): string {
  if (period === "3d") {
    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${key}T12:00:00.000Z`));
  }
  if (period === "month") {
    return new Intl.DateTimeFormat("uk-UA", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${key}-01T12:00:00.000Z`));
  }
  return formatWeekSpan(key);
}

export function chartSeries(
  transactions: TransactionView[],
  displayCurrency: Currency,
  rates: ExchangeRates | null,
  period: ChartPeriod,
  now = new Date(),
): ChartPoint[] {
  const grouped = new Map<string, { gross: Decimal; net: Decimal }>();
  const allowedDays =
    period === "3d"
      ? Array.from({ length: 3 }, (_, index) => {
          const date = new Date(now);
          date.setHours(12, 0, 0, 0);
          date.setDate(date.getDate() - (2 - index));
          return localDateKey(date);
        })
      : null;

  if (allowedDays) {
    for (const key of allowedDays) {
      grouped.set(key, { gross: new Decimal(0), net: new Decimal(0) });
    }
  }

  for (const transaction of transactions) {
    const key = periodKey(transaction, period);
    if (allowedDays && !allowedDays.includes(key)) continue;
    const current = grouped.get(key) ?? { gross: new Decimal(0), net: new Decimal(0) };
    grouped.set(key, {
      gross: current.gross.plus(transaction.breakdown.grossInBase),
      net: current.net.plus(transaction.breakdown.netPayout),
    });
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => ({
      key,
      label: periodLabel(key, period),
      gross: convertToDisplay(moneyNumber(values.gross), displayCurrency, rates),
      net: convertToDisplay(moneyNumber(values.net), displayCurrency, rates),
    }));
}
