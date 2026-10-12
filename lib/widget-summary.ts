import { applyFilters, summarize, toDisplayTotals, withBreakdowns } from "@/lib/aggregates";
import { LAST_RESORT_RATES } from "@/lib/exchange-rates";
import { formatMonthFilterLabel } from "@/lib/format";
import { isoWeekFromIsoDate } from "@/lib/week";
import {
  DEFAULT_FILTERS,
  isTransaction,
  type ExchangeRates,
  type LedgerFilters,
  type Transaction,
} from "@/types/finance";

export type WidgetPeriod = "current" | "month" | "all";

export type WidgetSummary = {
  updatedAt: string;
  periodLabel: string;
  netUah: number;
  netEur: number;
  grossUah: number;
  grossEur: number;
  firmFeeUah: number;
  taxesUah: number;
  activeCount: number;
  pendingCount: number;
  paidCount: number;
};

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function optionalDate(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.slice(0, 10) : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}

function weekNumberForRow(row: Record<string, unknown>): number {
  const parsed = finiteNumber(row.week_number);
  if (parsed !== undefined && Number.isInteger(parsed) && parsed >= 1 && parsed <= 53) {
    return parsed;
  }
  const date = optionalDate(row.start_date) || (typeof row.date === "string" ? row.date : "");
  if (!date) return 1;
  try {
    return isoWeekFromIsoDate(date.slice(0, 10));
  } catch {
    return 1;
  }
}

export function transactionFromWidgetRow(row: Record<string, unknown>): Transaction | null {
  const taxModel = row.tax_model === "fop_3" || row.tax_model === "spain_19" ? row.tax_model : undefined;
  const candidate = {
    id: typeof row.id === "string" ? row.id : "",
    title: typeof row.title === "string" ? row.title : "",
    clientName: typeof row.client_name === "string" ? row.client_name : undefined,
    client_name: typeof row.client_name === "string" ? row.client_name : undefined,
    platform: row.platform,
    grossAmount: finiteNumber(row.gross_amount) ?? Number.NaN,
    currency: row.currency,
    customFee: finiteNumber(row.custom_fee) ?? 0,
    exchangeRateAtCreation: finiteNumber(row.exchange_rate_at_creation) ?? Number.NaN,
    date: typeof row.date === "string" ? row.date : "",
    startDate: optionalDate(row.start_date),
    endDate: optionalDate(row.end_date),
    payoutDate: optionalDate(row.payout_date),
    status: row.status,
    weekNumber: weekNumberForRow(row),
    notes: typeof row.notes === "string" ? row.notes : undefined,
    employeeId: typeof row.employee_id === "string" ? row.employee_id : undefined,
    createdBy: typeof row.created_by === "string" ? row.created_by : undefined,
    tax_model: taxModel,
    uahRateAtCreation: positiveNumber(row.uah_rate_at_creation),
    gross_uah: nonNegativeNumber(row.gross_uah),
    net_uah: nonNegativeNumber(row.net_uah),
  };
  return isTransaction(candidate) ? candidate : null;
}

export function resolveWidgetPeriod(value: string | null | undefined): WidgetPeriod {
  if (value === "month" || value === "all" || value === "current") return value;
  return "current";
}

export function widgetMonthKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function periodFilters(period: WidgetPeriod, now: Date): { filters: LedgerFilters; label: string } {
  if (period === "month") {
    const month = widgetMonthKey(now);
    return {
      filters: { ...DEFAULT_FILTERS, month },
      label: formatMonthFilterLabel(month),
    };
  }
  return { filters: DEFAULT_FILTERS, label: "Всі періоди" };
}

export function buildWidgetSummary(
  transactions: Transaction[],
  rates: ExchangeRates = LAST_RESORT_RATES,
  now = new Date(),
  period: WidgetPeriod = "current",
): WidgetSummary {
  const { filters, label } = periodFilters(period, now);
  const views = applyFilters(withBreakdowns(transactions, rates), filters);
  const totals = summarize(views);
  const display = toDisplayTotals(totals, "UAH", rates);

  return {
    updatedAt: now.toISOString(),
    periodLabel: label,
    netUah: display.netPayout,
    netEur: totals.netPayout,
    grossUah: display.grossInBase,
    grossEur: totals.grossInBase,
    firmFeeUah: display.companyTax,
    taxesUah: display.spainTax,
    activeCount: views.filter((row) => row.status === "In Progress").length,
    pendingCount: views.filter((row) => row.status === "Pending").length,
    paidCount: views.filter((row) => row.status === "Paid").length,
  };
}
