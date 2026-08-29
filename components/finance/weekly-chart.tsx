"use client";

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
import { formatMoney } from "@/lib/format";

export function WeeklyChart() {
  const { weekly, displayCurrency, hydrated } = useFinance();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Динаміка за тижнями</CardTitle>
        <CardDescription>
          Валовий дохід (Gross) проти чистої виплати (Net) за тижнями.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          {hydrated && weekly.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat("uk-UA", { notation: "compact" }).format(value)
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
