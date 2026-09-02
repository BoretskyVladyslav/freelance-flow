"use client";

import { formatDate, formatDateDayMonth } from "@/lib/format";
import { useMounted } from "@/hooks/use-mounted";

type FormattedDateProps = {
  value: string;
  variant?: "full" | "day-month";
};

export function FormattedDate({ value, variant = "full" }: FormattedDateProps) {
  const mounted = useMounted();
  const fallback = value.slice(0, 10);
  const formatted =
    variant === "day-month" ? formatDateDayMonth(value) : formatDate(value);
  return <>{mounted ? formatted : fallback}</>;
}
