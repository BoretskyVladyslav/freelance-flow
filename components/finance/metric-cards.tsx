"use client";

import { useMemo } from "react";

import {
  Building2,
  Landmark,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinance } from "@/components/finance/finance-provider";
import { formatMoney, formatMonthlyEsvNote } from "@/lib/format";
import {
  netAfterMonthlyEsv,
  shouldApplyMonthlyEsv,
} from "@/lib/tax-calculator";
import { cn } from "@/lib/utils";

export function MetricCards() {
  const {
    displayTotals,
    displayCurrency,
    hydrated,
    isAdmin,
    teamScope,
    filters,
    rates,
  } = useFinance();
  const showEsv = shouldApplyMonthlyEsv(filters);
  const netAfterEsv = showEsv
    ? netAfterMonthlyEsv(displayTotals.netPayout, displayCurrency, rates)
    : null;

  const cards = useMemo<
    Array<{
      key: string;
      title: string;
      value: string;
      description: string;
      icon: LucideIcon;
      valueClass?: string;
    }>
  >(
    () => [
    {
      key: "gross",
      title: "Загальний дохід (Gross)",
      value: formatMoney(displayTotals.grossInBase, displayCurrency),
      description: "Конвертовано у вибрану валюту від бази EUR.",
      icon: Wallet,
    },
    {
      key: "spain",
      title: "Податки (ФОП / Резерв)",
      value: formatMoney(displayTotals.spainTax, displayCurrency),
      description: isAdmin && teamScope === "all"
        ? "Агрегація по компанії. Кожен проєкт рахується за своєю моделлю (ФОП 6% або Іспанія 19%)."
        : "Кожен проєкт рахується за своєю моделлю (ФОП 6% або Іспанія 19%).",
      icon: Landmark,
    },
    {
      key: "company",
      title: "Податок фірми (30%)",
      value: formatMoney(displayTotals.companyTax, displayCurrency),
      description: isAdmin && teamScope === "all"
        ? "Агрегація по компанії. ФОП: 30% від бази. Іспанія: 30% після податку."
        : "ФОП: 30% від бази. Іспанія: 30% після податку.",
      icon: Building2,
      valueClass: "text-rose-600 dark:text-rose-400",
    },
    {
      key: "net",
      title: "Чистий дохід до виплати (Net)",
      value: formatMoney(displayTotals.netPayout, displayCurrency),
      description: isAdmin && teamScope === "all"
        ? `Чистий дохід по компанії. До виплати: ${formatMoney(displayTotals.remainingToBePaid, displayCurrency)}`
        : `Чистий дохід за вашими проєктами. До виплати: ${formatMoney(displayTotals.remainingToBePaid, displayCurrency)}`,
      icon: Wallet,
      valueClass: "text-emerald-600 dark:text-emerald-400",
    },
    ],
    [
      displayCurrency,
      displayTotals.companyTax,
      displayTotals.grossInBase,
      displayTotals.netPayout,
      displayTotals.remainingToBePaid,
      displayTotals.spainTax,
      isAdmin,
      teamScope,
    ],
  );

  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className="grid min-w-0 grid-cols-2 items-stretch gap-3 md:grid-cols-4 md:gap-4"
    >
      {cards.map((card) => (
        <Card
          key={card.key}
          className="flex h-full min-w-0 flex-col justify-between [--card-spacing:--spacing(3)] md:[--card-spacing:--spacing(4)]"
        >
          <CardHeader className="gap-2">
            <div className="flex h-8 items-start justify-between gap-2 md:h-10">
              <CardDescription className="line-clamp-2 text-xs leading-4 md:text-sm md:leading-5">
                {card.title}
              </CardDescription>
              <card.icon className="size-4 shrink-0 text-muted-foreground" />
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
      {showEsv ? (
        <Card className="col-span-2 flex h-full min-w-0 flex-col justify-between [--card-spacing:--spacing(3)] md:col-span-4 md:[--card-spacing:--spacing(4)]">
          <CardHeader className="gap-2">
            <CardDescription className="text-xs leading-4 md:text-sm md:leading-5">
              {formatMonthlyEsvNote()}
            </CardDescription>
            <CardTitle className="text-xl font-bold leading-snug tabular-nums text-emerald-600 sm:text-2xl dark:text-emerald-400">
              {hydrated && netAfterEsv !== null
                ? `Чистий залишок після ЄСВ: ${formatMoney(netAfterEsv, displayCurrency)}`
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      ) : null}
    </section>
  );
}
