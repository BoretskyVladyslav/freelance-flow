"use client";

import {
  Building2,
  Landmark,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinance } from "@/components/finance/finance-provider";
import { formatMoney, formatSignedMoney } from "@/lib/format";

export function MetricCards() {
  const { displayTotals, displayCurrency, hydrated } = useFinance();
  const gain = displayTotals.currencyGainLoss;
  const gainPositive = gain > 0;
  const gainNegative = gain < 0;

  const cards = [
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
      description: "Нараховується на базу після вирахування комісій.",
      icon: Landmark,
    },
    {
      key: "company",
      title: "Податок фірми (30%)",
      value: formatMoney(displayTotals.companyTax, displayCurrency),
      description: "Нараховується на залишок після сплати іспанського податку.",
      icon: Building2,
    },
    {
      key: "net",
      title: "Чистий дохід до виплати (Net)",
      value: formatMoney(displayTotals.netPayout, displayCurrency),
      description: `Залишилось до виплати: ${formatMoney(displayTotals.remainingToBePaid, displayCurrency)}`,
      icon: Wallet,
    },
  ];

  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      {cards.map((card) => (
        <Card key={card.key}>
          <CardHeader className="gap-2">
            <div className="flex items-center justify-between gap-2">
              <CardDescription>{card.title}</CardDescription>
              <card.icon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl tabular-nums">
              {hydrated ? card.value : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-2">
            <CardDescription>Курсова різниця (Прибуток / Збиток)</CardDescription>
            {gainNegative ? (
              <TrendingDown className="size-4 text-destructive" />
            ) : (
              <TrendingUp className="size-4 text-muted-foreground" />
            )}
          </div>
          <CardTitle
            className={`text-2xl tabular-nums ${
              gainPositive ? "text-emerald-600 dark:text-emerald-400" : ""
            } ${gainNegative ? "text-destructive" : ""}`}
          >
            {hydrated ? formatSignedMoney(gain, displayCurrency) : "—"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Різниця між актуальним курсом і курсом на момент створення.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
