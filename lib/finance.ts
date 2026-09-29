/**
 * Shared finance helpers. Tax math is implemented in `lib/tax-calculator.ts`
 * (decimal.js, ROUND_HALF_UP) and re-exported here so Modal and Ledger
 * import one public API.
 */
export {
  calculateFinancialBreakdown,
  calculateTransaction,
  eurAmountToLockedUah,
  type FinancialBreakdownInput,
} from "@/lib/tax-calculator";
