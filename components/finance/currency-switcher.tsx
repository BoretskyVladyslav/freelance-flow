"use client";

import { CURRENCIES, type Currency } from "@/types/finance";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CurrencySwitcherProps = {
  value: Currency;
  onChange: (currency: Currency) => void;
};

export function CurrencySwitcher({ value, onChange }: CurrencySwitcherProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as Currency);
      }}
    >
      <SelectTrigger aria-label="Display currency" className="min-w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        {CURRENCIES.map((currency) => (
          <SelectItem key={currency} value={currency}>
            {currency}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
