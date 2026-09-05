"use client";

import { useCallback, useMemo, useState } from "react";
import { Wallet, ArrowRightCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/finance/finance-provider";
import { useMounted } from "@/hooks/use-mounted";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatMoney } from "@/lib/format";
import {
  calculateTransaction,
  convertToDisplay,
  moneyNumber,
} from "@/lib/tax-calculator";
import { cn } from "@/lib/utils";
import type { TransactionView } from "@/lib/aggregates";
import type { ExchangeRates, Project } from "@/types/finance";

export interface PayoutWidgetProps {
  projects?: Project[];
  onRefresh?: () => Promise<void> | void;
  mutate?: () => Promise<void> | void;
  currentEmployeeId?: string;
  className?: string;
}

const GOAL_AMOUNT = 10000;

function getProjectNetInUah(p: Project, rates: ExchangeRates | null): number {
  if (typeof p.net_amount === "number" && !Number.isNaN(p.net_amount)) {
    return p.net_amount;
  }
  const view = p as Partial<TransactionView>;
  if (typeof view.breakdown?.netPayout === "number") {
    return convertToDisplay(view.breakdown.netPayout, "UAH", rates);
  }
  try {
    const rate = rates?.toEur?.[p.currency];
    const calc = calculateTransaction(p, rate);
    return convertToDisplay(calc.netPayout, "UAH", rates);
  } catch {
    return Number(p.grossAmount ?? 0);
  }
}

export function PayoutWidget({
  projects: propProjects,
  onRefresh,
  mutate,
  currentEmployeeId: propEmployeeId,
  className,
}: PayoutWidgetProps) {
  const finance = useFinance();
  const mounted = useMounted();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const activeProjects = propProjects ?? finance.views;
  const rates = finance.rates;
  const effectiveEmployeeId =
    propEmployeeId ??
    finance.employeeView?.id ??
    (!finance.isAdmin ? finance.currentUserId : undefined);

  const pendingAmount = useMemo(() => {
    const sum = activeProjects
      .filter((p) => {
        const isPaid =
          typeof p.status === "string" && p.status.trim().toLowerCase() === "paid";
        return isPaid && !p.withdrawn;
      })
      .reduce((acc, p) => acc + getProjectNetInUah(p, rates), 0);

    return moneyNumber(sum);
  }, [activeProjects, rates]);

  const progressPercentage = Math.min((pendingAmount / GOAL_AMOUNT) * 100, 100);

  const handlePayout = useCallback(async () => {
    if (pendingAmount === 0 || isWithdrawing) return;

    setIsWithdrawing(true);
    try {
      if (isSupabaseConfigured()) {
        const supabase = createBrowserSupabaseClient();
        let query = supabase
          .from("projects")
          .update({ withdrawn: true })
          .in("status", ["Paid", "paid"])
          .is("withdrawn", false);

        if (effectiveEmployeeId) {
          query = query.eq("employee_id", effectiveEmployeeId);
        }

        const { error } = await query;
        if (error) {
          throw error;
        }
      } else {
        const targetProjects = activeProjects.filter((p) => {
          const isPaid =
            typeof p.status === "string" && p.status.trim().toLowerCase() === "paid";
          return isPaid && !p.withdrawn;
        });
        for (const p of targetProjects) {
          finance.updateTransaction(p.id, { withdrawn: true });
        }
      }

      const refreshFn = onRefresh || mutate || finance.reloadProjects;
      if (refreshFn) {
        await refreshFn();
      }

      toast.success("Виплату успішно зафіксовано!");
    } catch (error) {
      console.error("Payout error:", error);
      toast.error(
        error instanceof Error ? error.message : "Не вдалося зафіксувати виплату.",
      );
    } finally {
      setIsWithdrawing(false);
    }
  }, [activeProjects, effectiveEmployeeId, finance, isWithdrawing, mutate, onRefresh, pendingAmount]);

  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/60 to-emerald-50/40 shadow-sm transition-all dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/90 dark:to-emerald-950/20",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-400">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Ціль на виведення
              </CardTitle>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                Скарбничка
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Накопичений чистий дохід за оплачені проєкти, готовий до виведення
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
              {mounted ? formatMoney(pendingAmount, "UAH") : "—"}
            </span>
            <span className="ml-2 text-sm font-medium text-muted-foreground">
              з {mounted ? formatMoney(GOAL_AMOUNT, "UAH") : "10 000,00 ₴"}
            </span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {mounted ? `${Math.round(progressPercentage)}%` : "—"}
            </span>
            <span className="ml-1 text-xs text-muted-foreground">виконано</span>
          </div>
        </div>

        {/* Progress Bar (Emerald color for fill, Slate for background) */}
        <div
          className="relative h-3.5 w-full overflow-hidden rounded-full bg-slate-200 p-0.5 dark:bg-slate-800"
          role="progressbar"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-emerald-500 shadow-sm transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="flex flex-col items-start justify-between gap-3 pt-1 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            {pendingAmount >= GOAL_AMOUNT
              ? "🎉 Ціль досягнуто! Кошти готові до виведення на картку."
              : `До цілі залишилось: ${
                  mounted
                    ? formatMoney(Math.max(0, GOAL_AMOUNT - pendingAmount), "UAH")
                    : "—"
                }`}
          </p>

          <Button
            type="button"
            onClick={handlePayout}
            disabled={pendingAmount === 0 || isWithdrawing}
            className="h-10 w-full bg-emerald-600 px-5 font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            {isWithdrawing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Виведення...
              </>
            ) : (
              <>
                <ArrowRightCircle className="mr-2 h-4 w-4" />
                Зробити виплату
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default PayoutWidget;
