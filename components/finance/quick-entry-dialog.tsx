"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFinance } from "@/components/finance/finance-provider";
import { resolveRate } from "@/lib/exchange-rates";
import { formatMoney, formatRate } from "@/lib/format";
import { calculateTransaction } from "@/lib/tax-calculator";
import { isoWeekFromIsoDate, todayIsoDate } from "@/lib/week";
import {
  CURRENCIES,
  PAYMENT_STATUSES,
  PLATFORMS,
  type Currency,
  type PaymentStatus,
  type Platform,
  type Transaction,
} from "@/types/finance";

type FormState = {
  title: string;
  platform: Platform;
  grossAmount: string;
  currency: Currency;
  customFee: string;
  date: string;
  status: PaymentStatus;
  notes: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  platform: "Direct Client",
  grossAmount: "",
  currency: "EUR",
  customFee: "0",
  date: todayIsoDate(),
  status: "Paid",
  notes: "",
};

type QuickEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
};

export function QuickEntryDialog({
  open,
  onOpenChange,
  transaction,
}: QuickEntryDialogProps) {
  const { addTransaction, updateTransaction, rates } = useFinance();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const editing = Boolean(transaction);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setForm({
        title: transaction.title,
        platform: transaction.platform,
        grossAmount: String(transaction.grossAmount),
        currency: transaction.currency,
        customFee: String(transaction.customFee),
        date: transaction.date.slice(0, 10),
        status: transaction.status,
        notes: transaction.notes ?? "",
      });
      return;
    }
    setForm({ ...EMPTY_FORM, date: todayIsoDate() });
  }, [open, transaction]);

  const grossAmount = Number(form.grossAmount);
  const customFee = Number(form.customFee);
  const lockedRate = useMemo(() => {
    if (transaction && transaction.currency === form.currency) {
      return transaction.exchangeRateAtCreation;
    }
    return resolveRate(form.currency, rates);
  }, [form.currency, rates, transaction]);

  const preview = useMemo(() => {
    if (!Number.isFinite(grossAmount) || grossAmount < 0) return null;
    if (!Number.isFinite(customFee) || customFee < 0) return null;
    try {
      return calculateTransaction(
        {
          grossAmount,
          customFee,
          currency: form.currency,
          exchangeRateAtCreation: lockedRate,
        },
        rates.toEur[form.currency],
      );
    } catch {
      return null;
    }
  }, [customFee, form.currency, grossAmount, lockedRate, rates.toEur]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): string | null {
    if (!form.title.trim()) return "Project name is required.";
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      return "Gross amount must be greater than 0.";
    }
    if (!Number.isFinite(customFee) || customFee < 0) {
      return "Fee cannot be negative.";
    }
    if (customFee > grossAmount) return "Fee cannot exceed gross amount.";
    if (!form.date) return "Date is required.";
    return null;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const payload = {
      title: form.title.trim(),
      platform: form.platform,
      grossAmount,
      currency: form.currency,
      customFee,
      date: form.date,
      status: form.status,
      notes: form.notes,
      exchangeRateAtCreation: lockedRate,
    };

    if (transaction) {
      updateTransaction(transaction.id, {
        ...payload,
        weekNumber: isoWeekFromIsoDate(form.date),
      });
      toast.success("Project updated.");
    } else {
      addTransaction(payload);
      toast.success("Project added.");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit project" : "Quick entry"}</DialogTitle>
            <DialogDescription>
              Amounts stay in original currency. EUR conversion is locked at creation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="title">Project name</Label>
              <Input
                id="title"
                autoFocus
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Landing page for Acme"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={form.platform}
                onValueChange={(value) => value && setField("platform", value as Platform)}
              >
                <SelectTrigger id="platform" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => value && setField("status", value as PaymentStatus)}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {PAYMENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gross">Gross amount</Label>
              <Input
                id="gross"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.grossAmount}
                onChange={(event) => setField("grossAmount", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(value) => value && setField("currency", value as Currency)}
              >
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fee">Custom fee</Label>
              <Input
                id="fee"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.customFee}
                onChange={(event) => setField("customFee", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(event) => setField("date", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Locked EUR rate: {formatRate(lockedRate)} · ISO week {form.date ? isoWeekFromIsoDate(form.date) : "—"}
          </p>

          {preview ? (
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">Taxable</div>
                <div className="tabular-nums">{formatMoney(preview.taxableBase)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Spain 19%</div>
                <div className="tabular-nums">{formatMoney(preview.spainTax)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Company 30%</div>
                <div className="tabular-nums">{formatMoney(preview.companyTax)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Net</div>
                <div className="tabular-nums font-medium">{formatMoney(preview.netPayout)}</div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Save changes" : "Add project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
