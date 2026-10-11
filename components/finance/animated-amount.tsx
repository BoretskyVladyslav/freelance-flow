"use client";

import { useCountUp } from "@/hooks/use-count-up";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/finance";

type AnimatedAmountProps = {
  amount: number;
  currency: Currency;
  ready: boolean;
  className?: string;
};

function AnimatedAmountLive({
  amount,
  currency,
  className,
}: Omit<AnimatedAmountProps, "ready">) {
  const animated = useCountUp(amount, { duration: 400, decimals: 2 });
  const finalText = formatMoney(amount, currency);
  const liveText = formatMoney(animated, currency);

  return (
    <span className={cn("inline-grid max-w-full align-bottom", className)}>
      <span className="sr-only">{finalText}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1 truncate">
        {finalText}
      </span>
      <span aria-hidden className="col-start-1 row-start-1 truncate tabular-nums">
        {liveText}
      </span>
    </span>
  );
}

export function AnimatedAmount({ amount, currency, ready, className }: AnimatedAmountProps) {
  if (!ready) {
    return <span className={className}>—</span>;
  }

  return <AnimatedAmountLive amount={amount} currency={currency} className={className} />;
}
