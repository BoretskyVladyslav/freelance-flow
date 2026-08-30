"use client";

import { formatDate } from "@/lib/format";
import { useMounted } from "@/hooks/use-mounted";

type FormattedDateProps = {
  value: string;
};

export function FormattedDate({ value }: FormattedDateProps) {
  const mounted = useMounted();
  const fallback = value.slice(0, 10);
  return <>{mounted ? formatDate(value) : fallback}</>;
}
