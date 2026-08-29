"use client";

import { useMemo } from "react";
import { useFinance } from "@/components/finance/finance-provider";
import { monthKeyFromIsoDate, weekKeyFromIsoDate } from "@/lib/week";
import { PAYMENT_STATUSES, PLATFORMS } from "@/types/finance";
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
    return Array.from(new Set(transactions.map((row) => monthKeyFromIsoDate(row.date)))).sort();
  }, [transactions]);

  const weeks = useMemo(() => {
    return Array.from(new Set(transactions.map((row) => weekKeyFromIsoDate(row.date)))).sort();
  }, [transactions]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={filters.platform}
        onValueChange={(value) =>
          value && setFilters((current) => ({ ...current, platform: value as typeof current.platform }))
        }
      >
        <SelectTrigger aria-label="Filter by platform" className="min-w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value="all">All platforms</SelectItem>
          {PLATFORMS.map((platform) => (
            <SelectItem key={platform} value={platform}>
              {platform}
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
        <SelectTrigger aria-label="Filter by status" className="min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value="all">All statuses</SelectItem>
          {PAYMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {status}
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
        <SelectTrigger aria-label="Filter by month" className="min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value="all">All months</SelectItem>
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
        <SelectTrigger aria-label="Filter by week" className="min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectItem value="all">All weeks</SelectItem>
          {weeks.map((week) => (
            <SelectItem key={week} value={week}>
              {week}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
