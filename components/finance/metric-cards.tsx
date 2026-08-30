"use client";

import {
  Building2,
  Landmark,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinance } from "@/components/finance/finance-provider";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MetricCards() {
  const { displayTotals, displayCurrency, hydrated, isAdmin, teamScope } = useFinance();
  const gain = displayTotals.currencyGainLoss;
  const gainPositive = gain > 0;
  const gainNegative = gain < 0;

  const cards: Array<{
    key: string;
    title: string;
    value: string;
    description: string;
    icon: LucideIcon;
    iconClass?: string;
    valueClass?: string;
  }> = [
    {
      key: "gross",
      title: "Загальний дохід (Gross)",
      value: formatMoney(displayTotals.grossInBase, displayCurrency),
      description: "Конвертовано у вибрану валюту від бази EUR.",
      icon: Wallet,
    },
    {
      key: "spain",
      title: "Податок в Іспанії (19%)",
      value: formatMoney(displayTotals.spainTax, displayCurrency),
      description: isAdmin && teamScope === "all"
        ? "Агрегація по компанії. Нараховується на базу після вирахування комісій."
        : "Нараховується на базу після вирахування комісій.",
      icon: Landmark,
    },
    {
      key: "company",
      title: "Податок фірми (30%)",
      value: formatMoney(displayTotals.companyTax, displayCurrency),
      description: isAdmin && teamScope === "all"
        ? "Агрегація по компанії. Нараховується на залишок після сплати іспанського податку."
        : "Нараховується на залишок після сплати іспанського податку.",
      icon: Building2,
    },
    {
      key: "net",
      title: "Чистий дохід до виплати (Net)",
      value: formatMoney(displayTotals.netPayout, displayCurrency),
      description: `Залишилось до виплати: ${formatMoney(displayTotals.remainingToBePaid, displayCurrency)}`,
      icon: Wallet,
    },
    {
      key: "fx",
      title: "Курсова різниця (Прибуток / Збиток)",
      value: formatSignedMoney(gain, displayCurrency),
      description: "Різниця між актуальним курсом і курсом на момент створення.",
      icon: gainNegative ? TrendingDown : TrendingUp,
      iconClass: gainNegative ? "text-destructive" : "text-muted-foreground",
      valueClass: gainPositive
        ? "text-emerald-600 dark:text-emerald-400"
        : gainNegative
          ? "text-destructive"
          : "",
    },
  ];

  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      {cards.map((card) => (
        <Card key={card.key} className="flex h-full min-w-0 flex-col justify-between">
          <CardHeader className="gap-2">
            <div className="flex h-10 items-start justify-between gap-2">
              <CardDescription className="line-clamp-2 leading-5">
                {card.title}
              </CardDescription>
              <card.icon
                className={cn("size-4 shrink-0 text-muted-foreground", card.iconClass)}
              />
            </div>
            <CardTitle className={cn("text-xl tabular-nums break-all sm:text-2xl", card.valueClass)}>
              {hydrated ? card.value : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-auto">
            <p className="min-h-[2.5rem] text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
