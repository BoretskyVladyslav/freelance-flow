"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFinance } from "@/components/finance/finance-provider";
import { Button } from "@/components/ui/button";
import { chartSeries, type ChartPeriod } from "@/lib/aggregates";
import { formatCompactMoney, formatMoney } from "@/lib/format";

export function WeeklyChart() {
  const { views, rates, displayCurrency, hydrated } = useFinance();
  const [period, setPeriod] = useState<ChartPeriod>("week");
  const data = useMemo(
    () => chartSeries(views, displayCurrency, rates, period),
    [displayCurrency, period, rates, views],
  );
  const periodOptions: Array<{ value: ChartPeriod; label: string }> = [
    { value: "3d", label: "Останні 3 дні" },
    { value: "week", label: "За тижнями" },
    { value: "month", label: "За місяцями" },
  ];

  return (
    <Card className="print:hidden">
      <CardHeader className="gap-3">
        <div>
        <CardTitle>Динаміка доходів</CardTitle>
        <CardDescription>
          Валовий дохід (Gross) проти чистої виплати (Net) у {displayCurrency}.
        </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Період графіка">
          {periodOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={period === option.value ? "default" : "outline"}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          {hydrated && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(value: number) =>
                    formatCompactMoney(value, displayCurrency)
                  }
                />
                <Tooltip
                  formatter={(value) =>
                    formatMoney(typeof value === "number" ? value : Number(value), displayCurrency)
                  }
                />
                <Legend />
                <Bar dataKey="gross" name="Gross" fill="#3b6cb5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net" fill="#2a9d8f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Додайте проєкт, щоб побачити графік динаміки доходів.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
