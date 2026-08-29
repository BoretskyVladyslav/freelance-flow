import Decimal from "decimal.js";
import { monthKeyFromIsoDate, weekKeyFromIsoDate } from "@/lib/week";
import {
  calculateTransaction,
  convertToDisplay,
  moneyNumber,
} from "@/lib/tax-calculator";
import type {
  Currency,
  ExchangeRates,
  LedgerFilters,
  TaxBreakdown,
  Transaction,
} from "@/types/finance";

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
    if (filters.month !== "all" && monthKeyFromIsoDate(transaction.date) !== filters.month) {
      return false;
    }
    if (filters.week !== "all" && weekKeyFromIsoDate(transaction.date) !== filters.week) {
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
): DashboardTotals {
  return {
    grossInBase: convertToDisplay(totals.grossInBase, displayCurrency, rates),
    spainTax: convertToDisplay(totals.spainTax, displayCurrency, rates),
    companyTax: convertToDisplay(totals.companyTax, displayCurrency, rates),
    netPayout: convertToDisplay(totals.netPayout, displayCurrency, rates),
    remainingToBePaid: convertToDisplay(totals.remainingToBePaid, displayCurrency, rates),
    currencyGainLoss: convertToDisplay(totals.currencyGainLoss, displayCurrency, rates),
  };
}

export function weeklySeries(
  transactions: TransactionView[],
  displayCurrency: Currency,
  rates: ExchangeRates | null,
): WeeklyPoint[] {
  const grouped = new Map<string, { gross: Decimal; net: Decimal }>();

  for (const transaction of transactions) {
    const weekKey = weekKeyFromIsoDate(transaction.date);
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
      label: weekKey.replace("-W", " W"),
      gross: convertToDisplay(moneyNumber(values.gross), displayCurrency, rates),
      net: convertToDisplay(moneyNumber(values.net), displayCurrency, rates),
    }));
}
