"use client";

import { useMemo } from "react";
import { useFinance } from "@/components/finance/finance-provider";
import {
  PLATFORM_FILTER_ITEMS,
  PLATFORM_LABELS,
  STATUS_FILTER_ITEMS,
  STATUS_LABELS,
  TEAM_SCOPE_ITEMS,
} from "@/lib/labels";
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
  const { filters, setFilters, transactions, isAdmin, teamScope, setTeamScope } = useFinance();

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

  const monthItems = useMemo(
    () => ({
      all: "Всі періоди",
      ...Object.fromEntries(months.map((month) => [month, month])),
    }),
    [months],
  );

  const weekItems = useMemo(
    () => ({
      all: "Всі тижні",
      ...Object.fromEntries(weeks.map((week) => [week, week.replace("-W", " Т")])),
    }),
    [weeks],
  );

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 print:hidden">
      {isAdmin ? (
        <Select
          value={teamScope}
          items={TEAM_SCOPE_ITEMS}
          onValueChange={(value) => {
            if (value === "all" || value === "personal") setTeamScope(value);
          }}
        >
          <SelectTrigger aria-label="Охоплення команди" className="min-w-0 max-w-full sm:min-w-44">
            <SelectValue>
              {(value: string | null) =>
                value && value in TEAM_SCOPE_ITEMS
                  ? TEAM_SCOPE_ITEMS[value as keyof typeof TEAM_SCOPE_ITEMS]
                  : TEAM_SCOPE_ITEMS.all
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="all">Усі працівники</SelectItem>
            <SelectItem value="personal">Персонально</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      <Select
        value={filters.platform}
        items={PLATFORM_FILTER_ITEMS}
        onValueChange={(value) =>
          value && setFilters((current) => ({ ...current, platform: value as typeof current.platform }))
        }
      >
        <SelectTrigger aria-label="Фільтр за платформою" className="min-w-0 max-w-full sm:min-w-40">
          <SelectValue>
            {(value: string | null) =>
              value && value in PLATFORM_FILTER_ITEMS
                ? PLATFORM_FILTER_ITEMS[value as keyof typeof PLATFORM_FILTER_ITEMS]
                : "Всі платформи"
            }
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
        items={STATUS_FILTER_ITEMS}
        onValueChange={(value) =>
          value && setFilters((current) => ({ ...current, status: value as typeof current.status }))
        }
      >
        <SelectTrigger aria-label="Фільтр за статусом" className="min-w-0 max-w-full sm:min-w-36">
          <SelectValue>
            {(value: string | null) =>
              value && value in STATUS_FILTER_ITEMS
                ? STATUS_FILTER_ITEMS[value as keyof typeof STATUS_FILTER_ITEMS]
                : "Всі статуси"
            }
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
        items={monthItems}
        onValueChange={(value) =>
          value && setFilters((current) => ({ ...current, month: value }))
        }
      >
        <SelectTrigger aria-label="Фільтр за періодом" className="min-w-0 max-w-full sm:min-w-36">
          <SelectValue>
            {(value: string | null) =>
              !value || value === "all" ? "Всі періоди" : value
            }
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
        items={weekItems}
        onValueChange={(value) =>
          value && setFilters((current) => ({ ...current, week: value }))
        }
      >
        <SelectTrigger aria-label="Фільтр за тижнем" className="min-w-0 max-w-full sm:min-w-36">
          <SelectValue>
            {(value: string | null) =>
              !value || value === "all" ? "Всі тижні" : value.replace("-W", " Т")
            }
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
