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
  startDate: todayIsoDate(),
  endDate: "",
  payoutDate: "",
  status: "In Progress",
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
        className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-2xl"
        showCloseButton
      >
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Редагувати проєкт" : "Швидке додавання"}</DialogTitle>
            <DialogDescription>
              Суми зберігаються в оригінальній валюті. Курс до EUR фіксується на дату створення.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="title">Назва проєкту</Label>
              <Input
                id="title"
                autoFocus
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Лендінг для клієнта"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="platform">Платформа</Label>
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
                      {PLATFORM_LABELS[platform]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="status">Статус</Label>
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
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {STATUS_DESCRIPTIONS[form.status]}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gross">Сума Gross</Label>
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
              <Label htmlFor="currency">Валюта</Label>
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
              <div className="flex items-center gap-1.5">
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
              <Label htmlFor="startDate">Дата початку</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(event) => setField("startDate", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="endDate">Дата завершення</Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(event) => setField("endDate", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="payoutDate">Дата виплати</Label>
              <Input
                id="payoutDate"
                type="date"
                value={form.payoutDate}
                onChange={(event) => setField("payoutDate", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="notes">Нотатки</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
                placeholder="Необовʼязково"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Зафіксований курс EUR: {formatRate(lockedRate)} · ISO-тиждень{" "}
            {form.startDate ? isoWeekFromIsoDate(form.startDate) : "—"}
          </p>

          {preview ? (
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">База</div>
                <div className="tabular-nums">{formatMoney(preview.taxableBase)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Іспанія 19%</div>
                <div className="tabular-nums">{formatMoney(preview.spainTax)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Фірма 30%</div>
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
              Скасувати
            </Button>
            <Button type="submit">{editing ? "Зберегти" : "Додати проєкт"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
