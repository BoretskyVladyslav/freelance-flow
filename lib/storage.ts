import { del, get, set } from "idb-keyval";
import {
  BACKUP_SCHEMA_VERSION,
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
  displayCurrency: "UAH",
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

function pickRicherArray(primary: unknown, fallback: unknown): unknown[] | undefined {
  const primaryArr = Array.isArray(primary) ? primary : undefined;
  const fallbackArr = Array.isArray(fallback) ? fallback : undefined;
  if (primaryArr && fallbackArr) {
    return fallbackArr.length > primaryArr.length ? fallbackArr : primaryArr;
  }
  return primaryArr ?? fallbackArr;
}

export function resolveTransactionsToPersist(
  incoming: Transaction[],
  existing: unknown,
): Transaction[] {
  if (incoming.length > 0) return incoming;
  if (!Array.isArray(existing) || existing.length === 0) return incoming;
  const kept = existing.filter(isTransaction);
  return kept.length > 0 ? kept : incoming;
}

async function readTransactions(): Promise<unknown> {
  if (!canUseBrowserStorage()) return undefined;

  const local = readLocal<unknown>(KEYS.transactions);
  if (!preferLocalStorage && typeof indexedDB !== "undefined") {
    try {
      const idb = await get<unknown>(KEYS.transactions);
      const picked = pickRicherArray(idb, local);
      if (picked !== undefined && picked !== idb && picked.length > 0) {
        await set(KEYS.transactions, picked);
      }
      return picked ?? idb;
    } catch {
      preferLocalStorage = true;
    }
  }

  return local;
}

export type RawFinanceSnapshot = {
  transactions?: unknown;
  lastKnownRates?: unknown;
  displayCurrency?: unknown;
  schemaVersion?: unknown;
};

function storedSchemaVersion(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function migrateSnapshot(raw: RawFinanceSnapshot): FinanceSnapshot {
  const schemaVersion = storedSchemaVersion(raw.schemaVersion);
  const transactions = Array.isArray(raw.transactions)
    ? raw.transactions.filter(isTransaction)
    : [];

  return {
    transactions,
    lastKnownRates: isExchangeRates(raw.lastKnownRates) ? raw.lastKnownRates : null,
    displayCurrency:
      schemaVersion < 2
        ? "UAH"
        : isCurrency(raw.displayCurrency) && raw.displayCurrency === "EUR"
          ? "EUR"
          : "UAH",
  };
}

export async function loadSnapshot(): Promise<FinanceSnapshot> {
  if (!canUseBrowserStorage()) return EMPTY_SNAPSHOT;

  const [transactions, lastKnownRates, displayCurrency, schemaVersion] =
    await Promise.all([
      readTransactions(),
      readValue<ExchangeRates>(KEYS.rates),
      readValue<Currency>(KEYS.displayCurrency),
      readValue<number>(KEYS.schemaVersion),
    ]);

  const snapshot = migrateSnapshot({
    transactions,
    lastKnownRates,
    displayCurrency,
    schemaVersion,
  });

  if (storedSchemaVersion(schemaVersion) < BACKUP_SCHEMA_VERSION) {
    await writeValue(KEYS.schemaVersion, BACKUP_SCHEMA_VERSION);
  }

  return snapshot;
}

export async function savePreferences(prefs: {
  lastKnownRates: ExchangeRates | null;
  displayCurrency: Currency;
}): Promise<void> {
  await Promise.all([
    prefs.lastKnownRates
      ? writeValue(KEYS.rates, prefs.lastKnownRates)
      : writeValue(KEYS.rates, null),
    writeValue(KEYS.displayCurrency, prefs.displayCurrency),
  ]);
}

export async function saveSnapshot(snapshot: FinanceSnapshot): Promise<void> {
  const existingTransactions = await readTransactions();
  const transactions = resolveTransactionsToPersist(
    snapshot.transactions,
    existingTransactions,
  );

  await Promise.all([
    writeValue(KEYS.transactions, transactions),
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
    displayCurrency: parsed.displayCurrency === "EUR" ? "EUR" : "UAH",
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
