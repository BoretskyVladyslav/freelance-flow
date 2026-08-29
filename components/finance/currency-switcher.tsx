"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Currency } from "@/types/finance";

type CurrencySwitcherProps = {
  value: Currency;
  onChange: (currency: Currency) => void;
};

export function CurrencySwitcher({ value, onChange }: CurrencySwitcherProps) {
  return (
    <div
      className="inline-flex rounded-lg border bg-background p-0.5"
      role="group"
      aria-label="Валюта відображення"
    >
      {(["UAH", "EUR"] as const).map((currency) => (
        <Button
          key={currency}
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={value === currency}
          className={cn("h-7 px-3", value === currency && "bg-primary text-primary-foreground")}
          onClick={() => onChange(currency)}
        >
          {currency}
        </Button>
      ))}
    </div>
  );
}
