import Decimal from "decimal.js";
import { resolveRate } from "@/lib/exchange-rates";
import { calculateFinancialBreakdown, moneyNumber, resolveUahSnapshot } from "@/lib/tax-calculator";
import {
  getTaxModel,
  getTransactionStartDate,
  type ExchangeRates,
  type Transaction,
} from "@/types/finance";

/** Inclusive window for the Stripe FX correction. 1 August covers the full two-month span through 14 October 2026. */
export const STRIPE_RECALC_FROM = "2026-08-01";
export const STRIPE_RECALC_UNTIL = "2026-10-14";

export type StripeRecalcReportRow = {
  id: string;
  title: string;
  currency: string;
  startDate: string;
  rateBefore: number;
  rateAfter: number;
  grossEurBefore: number;
  grossEurAfter: number;
  netEurBefore: number;
  netEurAfter: number;
  grossUahBefore: number;
  grossUahAfter: number;
  netUahBefore: number;
  netUahAfter: number;
  deltaNetEur: number;
  deltaNetUah: number;
  adjusted: boolean;
};

function inRange(isoDate: string, from: string, until: string): boolean {
  const day = isoDate.slice(0, 10);
  return day >= from && day <= until;
}

export function isInStripeRecalcWindow(
  transaction: Pick<Transaction, "date" | "startDate">,
  from = STRIPE_RECALC_FROM,
  until = STRIPE_RECALC_UNTIL,
): boolean {
  const started = getTransactionStartDate(transaction);
  return inRange(started, from, until) || inRange(transaction.date, from, until);
}

function sameLockedAmounts(before: Transaction, after: Transaction): boolean {
  return (
    before.exchangeRateAtCreation === after.exchangeRateAtCreation &&
    before.uahRateAtCreation === after.uahRateAtCreation &&
    before.gross_uah === after.gross_uah &&
    before.net_uah === after.net_uah
  );
}

export function recalculateStripeWindow(
  transactions: Transaction[],
  rates: ExchangeRates,
  options?: { from?: string; until?: string },
): { transactions: Transaction[]; report: StripeRecalcReportRow[]; changedCount: number } {
  const from = options?.from ?? STRIPE_RECALC_FROM;
  const until = options?.until ?? STRIPE_RECALC_UNTIL;
  const report: StripeRecalcReportRow[] = [];
  let changedCount = 0;

  const nextTransactions = transactions.map((transaction) => {
    if (!isInStripeRecalcWindow(transaction, from, until)) return transaction;

    const taxModel = getTaxModel(transaction);
    const nextRate =
      transaction.currency === "EUR" ? 1 : resolveRate(transaction.currency, rates);
    const before = calculateFinancialBreakdown({
      gross: transaction.grossAmount,
      platformFee: transaction.customFee,
      currency: transaction.currency,
      exchangeRate: transaction.exchangeRateAtCreation,
      taxModel,
    });
    const after = calculateFinancialBreakdown({
      gross: transaction.grossAmount,
      platformFee: transaction.customFee,
      currency: transaction.currency,
      exchangeRate: nextRate,
      taxModel,
    });
    const beforeSnap = resolveUahSnapshot({
      grossAmount: transaction.grossAmount,
      currency: transaction.currency,
      netPayoutEur: before.netPayout,
      exchangeRateAtCreation: transaction.exchangeRateAtCreation,
      rates,
      uahRateAtCreation: transaction.uahRateAtCreation,
    });
    const afterSnap = resolveUahSnapshot({
      grossAmount: transaction.grossAmount,
      currency: transaction.currency,
      netPayoutEur: after.netPayout,
      exchangeRateAtCreation: nextRate,
      rates,
    });
    const grossUahBefore = transaction.gross_uah ?? beforeSnap.gross_uah;
    const netUahBefore = transaction.net_uah ?? beforeSnap.net_uah;
    const updated: Transaction = {
      ...transaction,
      exchangeRateAtCreation: nextRate,
      uahRateAtCreation: afterSnap.uahRateAtCreation,
      gross_uah: afterSnap.gross_uah,
      net_uah: afterSnap.net_uah,
    };
    const adjusted = !sameLockedAmounts(transaction, updated);
    if (adjusted) changedCount += 1;

    report.push({
      id: transaction.id,
      title: transaction.title,
      currency: transaction.currency,
      startDate: getTransactionStartDate(transaction).slice(0, 10),
      rateBefore: transaction.exchangeRateAtCreation,
      rateAfter: nextRate,
      grossEurBefore: before.grossInBase,
      grossEurAfter: after.grossInBase,
      netEurBefore: before.netPayout,
      netEurAfter: after.netPayout,
      grossUahBefore,
      grossUahAfter: afterSnap.gross_uah,
      netUahBefore,
      netUahAfter: afterSnap.net_uah,
      deltaNetEur: moneyNumber(new Decimal(after.netPayout).minus(before.netPayout)),
      deltaNetUah: moneyNumber(new Decimal(afterSnap.net_uah).minus(netUahBefore)),
      adjusted,
    });

    return adjusted ? updated : transaction;
  });

  return { transactions: nextTransactions, report, changedCount };
}
