import { del, get, set } from "idb-keyval";
import {
  BACKUP_SCHEMA_VERSION,
  BASE_CURRENCY,
  isCurrency,
  isExchangeRates,
  isTransaction,
  parseBackup,
  type BackupEnvelope,
  type Currency,
  type ExchangeRates,
  type Transaction,
} from "@/types/finance";

const KEYS = {
  transactions: "freelance-flow/transactions",
  rates: "freelance-flow/rates",
  displayCurrency: "freelance-flow/display-currency",
  schemaVersion: "freelance-flow/schema-version",
} as const;

export type FinanceSnapshot = {
  transactions: Transaction[];
  lastKnownRates: ExchangeRates | null;
  displayCurrency: Currency;
};

const EMPTY_SNAPSHOT: FinanceSnapshot = {
  transactions: [],
  lastKnownRates: null,
  displayCurrency: BASE_CURRENCY,
};

let preferLocalStorage = false;

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

function readLocal<T>(key: string): T | undefined {
  if (!canUseBrowserStorage()) return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function writeLocal(key: string, value: unknown): void {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function deleteLocal(key: string): void {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(key);
}

async function readValue<T>(key: string): Promise<T | undefined> {
  if (!canUseBrowserStorage()) return undefined;

  if (!preferLocalStorage && typeof indexedDB !== "undefined") {
    try {
      const value = await get<T>(key);
      if (value !== undefined) return value;
      const fallback = readLocal<T>(key);
      if (fallback !== undefined) {
        await set(key, fallback);
      }
      return fallback;
    } catch {
      preferLocalStorage = true;
    }
  }

  return readLocal<T>(key);
}

async function writeValue(key: string, value: unknown): Promise<void> {
  if (!canUseBrowserStorage()) return;
  writeLocal(key, value);

  if (!preferLocalStorage && typeof indexedDB !== "undefined") {
    try {
      await set(key, value);
      return;
    } catch {
      preferLocalStorage = true;
    }
  }
}

export async function loadSnapshot(): Promise<FinanceSnapshot> {
  if (!canUseBrowserStorage()) return EMPTY_SNAPSHOT;

  const [transactions, lastKnownRates, displayCurrency, schemaVersion] =
    await Promise.all([
      readValue<Transaction[]>(KEYS.transactions),
      readValue<ExchangeRates>(KEYS.rates),
      readValue<Currency>(KEYS.displayCurrency),
      readValue<number>(KEYS.schemaVersion),
    ]);

  if (schemaVersion === undefined) {
    await writeValue(KEYS.schemaVersion, BACKUP_SCHEMA_VERSION);
  }

  return {
    transactions: Array.isArray(transactions)
      ? transactions.filter(isTransaction)
      : [],
    lastKnownRates: isExchangeRates(lastKnownRates) ? lastKnownRates : null,
    displayCurrency: isCurrency(displayCurrency) ? displayCurrency : BASE_CURRENCY,
  };
}

export async function saveSnapshot(snapshot: FinanceSnapshot): Promise<void> {
  await Promise.all([
    writeValue(KEYS.transactions, snapshot.transactions),
    snapshot.lastKnownRates
      ? writeValue(KEYS.rates, snapshot.lastKnownRates)
      : writeValue(KEYS.rates, null),
    writeValue(KEYS.displayCurrency, snapshot.displayCurrency),
    writeValue(KEYS.schemaVersion, BACKUP_SCHEMA_VERSION),
  ]);
}

export function createBackup(snapshot: FinanceSnapshot): BackupEnvelope {
  return {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    transactions: snapshot.transactions,
    lastKnownRates: snapshot.lastKnownRates ?? undefined,
    displayCurrency: snapshot.displayCurrency,
  };
}

export function serializeBackup(snapshot: FinanceSnapshot): string {
  return JSON.stringify(createBackup(snapshot), null, 2);
}

export function parseImportedBackup(raw: string): FinanceSnapshot {
  const parsed = parseBackup(JSON.parse(raw) as unknown);
  return {
    transactions: parsed.transactions,
    lastKnownRates: parsed.lastKnownRates ?? null,
    displayCurrency: parsed.displayCurrency ?? BASE_CURRENCY,
  };
}

export async function clearAllData(): Promise<void> {
  if (!canUseBrowserStorage()) return;
  for (const key of Object.values(KEYS)) {
    deleteLocal(key);
    if (typeof indexedDB !== "undefined") {
      try {
        await del(key);
      } catch {
        preferLocalStorage = true;
      }
    }
  }
}
