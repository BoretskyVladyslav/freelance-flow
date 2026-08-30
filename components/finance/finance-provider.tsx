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
  type DashboardTotals,
  type TransactionView,
  type WeeklyPoint,
} from "@/lib/aggregates";
import { resolveRate } from "@/lib/exchange-rates";
import {
  projectsRepository,
  type FinanceSnapshot,
} from "@/services/projects";
import { buildFinancialOverview } from "@/services/financials";
import { isoWeekFromIsoDate } from "@/lib/week";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  DEFAULT_FILTERS,
  type Currency,
  type ExchangeRates,
  type LedgerFilters,
  type Transaction,
} from "@/types/finance";
import type { UserRole } from "@/types/database";
import type { TeamScope } from "@/types/team";

type FinanceContextValue = {
  hydrated: boolean;
  role: UserRole;
  isAdmin: boolean;
  currentUserId: string;
  teamScope: TeamScope;
  setTeamScope: (scope: TeamScope) => void;
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
  reloadProjects: () => Promise<void>;
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
  const [persistEnabled, setPersistEnabled] = useState(false);
  const [role, setRole] = useState<UserRole>("employee");
  const [currentUserId, setCurrentUserId] = useState("");
  const [teamScope, setTeamScope] = useState<TeamScope>("all");
  const [snapshot, setSnapshot] = useState<FinanceSnapshot>({
    transactions: [],
    lastKnownRates: null,
    displayCurrency: "UAH",
  });
  const [filters, setFilters] = useState<LedgerFilters>(DEFAULT_FILTERS);
  const exchange = useExchangeRates(snapshot.lastKnownRates);

  useEffect(() => {
    void projectsRepository
      .load()
      .then((loaded) => {
        setSnapshot(loaded);
        setPersistEnabled(true);
        setHydrated(true);
      })
      .catch((error) => {
        setHydrated(true);
        toast.error(error instanceof Error ? error.message : "Не вдалося завантажити проєкти.");
      });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setRole("admin");
      setCurrentUserId("");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setRole("employee");
          setCurrentUserId("");
          return;
        }

        const withStatus = await supabase
          .from("profiles")
          .select("id, role, status")
          .eq("id", user.id)
          .maybeSingle();
        const profile =
          withStatus.error && /status/i.test(withStatus.error.message)
            ? await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle()
            : withStatus;
        if (cancelled) return;

        const status =
          profile.data && "status" in profile.data ? profile.data.status : "active";
        if (profile.error || !profile.data || status === "disabled") {
          await supabase.auth.signOut();
          window.location.replace("/login");
          return;
        }

        setCurrentUserId(user.id);
        setRole(profile.data.role);
        if (profile.data.role !== "admin") {
          setTeamScope("personal");
        }
      } catch {
        if (!cancelled) {
          setRole("employee");
          setCurrentUserId("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !persistEnabled) return;
    void projectsRepository.save(snapshot).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Не вдалося зберегти проєкти.");
    });
  }, [hydrated, persistEnabled, snapshot]);

  useEffect(() => {
    if (!hydrated || exchange.rates.stale) return;
    setSnapshot((current) => {
      if (current.lastKnownRates?.fetchedAt === exchange.rates.fetchedAt) {
        return current;
      }
      return { ...current, lastKnownRates: exchange.rates };
    });
  }, [exchange.rates, hydrated]);

  const isAdmin = role === "admin";
  const scopedTransactions = useMemo(() => {
    if (!isAdmin || teamScope !== "personal" || !currentUserId) {
      return snapshot.transactions;
    }
    return snapshot.transactions.filter((row) => row.employeeId === currentUserId);
  }, [currentUserId, isAdmin, snapshot.transactions, teamScope]);

  const overview = useMemo(
    () =>
      buildFinancialOverview(
        scopedTransactions,
        exchange.rates,
        snapshot.displayCurrency,
      ),
    [exchange.rates, scopedTransactions, snapshot.displayCurrency],
  );
  const { views, weekly } = overview;
  const filteredViews = useMemo(() => applyFilters(views, filters), [filters, views]);
  const totals = useMemo(() => summarize(filteredViews), [filteredViews]);
  const displayTotals = useMemo(
    () => toDisplayTotals(totals, snapshot.displayCurrency, exchange.rates),
    [exchange.rates, snapshot.displayCurrency, totals],
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
        employeeId: input.employeeId ?? (currentUserId || undefined),
        createdBy: input.createdBy ?? (currentUserId || undefined),
      };
      setSnapshot((current) => ({
        ...current,
        transactions: [next, ...current.transactions],
      }));
    },
    [currentUserId, exchange.rates],
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
    const payload = projectsRepository.serializeBackup(snapshot);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `freelance-flow-backup-${stamp}.json`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success("Резервну копію експортовано.");
  }, [snapshot]);

  const reloadProjects = useCallback(async () => {
    const loaded = await projectsRepository.load();
    setSnapshot(loaded);
    setPersistEnabled(true);
    setHydrated(true);
  }, []);

  const importBackup = useCallback((raw: string) => {
    const imported = projectsRepository.parseBackup(raw);
    setSnapshot(imported);
    toast.success(`Імпортовано транзакцій: ${imported.transactions.length}.`);
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      hydrated,
      role,
      isAdmin,
      currentUserId,
      teamScope,
      setTeamScope,
      transactions: scopedTransactions,
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
      reloadProjects,
    }),
    [
      addTransaction,
      currentUserId,
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
      isAdmin,
      reloadProjects,
      role,
      scopedTransactions,
      setDisplayCurrency,
      snapshot.displayCurrency,
      teamScope,
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
