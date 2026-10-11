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
import { getTaxModel, type Currency, type ExchangeRates, type LedgerFilters } from "@/types/finance";

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

/** Cash Yuri receives. FOP tax stays with the account owner, so it is not deducted. */
export function cashPayoutEur(row: TransactionView): number {
  return getTaxModel(row) === "fop_3" ? row.breakdown.postSpainBase : row.breakdown.netPayout;
}

function moneyWithEur(amount: string, currency: string, amountEur: number): string {
  if (currency === "EUR") return `${amount} EUR`;
  return `${amount} ${currency} (≈ ${formatTelegramNumber(amountEur)} €)`;
}

export function formatTransactionTelegram(row: TransactionView): string {
  const rate = row.exchangeRateAtCreation;
  const currency = row.currency;
  const client = clientNameOf(row);
  const gross = formatTelegramNumber(moneyNumber(row.grossAmount));
  const spainTax = formatTelegramNumber(toOriginal(row.breakdown.spainTax, rate));
  const companyTax = formatTelegramNumber(toOriginal(row.breakdown.companyTax, rate));
  const payoutEur = cashPayoutEur(row);
  const payout = formatTelegramNumber(toOriginal(payoutEur, rate));
  const taxModel = getTaxModel(row);
  const isFop = taxModel === "fop_3";

  return [
    `📋 Проєкт: ${row.title}`,
    client ? `👤 Клієнт: ${client}` : "",
    DIVIDER,
    `💰 Валовий (Gross): ${moneyWithEur(gross, currency, row.breakdown.grossInBase)}`,
    `🏢 Комісія фірми (30%): -${companyTax} ${currency}`,
    isFop
      ? `🏛 Податки ФОП (5% + 1%): ${spainTax} ${currency} (сплачує отримувач 🤝)`
      : `🏛 Податок Іспанії (19%): -${spainTax} ${currency}`,
    DIVIDER,
    `✅ До виплати (Net): ${moneyWithEur(payout, currency, payoutEur)}`,
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
      convertToDisplay(cashPayoutEur(row), input.displayCurrency, input.rates),
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
    projects.reduce((acc, row) => acc.plus(cashPayoutEur(row)), new Decimal(0)),
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
