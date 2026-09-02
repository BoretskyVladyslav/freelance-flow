import {
  summarize,
  toDisplayTotals,
  weeklySeries,
  withBreakdowns,
  type DashboardTotals,
  type TransactionView,
  type WeeklyPoint,
} from "@/lib/aggregates";
import type { Currency, ExchangeRates, Transaction } from "@/types/finance";

export type FinancialOverview = {
  views: TransactionView[];
  totals: DashboardTotals;
  displayTotals: DashboardTotals;
  weekly: WeeklyPoint[];
};

export function buildFinancialOverview(
  transactions: Transaction[],
  rates: ExchangeRates,
  displayCurrency: Currency,
): FinancialOverview {
  const views = withBreakdowns(transactions, rates);
  const totals = summarize(views);

  return {
    views,
    totals,
    displayTotals: toDisplayTotals(totals, displayCurrency, rates, views),
    weekly: weeklySeries(views, displayCurrency, rates),
  };
}

