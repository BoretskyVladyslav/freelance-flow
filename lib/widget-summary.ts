import Decimal from "decimal.js";
import { withBreakdowns } from "@/lib/aggregates";
import { LAST_RESORT_RATES } from "@/lib/exchange-rates";
import {
  convertOriginalToUah,
  eurAmountToLockedUah,
  moneyNumber,
} from "@/lib/tax-calculator";
import {
  getTransactionStartDate,
  isTransaction,
  type ExchangeRates,
  type Transaction,
} from "@/types/finance";

export type WidgetSummary = {
  updatedAt: string;
  netUah: number;
  netEur: number;
  grossUah: number;
  activeProjects: number;
};

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalDate(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.slice(0, 10) : undefined;
}

export function transactionFromWidgetRow(row: Record<string, unknown>): Transaction | null {
  const taxModel = row.tax_model === "fop_3" || row.tax_model === "spain_19" ? row.tax_model : undefined;
  const candidate = {
    id: typeof row.id === "string" ? row.id : "",
    title: typeof row.title === "string" ? row.title : "",
    clientName: typeof row.client_name === "string" ? row.client_name : undefined,
    client_name: typeof row.client_name === "string" ? row.client_name : undefined,
    platform: row.platform,
    grossAmount: Number(row.gross_amount),
    currency: row.currency,
    customFee: Number(row.custom_fee ?? 0),
    exchangeRateAtCreation: Number(row.exchange_rate_at_creation),
    date: typeof row.date === "string" ? row.date : "",
    startDate: optionalDate(row.start_date),
    endDate: optionalDate(row.end_date),
    payoutDate: optionalDate(row.payout_date),
    status: row.status,
    weekNumber: Number(row.week_number),
    notes: typeof row.notes === "string" ? row.notes : undefined,
    employeeId: typeof row.employee_id === "string" ? row.employee_id : undefined,
    createdBy: typeof row.created_by === "string" ? row.created_by : undefined,
    tax_model: taxModel,
    uahRateAtCreation: optionalNumber(row.uah_rate_at_creation),
    gross_uah: optionalNumber(row.gross_uah),
    net_uah: optionalNumber(row.net_uah),
  };
  return isTransaction(candidate) ? candidate : null;
}

export function currentMonthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function buildWidgetSummary(
  transactions: Transaction[],
  rates: ExchangeRates = LAST_RESORT_RATES,
  now = new Date(),
): WidgetSummary {
  const month = currentMonthKey(now);
  const period = transactions.filter(
    (row) => getTransactionStartDate(row).slice(0, 7) === month,
  );
  const views = withBreakdowns(period, rates);

  let grossUah = new Decimal(0);
  let netUah = new Decimal(0);
  let netEur = new Decimal(0);
  let activeProjects = 0;

  for (const row of views) {
    if (row.status === "Pending" || row.status === "In Progress") {
      activeProjects += 1;
    }
    const gross =
      typeof row.gross_uah === "number"
        ? row.gross_uah
        : convertOriginalToUah(row.grossAmount, row.currency, rates, row.uahRateAtCreation);
    const net =
      typeof row.net_uah === "number"
        ? row.net_uah
        : eurAmountToLockedUah(row.breakdown.netPayout, {
            currency: row.currency,
            exchangeRateAtCreation: row.exchangeRateAtCreation,
            rates,
            uahRateAtCreation: row.uahRateAtCreation,
          });
    grossUah = grossUah.plus(gross);
    netUah = netUah.plus(net);
    netEur = netEur.plus(row.breakdown.netPayout);
  }

  return {
    updatedAt: now.toISOString(),
    netUah: moneyNumber(netUah),
    netEur: moneyNumber(netEur),
    grossUah: moneyNumber(grossUah),
    activeProjects,
  };
}
