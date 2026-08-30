"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleHelp } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFinance } from "@/components/finance/finance-provider";
import { resolveRate } from "@/lib/exchange-rates";
import { formatMoney, formatRate } from "@/lib/format";
import {
  PLATFORM_LABELS,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
} from "@/lib/labels";
import { calculateTransaction, convertToDisplay } from "@/lib/tax-calculator";
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
  startDate: string;
  endDate: string;
  payoutDate: string;
  status: PaymentStatus;
  notes: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  platform: "Direct Client",
  grossAmount: "",
  currency: "UAH",
  customFee: "0",
  startDate: "",
  endDate: "",
  payoutDate: "",
  status: "In Progress",
  notes: "",
};

const CURRENCY_ITEMS = Object.fromEntries(
  CURRENCIES.map((currency) => [currency, currency]),
) as Record<Currency, string>;

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
        startDate: (transaction.startDate || transaction.date).slice(0, 10),
        endDate: transaction.endDate?.slice(0, 10) ?? "",
        payoutDate: transaction.payoutDate?.slice(0, 10) ?? "",
        status: transaction.status,
        notes: transaction.notes ?? "",
      });
      return;
    }
    setForm({ ...EMPTY_FORM, startDate: todayIsoDate() });
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
  const previewRates = useMemo(
    () => ({
      ...rates,
      toEur: { ...rates.toEur, [form.currency]: lockedRate },
    }),
    [form.currency, lockedRate, rates],
  );

  function formatPreviewAmount(amountEur: number): string {
    return formatMoney(
      convertToDisplay(amountEur, form.currency, previewRates),
      form.currency,
    );
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(): string | null {
    if (!form.title.trim()) return "Назва проєкту обовʼязкова.";
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      return "Сума Gross має бути більшою за 0.";
    }
    if (!Number.isFinite(customFee) || customFee < 0) {
      return "Комісія не може бути відʼємною.";
    }
    if (customFee > grossAmount) return "Комісія не може перевищувати суму Gross.";
    if (!form.startDate) return "Дата початку обовʼязкова.";
    if (form.endDate && form.endDate < form.startDate) {
      return "Дата завершення не може бути раніше дати початку.";
    }
    if (form.payoutDate && form.payoutDate < form.startDate) {
      return "Дата виплати не може бути раніше дати початку.";
    }
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
      date: form.startDate,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      payoutDate: form.payoutDate || undefined,
      status: form.status,
      notes: form.notes,
      exchangeRateAtCreation: lockedRate,
    };

    if (transaction) {
      updateTransaction(transaction.id, {
        ...payload,
        weekNumber: isoWeekFromIsoDate(form.startDate),
      });
      toast.success("Проєкт оновлено.");
    } else {
      addTransaction(payload);
      toast.success("Проєкт додано.");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-dvh max-h-dvh flex-col gap-0 overflow-hidden p-0 md:h-auto md:max-h-[min(90vh,calc(100dvh-2rem))] md:max-w-2xl"
        showCloseButton
      >
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-2">
          <DialogHeader className="pr-8">
            <DialogTitle>{editing ? "Редагувати проєкт" : "Швидке додавання"}</DialogTitle>
            <DialogDescription>
              Суми зберігаються в оригінальній валюті. Курс до EUR фіксується на дату створення.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <div className="flex h-5 items-center">
                <Label htmlFor="title">Назва проєкту</Label>
              </div>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Лендінг для клієнта"
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex h-5 items-center">
                <Label htmlFor="platform">Платформа</Label>
              </div>
              <Select
                value={form.platform}
                items={PLATFORM_LABELS}
                onValueChange={(value) => value && setField("platform", value as Platform)}
              >
                <SelectTrigger id="platform" className="w-full">
                  <SelectValue>
                    {(value: Platform | null) =>
                      value ? PLATFORM_LABELS[value] : PLATFORM_LABELS[form.platform]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {PLATFORM_LABELS[platform]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <div className="flex h-5 items-center">
                <Label htmlFor="status">Статус</Label>
              </div>
              <Select
                value={form.status}
                items={STATUS_LABELS}
                onValueChange={(value) => value && setField("status", value as PaymentStatus)}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue>
                    {(value: PaymentStatus | null) =>
                      value ? STATUS_LABELS[value] : STATUS_LABELS[form.status]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {PAYMENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <div className="flex h-5 items-center">
                <Label htmlFor="gross">Сума Gross</Label>
              </div>
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
              <div className="flex h-5 items-center">
                <Label htmlFor="currency">Валюта</Label>
              </div>
              <Select
                value={form.currency}
                items={CURRENCY_ITEMS}
                onValueChange={(value) => value && setField("currency", value as Currency)}
              >
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue>
                    {(value: Currency | null) => value ?? form.currency}
                  </SelectValue>
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
              <div className="flex h-5 items-center gap-1.5">
                <Label htmlFor="fee">Комісія</Label>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Пояснення комісії"
                      />
                    }
                  >
                    <CircleHelp className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">
                    Комісія біржі, банку або платіжної системи, що віднімається до
                    розрахунку податків
                  </TooltipContent>
                </Tooltip>
              </div>
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
              <div className="flex h-5 items-center">
                <Label htmlFor="startDate">Дата початку</Label>
              </div>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(event) => setField("startDate", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex h-5 items-center">
                <Label htmlFor="endDate">Дата завершення</Label>
              </div>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(event) => setField("endDate", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex h-5 items-center">
                <Label htmlFor="payoutDate">Дата виплати</Label>
              </div>
              <Input
                id="payoutDate"
                type="date"
                value={form.payoutDate}
                onChange={(event) => setField("payoutDate", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <div className="flex h-5 items-center">
                <Label htmlFor="notes">Нотатки</Label>
              </div>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
                placeholder="Необовʼязково"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{STATUS_DESCRIPTIONS[form.status]}</p>

          <p className="text-xs text-muted-foreground">
            Зафіксований курс EUR: {formatRate(lockedRate)} · ISO-тиждень{" "}
            {form.startDate ? isoWeekFromIsoDate(form.startDate) : "—"}
          </p>

          {preview ? (
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">База ({form.currency})</div>
                <div className="tabular-nums">
                  {formatPreviewAmount(preview.taxableBase)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Іспанія 19% ({form.currency})</div>
                <div className="tabular-nums">
                  {formatPreviewAmount(preview.spainTax)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Фірма 30% ({form.currency})</div>
                <div className="tabular-nums">
                  {formatPreviewAmount(preview.companyTax)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Net ({form.currency})</div>
                <div className="tabular-nums font-medium">
                  {formatPreviewAmount(preview.netPayout)}
                </div>
              </div>
            </div>
          ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit">{editing ? "Зберегти" : "Додати проєкт"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
