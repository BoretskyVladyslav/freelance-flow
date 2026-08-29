"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useExchangeRates } from "@/hooks/use-exchange-rates";
import {
  applyFilters,
  summarize,
  toDisplayTotals,
  weeklySeries,
  withBreakdowns,
  type DashboardTotals,
  type TransactionView,
  type WeeklyPoint,
} from "@/lib/aggregates";
import { resolveRate } from "@/lib/exchange-rates";
import {
  loadSnapshot,
  parseImportedBackup,
  saveSnapshot,
  serializeBackup,
  type FinanceSnapshot,
} from "@/lib/storage";
import { isoWeekFromIsoDate } from "@/lib/week";
import {
  DEFAULT_FILTERS,
  type Currency,
  type ExchangeRates,
  type LedgerFilters,
  type Transaction,
} from "@/types/finance";

type FinanceContextValue = {
  hydrated: boolean;
  transactions: Transaction[];
  views: TransactionView[];
  filteredViews: TransactionView[];
  filters: LedgerFilters;
  setFilters: (next: LedgerFilters | ((current: LedgerFilters) => LedgerFilters)) => void;
  displayCurrency: Currency;
  setDisplayCurrency: (currency: Currency) => void;
  rates: ExchangeRates;
  ratesLoading: boolean;
  ratesRefreshing: boolean;
  ratesError: string | null;
  refreshRates: () => Promise<ExchangeRates | null>;
  totals: DashboardTotals;
  displayTotals: DashboardTotals;
  weekly: WeeklyPoint[];
  addTransaction: (
    input: Omit<Transaction, "id" | "weekNumber" | "exchangeRateAtCreation"> & {
      exchangeRateAtCreation?: number;
    },
  ) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  deleteTransaction: (id: string) => void;
  exportBackup: () => void;
  importBackup: (raw: string) => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tx_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [snapshot, setSnapshot] = useState<FinanceSnapshot>({
    transactions: [],
    lastKnownRates: null,
    displayCurrency: "UAH",
  });
  const [filters, setFilters] = useState<LedgerFilters>(DEFAULT_FILTERS);
  const exchange = useExchangeRates(snapshot.lastKnownRates);

  useEffect(() => {
    void loadSnapshot().then((loaded) => {
      setSnapshot(loaded);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveSnapshot(snapshot);
  }, [hydrated, snapshot]);

  useEffect(() => {
    if (!hydrated || exchange.rates.stale) return;
    setSnapshot((current) => {
      if (current.lastKnownRates?.fetchedAt === exchange.rates.fetchedAt) {
        return current;
      }
      return { ...current, lastKnownRates: exchange.rates };
    });
  }, [exchange.rates, hydrated]);

  const views = useMemo(
    () => withBreakdowns(snapshot.transactions, exchange.rates),
    [snapshot.transactions, exchange.rates],
  );
  const filteredViews = useMemo(() => applyFilters(views, filters), [views, filters]);
  const totals = useMemo(() => summarize(views), [views]);
  const displayTotals = useMemo(
    () => toDisplayTotals(totals, snapshot.displayCurrency, exchange.rates),
    [totals, snapshot.displayCurrency, exchange.rates],
  );
  const weekly = useMemo(
    () => weeklySeries(views, snapshot.displayCurrency, exchange.rates),
    [views, snapshot.displayCurrency, exchange.rates],
  );

  const addTransaction = useCallback(
    (
      input: Omit<Transaction, "id" | "weekNumber" | "exchangeRateAtCreation"> & {
        exchangeRateAtCreation?: number;
      },
    ) => {
      const exchangeRateAtCreation =
        input.exchangeRateAtCreation ?? resolveRate(input.currency, exchange.rates);
      const next: Transaction = {
        ...input,
        id: createId(),
        weekNumber: isoWeekFromIsoDate(input.startDate || input.date),
        exchangeRateAtCreation,
        title: input.title.trim(),
        notes: input.notes?.trim() ? input.notes.trim() : undefined,
      };
      setSnapshot((current) => ({
        ...current,
        transactions: [next, ...current.transactions],
      }));
    },
    [exchange.rates],
  );

  const updateTransaction = useCallback((id: string, patch: Partial<Omit<Transaction, "id">>) => {
    setSnapshot((current) => ({
      ...current,
      transactions: current.transactions.map((transaction) => {
        if (transaction.id !== id) return transaction;
        const merged = { ...transaction, ...patch };
        if (patch.startDate || patch.date) {
          merged.weekNumber = isoWeekFromIsoDate(
            patch.startDate || patch.date || transaction.startDate || transaction.date,
          );
        }
        return {
          ...merged,
          title: merged.title.trim(),
          notes: merged.notes?.trim() ? merged.notes.trim() : undefined,
        };
      }),
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setSnapshot((current) => ({
      ...current,
      transactions: current.transactions.filter((transaction) => transaction.id !== id),
    }));
  }, []);

  const setDisplayCurrency = useCallback((currency: Currency) => {
    setSnapshot((current) => ({ ...current, displayCurrency: currency }));
  }, []);

  const exportBackup = useCallback(() => {
    const payload = serializeBackup(snapshot);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `freelance-flow-backup-${stamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Резервну копію експортовано.");
  }, [snapshot]);

  const importBackup = useCallback((raw: string) => {
    const imported = parseImportedBackup(raw);
    setSnapshot(imported);
    toast.success(`Імпортовано транзакцій: ${imported.transactions.length}.`);
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      hydrated,
      transactions: snapshot.transactions,
      views,
      filteredViews,
      filters,
      setFilters,
      displayCurrency: snapshot.displayCurrency,
      setDisplayCurrency,
      rates: exchange.rates,
      ratesLoading: exchange.loading,
      ratesRefreshing: exchange.refreshing,
      ratesError: exchange.error,
      refreshRates: exchange.refresh,
      totals,
      displayTotals,
      weekly,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      exportBackup,
      importBackup,
    }),
    [
      addTransaction,
      deleteTransaction,
      displayTotals,
      exchange.error,
      exchange.loading,
      exchange.rates,
      exchange.refresh,
      exchange.refreshing,
      exportBackup,
      filteredViews,
      filters,
      hydrated,
      importBackup,
      setDisplayCurrency,
      snapshot.displayCurrency,
      snapshot.transactions,
      totals,
      updateTransaction,
      views,
      weekly,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) {
    throw new Error("useFinance must be used within FinanceProvider.");
  }
  return value;
}
