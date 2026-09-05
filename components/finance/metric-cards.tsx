"use client";

import {
  Building2,
  Landmark,
  Receipt,
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
  const {
    displayTotals,
    displayCurrency,
    hydrated,
    isAdmin,
    teamScope,
    totalExpensesInDisplay,
    trueNetPayout,
  } = useFinance();
  const gain = displayTotals.currencyGainLoss;
  const gainNegative = gain < 0;

  const cards: Array<{
    key: string;
    title: string;
    value: string;
    description: string;
    icon: LucideIcon;
    iconClass?: string;
    valueClass?: string;
    span?: string;
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
      valueClass: "text-rose-600 dark:text-rose-400",
    },
    {
      key: "opex",
      title: "Операційні витрати",
      value: formatMoney(totalExpensesInDisplay, displayCurrency),
      description: "Підписки, хостинг та інструменти команди за вибраний період.",
      icon: Receipt,
      iconClass: "text-rose-600 dark:text-rose-400",
      valueClass: "text-rose-600 dark:text-rose-400",
    },
    {
      key: "net",
      title: "Чистий дохід до виплати (Net)",
      value: formatMoney(trueNetPayout, displayCurrency),
      description: `True Net Profit (після OpEx). До виплати: ${formatMoney(displayTotals.remainingToBePaid, displayCurrency)}`,
      icon: Wallet,
      valueClass: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "fx",
      title: "Курсова різниця",
      value: formatSignedMoney(gain, displayCurrency),
      description: "Різниця між актуальним курсом і курсом на момент створення.",
      icon: gainNegative ? TrendingDown : TrendingUp,
      iconClass: "text-muted-foreground",
      valueClass: "text-muted-foreground",
      span: "col-span-2 bg-muted/50 xl:col-span-1 xl:bg-transparent",
    },
  ];

  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className="grid min-w-0 grid-cols-2 items-stretch gap-3 md:gap-4 xl:grid-cols-6"
    >
      {cards.map((card) => (
        <Card
          key={card.key}
          className={cn(
            "flex h-full min-w-0 flex-col justify-between [--card-spacing:--spacing(3)] md:[--card-spacing:--spacing(4)]",
            card.span,
          )}
        >
          <CardHeader className="gap-2">
            <div className="flex h-8 items-start justify-between gap-2 md:h-10">
              <CardDescription className="line-clamp-2 text-xs leading-4 md:text-sm md:leading-5">
                {card.title}
              </CardDescription>
              <card.icon
                className={cn("size-4 shrink-0 text-muted-foreground", card.iconClass)}
              />
            </div>
            <CardTitle
              className={cn(
                "truncate whitespace-nowrap text-2xl font-bold leading-none tabular-nums sm:text-3xl print:text-2xl md:text-2xl",
                card.valueClass,
              )}
            >
              {hydrated ? card.value : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-auto">
            <p className="hidden min-h-[2.5rem] text-xs text-muted-foreground md:block">
              {hydrated ? card.description : ""}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
