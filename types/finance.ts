export const PLATFORMS = [
  "Freelancehunt",
  "Freelance BG",
  "Direct Client",
  "Other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CURRENCIES = ["EUR", "USD", "UAH", "PLN"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PAYMENT_STATUSES = ["Pending", "Paid", "In Progress"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const BASE_CURRENCY = "EUR" as const;
export const BACKUP_SCHEMA_VERSION = 3;

export type Transaction = {
  id: string;
  title: string;
  clientId?: string;
  clientName?: string;
  client_name?: string | null;
  platform: Platform;
  grossAmount: number;
  currency: Currency;
  customFee: number;
  exchangeRateAtCreation: number;
  date: string;
  startDate?: string;
  endDate?: string;
  payoutDate?: string;
  status: PaymentStatus;
  weekNumber: number;
  notes?: string;
  employeeId?: string;
  createdBy?: string;
};

export type Project = Transaction;


export type TaxBreakdown = {
  grossInBase: number;
  feeInBase: number;
  taxableBase: number;
  spainTax: number;
  postSpainBase: number;
  companyTax: number;
  netPayout: number;
  currentNetPayoutAtLiveRate: number;
  currencyGainLoss: number;
};

export type ExchangeRates = {
  base: typeof BASE_CURRENCY;
  fetchedAt: string;
  toEur: Record<Currency, number>;
  stale?: boolean;
};

export type LedgerFilters = {
  platform: Platform | "all";
  status: PaymentStatus | "all";
  month: string | "all";
  week: string | "all";
};

export type BackupEnvelope = {
  version: number;
  exportedAt: string;
  transactions: Transaction[];
  lastKnownRates?: ExchangeRates;
  displayCurrency?: Currency;
};

export const DEFAULT_FILTERS: LedgerFilters = {
  platform: "all",
  status: "all",
  month: "all",
  week: "all",
};

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    (PAYMENT_STATUSES as readonly string[]).includes(value)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isOptionalIsoDate(value: unknown): value is string | undefined {
  return value === undefined || isIsoDate(value);
}

export function getTransactionStartDate(
  transaction: Pick<Transaction, "date" | "startDate">,
): string {
  return transaction.startDate || transaction.date;
}

export function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || row.id.trim() === "") return false;
  if (typeof row.title !== "string" || row.title.trim() === "") return false;
  if (row.clientId !== undefined && typeof row.clientId !== "string") return false;
  if (row.clientName !== undefined && typeof row.clientName !== "string") return false;
  if (
    row.client_name !== undefined &&
    row.client_name !== null &&
    typeof row.client_name !== "string"
  ) {
    return false;
  }
  if (!isPlatform(row.platform)) return false;
  if (!isFiniteNumber(row.grossAmount) || row.grossAmount < 0) return false;
  if (!isCurrency(row.currency)) return false;
  if (!isFiniteNumber(row.customFee) || row.customFee < 0) return false;
  if (!isFiniteNumber(row.exchangeRateAtCreation) || row.exchangeRateAtCreation <= 0) {
    return false;
  }
  if (!isIsoDate(row.date)) return false;
  if (!isOptionalIsoDate(row.startDate)) return false;
  if (!isOptionalIsoDate(row.endDate)) return false;
  if (!isOptionalIsoDate(row.payoutDate)) return false;
  if (!isPaymentStatus(row.status)) return false;
  if (
    !isFiniteNumber(row.weekNumber) ||
    !Number.isInteger(row.weekNumber) ||
    row.weekNumber < 1 ||
    row.weekNumber > 53
  ) {
    return false;
  }
  if (row.notes !== undefined && typeof row.notes !== "string") return false;
  if (row.employeeId !== undefined && typeof row.employeeId !== "string") return false;
  if (row.createdBy !== undefined && typeof row.createdBy !== "string") return false;
  return true;
}

export function isExchangeRates(value: unknown): value is ExchangeRates {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.base !== BASE_CURRENCY) return false;
  if (!isIsoDate(row.fetchedAt)) return false;
  if (!row.toEur || typeof row.toEur !== "object") return false;
  const toEur = row.toEur as Record<string, unknown>;
  for (const currency of CURRENCIES) {
    if (!isFiniteNumber(toEur[currency]) || toEur[currency] <= 0) return false;
  }
  if (toEur.EUR !== 1) return false;
  return true;
}

export function parseBackup(value: unknown): BackupEnvelope {
  if (!value || typeof value !== "object") {
    throw new Error("Backup file is not a JSON object.");
  }
  const row = value as Record<string, unknown>;
  if (!isFiniteNumber(row.version) || row.version < 1) {
    throw new Error("Backup schema version is missing or invalid.");
  }
  if (!Array.isArray(row.transactions)) {
    throw new Error("Backup is missing a transactions array.");
  }
  const transactions = row.transactions.map((item, index) => {
    if (!isTransaction(item)) {
      throw new Error(`Transaction at index ${index} is invalid.`);
    }
    return item;
  });
  const lastKnownRates =
    row.lastKnownRates === undefined
      ? undefined
      : isExchangeRates(row.lastKnownRates)
        ? row.lastKnownRates
        : (() => {
            throw new Error("Backup lastKnownRates payload is invalid.");
          })();
  const displayCurrency =
    row.displayCurrency === undefined
      ? undefined
      : isCurrency(row.displayCurrency)
        ? row.displayCurrency
        : (() => {
            throw new Error("Backup displayCurrency is invalid.");
          })();

  return {
    version: row.version,
    exportedAt: isIsoDate(row.exportedAt) ? row.exportedAt : new Date().toISOString(),
    transactions,
    lastKnownRates,
    displayCurrency,
  };
}
