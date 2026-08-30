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
    <Card className="min-w-0 overflow-hidden print:hidden">
      <CardHeader className="gap-1">
        <CardTitle>Динаміка доходів</CardTitle>
        <CardDescription>
          Валовий дохід (Gross) проти чистої виплати (Net) у {displayCurrency}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3">
        <div className="h-56 w-full min-w-0 md:h-72">
          {hydrated && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barGap={4} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis
                  allowDuplicatedCategory={false}
                  allowDecimals={false}
                  tickCount={4}
                  minTickGap={16}
                  interval="preserveStartEnd"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fontSize: 11 }}
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
                <Bar dataKey="gross" name="Gross" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Net" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Додайте проєкт, щоб побачити графік динаміки доходів.
            </div>
          )}
        </div>
        <div className="grid w-full grid-cols-3 gap-2" role="group" aria-label="Період графіка">
          {periodOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={period === option.value ? "default" : "outline"}
              className="h-8 min-w-0 px-1 text-[11px] leading-tight sm:text-sm"
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
