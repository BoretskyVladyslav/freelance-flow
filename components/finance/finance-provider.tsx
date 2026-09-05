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
  projectsRepository,
  type FinanceSnapshot,
} from "@/services/projects";
import Decimal from "decimal.js";
import { convertToDisplay, moneyNumber } from "@/lib/tax-calculator";
import { getExpenses, addExpense, deleteExpense } from "@/services/supabase-expenses";
import { isoWeekFromIsoDate, monthKeyFromIsoDate, weekKeyFromIsoDate } from "@/lib/week";
import { scopeTeamExpenses, scopeTeamTransactions } from "@/lib/team-scope";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  DEFAULT_FILTERS,
  type Currency,
  type ExchangeRates,
  type Expense,
  type LedgerFilters,
  type Transaction,
} from "@/types/finance";
import type { UserRole } from "@/types/database";
import type { EmployeeView, TeamScope } from "@/types/team";

type FinanceContextValue = {
  hydrated: boolean;
  role: UserRole;
  isAdmin: boolean;
  currentUserId: string;
  teamScope: TeamScope;
  setTeamScope: (scope: TeamScope, label?: string) => void;
  employeeView: EmployeeView | null;
  viewEmployee: (id: string, label: string) => void;
  clearEmployeeView: () => void;
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
  expenses: Expense[];
  filteredExpenses: Expense[];
  totalExpensesInDisplay: number;
  trueNetPayout: number;
  reloadExpenses: () => Promise<void>;
  addExpenseItem: (expense: Omit<Expense, "id" | "created_at">) => Promise<Expense>;
  deleteExpenseItem: (id: string) => Promise<void>;
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
  const [teamScope, setTeamScopeState] = useState<TeamScope>("all");
  const [employeeView, setEmployeeView] = useState<EmployeeView | null>(null);
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
        const resolvedRole: UserRole =
          (profile.data?.role as UserRole) ||
          (user.user_metadata?.role as UserRole) ||
          (user.app_metadata?.role as UserRole) ||
          "employee";
        setRole(resolvedRole);
        if (resolvedRole !== "admin") {
          setTeamScopeState("personal");
          setEmployeeView(null);
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
  const setTeamScope = useCallback((scope: TeamScope, label?: string) => {
    if (!isAdmin) {
      setTeamScopeState("personal");
      setEmployeeView(null);
      return;
    }
    setTeamScopeState(scope);
    if (scope === "all" || scope === "personal") {
      setEmployeeView(null);
      return;
    }
    setEmployeeView({
      id: scope,
      label: (label ?? "").trim() || scope,
    });
  }, [isAdmin]);

  const viewEmployee = useCallback((id: string, label: string) => {
    setTeamScope(id, label);
  }, [setTeamScope]);

  const clearEmployeeView = useCallback(() => {
    setTeamScope("all");
  }, [setTeamScope]);

  const scopedTransactions = useMemo(
    () =>
      scopeTeamTransactions(snapshot.transactions, {
        isAdmin,
        currentUserId,
        teamScope,
      }),
    [currentUserId, isAdmin, snapshot.transactions, teamScope],
  );

  const views = useMemo(
    () => withBreakdowns(scopedTransactions, exchange.rates),
    [exchange.rates, scopedTransactions],
  );

  const weekly = useMemo(
    () => weeklySeries(views, snapshot.displayCurrency, exchange.rates),
    [exchange.rates, snapshot.displayCurrency, views],
  );

  const filteredViews = useMemo(() => applyFilters(views, filters), [filters, views]);
  const totals = useMemo(() => summarize(filteredViews), [filteredViews]);
  const displayTotals = useMemo(
    () => toDisplayTotals(totals, snapshot.displayCurrency, exchange.rates, filteredViews),
    [exchange.rates, filteredViews, snapshot.displayCurrency, totals],
  );
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const reloadExpenses = useCallback(async () => {
    try {
      const list = await getExpenses();
      setExpenses(list);
    } catch (e) {
      console.warn("Failed to load expenses:", e);
    }
  }, []);

  useEffect(() => {
    void reloadExpenses();
  }, [reloadExpenses]);

  const scopedExpenses = useMemo(
    () =>
      scopeTeamExpenses(expenses, {
        isAdmin,
        currentUserId,
        teamScope,
      }),
    [currentUserId, expenses, isAdmin, teamScope],
  );

  const filteredExpenses = useMemo(() => {
    return scopedExpenses.filter((e) => {
      if (filters.month !== "all") {
        if (monthKeyFromIsoDate(e.expense_date) !== filters.month) return false;
      }
      if (filters.week !== "all") {
        if (weekKeyFromIsoDate(e.expense_date) !== filters.week) return false;
      }
      return true;
    });
  }, [filters.month, filters.week, scopedExpenses]);

  const totalExpensesInDisplay = useMemo(() => {
    const totalEur = filteredExpenses.reduce((acc, e) => {
      const toEur = resolveRate(e.currency, exchange.rates);
      return acc.plus(new Decimal(e.amount).times(toEur));
    }, new Decimal(0));
    return convertToDisplay(moneyNumber(totalEur), snapshot.displayCurrency, exchange.rates);
  }, [exchange.rates, filteredExpenses, snapshot.displayCurrency]);

  const trueNetPayout = useMemo(() => {
    return moneyNumber(new Decimal(displayTotals.netPayout).minus(totalExpensesInDisplay));
  }, [displayTotals.netPayout, totalExpensesInDisplay]);

  const addExpenseItem = useCallback(
    async (item: Omit<Expense, "id" | "created_at">) => {
      const created = await addExpense(item);
      setExpenses((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const deleteExpenseItem = useCallback(
    async (id: string) => {
      if (!isAdmin) {
        toast.error("Лише адміністратор може видаляти витрати.");
        return;
      }
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    },
    [isAdmin],
  );

  const addTransaction = useCallback(
    (
      input: Omit<Transaction, "id" | "weekNumber" | "exchangeRateAtCreation"> & {
        exchangeRateAtCreation?: number;
      },
    ) => {
      const exchangeRateAtCreation =
        input.exchangeRateAtCreation ?? resolveRate(input.currency, exchange.rates);
      const employeeId = isAdmin
        ? input.employeeId ?? (currentUserId || undefined)
        : (currentUserId || undefined);
      const next: Transaction = {
        ...input,
        id: createId(),
        weekNumber: isoWeekFromIsoDate(input.startDate || input.date),
        exchangeRateAtCreation,
        title: input.title.trim(),
        notes: input.notes?.trim() ? input.notes.trim() : undefined,
        employeeId,
        createdBy: input.createdBy ?? (currentUserId || undefined),
      };
      setSnapshot((current) => ({
        ...current,
        transactions: [next, ...current.transactions],
      }));
    },
    [currentUserId, exchange.rates, isAdmin],
  );

  const updateTransaction = useCallback((id: string, patch: Partial<Omit<Transaction, "id">>) => {
    setSnapshot((current) => ({
      ...current,
      transactions: current.transactions.map((transaction) => {
        if (transaction.id !== id) return transaction;
        const merged = { ...transaction, ...patch };
        if (!isAdmin && currentUserId) {
          merged.employeeId = currentUserId;
        }
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
  }, [currentUserId, isAdmin]);

  const deleteTransaction = useCallback((id: string) => {
    if (!isAdmin) {
      toast.error("Лише адміністратор може видаляти проєкти.");
      return;
    }
    setSnapshot((current) => ({
      ...current,
      transactions: current.transactions.filter((transaction) => transaction.id !== id),
    }));
  }, [isAdmin]);

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
      employeeView,
      viewEmployee,
      clearEmployeeView,
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
      expenses,
      filteredExpenses,
      totalExpensesInDisplay,
      trueNetPayout,
      reloadExpenses,
      addExpenseItem,
      deleteExpenseItem,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      exportBackup,
      importBackup,
      reloadProjects,
    }),
    [
      addTransaction,
      clearEmployeeView,
      currentUserId,
      deleteTransaction,
      displayTotals,
      employeeView,
      exchange.error,
      exchange.loading,
      exchange.rates,
      exchange.refresh,
      exchange.refreshing,
      expenses,
      exportBackup,
      filteredExpenses,
      filteredViews,
      filters,
      hydrated,
      importBackup,
      isAdmin,
      reloadExpenses,
      reloadProjects,
      role,
      scopedTransactions,
      setDisplayCurrency,
      snapshot.displayCurrency,
      setTeamScope,
      teamScope,
      totalExpensesInDisplay,
      totals,
      trueNetPayout,
      updateTransaction,
      viewEmployee,
      views,
      weekly,
      addExpenseItem,
      deleteExpenseItem,
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
