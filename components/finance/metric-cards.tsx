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
      title: "Total Gross Revenue",
      value: formatMoney(displayTotals.grossInBase, displayCurrency),
      description: "Converted to display currency from EUR base.",
      icon: Wallet,
    },
    {
      key: "spain",
      title: "Total Spain Tax (19%)",
      value: formatMoney(displayTotals.spainTax, displayCurrency),
      description: "Applied to taxable base after fees.",
      icon: Landmark,
    },
    {
      key: "company",
      title: "Total Company Tax (30%)",
      value: formatMoney(displayTotals.companyTax, displayCurrency),
      description: "Applied after Spanish tax.",
      icon: Building2,
    },
    {
      key: "net",
      title: "Total Net Payout",
      value: formatMoney(displayTotals.netPayout, displayCurrency),
      description: `Remaining to be paid: ${formatMoney(displayTotals.remainingToBePaid, displayCurrency)}`,
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
            <CardDescription>Currency Gain / Loss</CardDescription>
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
            Live-rate net versus locked creation-rate net.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
