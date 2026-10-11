"use client";

import type { ReactNode } from "react";
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

function AmountFrame({
  finalText,
  className,
  busy,
  children,
}: {
  finalText: string;
  className?: string;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-grid max-w-full min-w-[8ch] align-bottom transition-all duration-300 ease-out",
        className,
      )}
      aria-busy={busy || undefined}
    >
      <span className="sr-only">{busy ? "Завантаження суми" : finalText}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1 truncate tabular-nums">
        {finalText}
      </span>
      {children}
    </span>
  );
}

function AnimatedAmountLive({
  amount,
  currency,
  className,
}: Omit<AnimatedAmountProps, "ready">) {
  const animated = useCountUp(amount, { duration: 500, decimals: 2 });
  const finalText = formatMoney(amount, currency);
  const liveText = formatMoney(animated, currency);

  return (
    <AmountFrame finalText={finalText} className={className}>
      <span aria-hidden className="col-start-1 row-start-1 truncate tabular-nums">
        {liveText}
      </span>
    </AmountFrame>
  );
}

function AmountSkeleton({
  amount,
  currency,
  className,
}: Omit<AnimatedAmountProps, "ready">) {
  const finalText = formatMoney(amount, currency);

  return (
    <AmountFrame finalText={finalText} className={className} busy>
      <span
        aria-hidden
        className="relative col-start-1 row-start-1 block h-full overflow-hidden rounded-md bg-muted"
      >
        <span className="ff-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
      </span>
    </AmountFrame>
  );
}

export function AnimatedAmount({ amount, currency, ready, className }: AnimatedAmountProps) {
  if (!ready) {
    return <AmountSkeleton amount={amount} currency={currency} className={className} />;
  }

  return <AnimatedAmountLive amount={amount} currency={currency} className={className} />;
}
