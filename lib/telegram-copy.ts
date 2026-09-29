import Decimal from "decimal.js";
import {
  formatMonthFilterLabel,
  formatMonthlyEsvNote,
  formatWeekFilterLabel,
} from "@/lib/format";
import {
  convertToDisplay,
  moneyNumber,
  netAfterMonthlyEsv,
  shouldApplyMonthlyEsv,
} from "@/lib/tax-calculator";
import type { TransactionView } from "@/lib/aggregates";
import { getTaxModel, type Currency, type ExchangeRates, type LedgerFilters, type TaxModel } from "@/types/finance";

const DIVIDER = "━━━━━━━━━━━━━━━━━━";

function formatTelegramNumber(amount: number): string {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/[\u00A0\u202F\u2009]/g, " ");
}

function clientNameOf(row: Pick<TransactionView, "clientName" | "client_name">): string {
  return (row.client_name || row.clientName || "").trim();
}

function toOriginal(amountEur: number, toEur: number): number {
  return moneyNumber(new Decimal(amountEur).div(toEur));
}

export function formatTelegramTaxLine(
  taxModel: TaxModel | undefined,
  taxAmount: string,
  currency: string,
): string {
  if (getTaxModel(taxModel) === "fop_3") {
    return `🏛 Податки ФОП (5% ЄП + 1% ВЗ): -${taxAmount} ${currency}`;
  }
  return `🏛 Податок Іспанії (19%): -${taxAmount} ${currency}`;
}

export function formatTransactionTelegram(row: TransactionView): string {
  const rate = row.exchangeRateAtCreation;
  const currency = row.currency;
  const client = clientNameOf(row);
  const gross = formatTelegramNumber(moneyNumber(row.grossAmount));
  const spainTax = formatTelegramNumber(toOriginal(row.breakdown.spainTax, rate));
  const companyTax = formatTelegramNumber(toOriginal(row.breakdown.companyTax, rate));
  const net = formatTelegramNumber(toOriginal(row.breakdown.netPayout, rate));

  return [
    `📋 Проєкт: ${row.title}`,
    client ? `👤 Клієнт: ${client}` : "",
    DIVIDER,
    `💰 Валовий (Gross): ${gross} ${currency}`,
    getTaxModel(row.tax_model) === "fop_3"
      ? `🏢 Комісія фірми (30%): -${companyTax} ${currency}`
      : formatTelegramTaxLine(row.tax_model, spainTax, currency),
    getTaxModel(row.tax_model) === "fop_3"
      ? formatTelegramTaxLine(row.tax_model, spainTax, currency)
      : `🏢 Комісія фірми (30%): -${companyTax} ${currency}`,
    DIVIDER,
    `✅ До виплати (Net): ${net} ${currency}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function describeTelegramPeriod(filters: LedgerFilters): string {
  if (filters.week !== "all") return formatWeekFilterLabel(filters.week);
  if (filters.month !== "all") return formatMonthFilterLabel(filters.month);
  return "Усі періоди";
}

export function projectsForPeriodSummary(views: TransactionView[]): TransactionView[] {
  const completed = views.filter((row) => row.status !== "In Progress");
  return completed.length > 0 ? completed : views;
}

export function formatEmployeePeriodTelegram(input: {
  employeeLabel: string;
  email?: string;
  filters: LedgerFilters;
  views: TransactionView[];
  displayCurrency: Currency;
  rates: ExchangeRates | null;
}): string {
  const projects = projectsForPeriodSummary(input.views);
  const period = describeTelegramPeriod(input.filters);
  const email = input.email?.trim();
  const labelIsEmail = input.employeeLabel.includes("@");
  const showEmail = Boolean(email) && email !== input.employeeLabel && !labelIsEmail;

  const items = projects.map((row, index) => {
    const client = clientNameOf(row);
    const net = formatTelegramNumber(
      convertToDisplay(row.breakdown.netPayout, input.displayCurrency, input.rates),
    );
    const gross = formatTelegramNumber(moneyNumber(row.grossAmount));
    const lines = [
      `${index + 1}. 📋 ${row.title}`,
      client ? `   👤 ${client}` : "",
      `   💰 ${gross} ${row.currency} → ✅ ${net} ${input.displayCurrency}`,
    ].filter((line) => line !== "");
    return lines.join("\n");
  });

  const totalNetEur = moneyNumber(
    projects.reduce((acc, row) => acc.plus(row.breakdown.netPayout), new Decimal(0)),
  );
  const totalNet = convertToDisplay(totalNetEur, input.displayCurrency, input.rates);
  const applyEsv = shouldApplyMonthlyEsv(input.filters);
  const netAfterEsv = applyEsv
    ? netAfterMonthlyEsv(totalNet, input.displayCurrency, input.rates)
    : null;

  return [
    `📋 Підсумок: ${input.employeeLabel}`,
    showEmail ? `✉️ ${email}` : "",
    `📅 Період: ${period}`,
    `📊 Проєктів: ${projects.length}`,
    DIVIDER,
    items.length > 0 ? items.join("\n") : "Немає проєктів за вибраний період.",
    DIVIDER,
    `✅ Разом до виплати (Net): ${formatTelegramNumber(totalNet)} ${input.displayCurrency}`,
    applyEsv ? formatMonthlyEsvNote() : "",
    netAfterEsv !== null
      ? `💵 Чистий залишок після ЄСВ: ${formatTelegramNumber(netAfterEsv)} ${input.displayCurrency}`
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
