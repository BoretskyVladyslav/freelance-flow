"use client";

import { useMemo } from "react";
import { useFinance } from "@/components/finance/finance-provider";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/labels";
import { monthKeyFromIsoDate, weekKeyFromIsoDate } from "@/lib/week";
import {
  PAYMENT_STATUSES,
  PLATFORMS,
  getTransactionStartDate,
} from "@/types/finance";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LedgerFilters() {
  const { filters, setFilters, transactions } = useFinance();

  const months = useMemo(() => {
    return Array.from(
      new Set(transactions.map((row) => monthKeyFromIsoDate(getTransactionStartDate(row)))),
    ).sort();
  }, [transactions]);

  const weeks = useMemo(() => {
    return Array.from(
      new Set(transactions.map((row) => weekKeyFromIsoDate(getTransactionStartDate(row)))),
    ).sort();
  }, [transactions]);

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Select
        value={filters.platform}
        onValueChange={(value) =>
          value && setFilters((current) => ({ ...current, platform: value as typeof current.platform }))
        }
      >
        <SelectTrigger aria-label="Фільтр за платформою" className="min-w-40">
          <SelectValue>
            {filters.platform === "all"
              ? "Всі платформи"
              : PLATFORM_LABELS[filters.platform]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value="all">Всі платформи</SelectItem>
          {PLATFORMS.map((platform) => (
            <SelectItem key={platform} value={platform}>
              {PLATFORM_LABELS[platform]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(value) =>
          value && setFilters((current) => ({ ...current, status: value as typeof current.status }))
        }
      >
        <SelectTrigger aria-label="Фільтр за статусом" className="min-w-36">
          <SelectValue>
            {filters.status === "all" ? "Всі статуси" : STATUS_LABELS[filters.status]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value="all">Всі статуси</SelectItem>
          {PAYMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.month}
        onValueChange={(value) =>
          value && setFilters((current) => ({ ...current, month: value }))
        }
      >
        <SelectTrigger aria-label="Фільтр за періодом" className="min-w-36">
          <SelectValue>
            {filters.month === "all" ? "Всі періоди" : filters.month}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value="all">Всі періоди</SelectItem>
          {months.map((month) => (
            <SelectItem key={month} value={month}>
              {month}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.week}
        onValueChange={(value) =>
          value && setFilters((current) => ({ ...current, week: value }))
        }
      >
        <SelectTrigger aria-label="Фільтр за тижнем" className="min-w-36">
          <SelectValue>
            {filters.week === "all" ? "Всі тижні" : filters.week.replace("-W", " Т")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value="all">Всі тижні</SelectItem>
          {weeks.map((week) => (
            <SelectItem key={week} value={week}>
              {week.replace("-W", " Т")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
