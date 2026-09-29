"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleHelp, User } from "lucide-react";
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
import { formatAmountWithUahApprox, formatRate, formatWeekSpan } from "@/lib/format";
import {
  PLATFORM_LABELS,
  STATUS_DESCRIPTIONS,
  STATUS_LABELS,
  TAX_MODEL_LABELS,
} from "@/lib/labels";
import { applyEndDateChange, applyStatusChange } from "@/lib/project-automation";
import { calculateTransaction, convertToDisplay, resolveUahSnapshot, taxModelLabel } from "@/lib/tax-calculator";
import { isoWeekFromIsoDate, todayIsoDate, weekKeyFromIsoDate } from "@/lib/week";
import {
  CURRENCIES,
  PAYMENT_STATUSES,
  PLATFORMS,
  TAX_MODELS,
  defaultTaxModelForCreator,
  getTaxModel,
  isPaymentStatus,
  isTaxModel,
  type Currency,
  type PaymentStatus,
  type Platform,
  type TaxModel,
  type Transaction,
} from "@/types/finance";

type FormState = {
  title: string;
  clientName: string;
  platform: Platform;
  grossAmount: string;
  currency: Currency;
  customFee: string;
  startDate: string;
  endDate: string;
  payoutDate: string;
  status: PaymentStatus;
  notes: string;
  tax_model: TaxModel;
};

const EMPTY_FORM: FormState = {
  title: "",
  clientName: "",
  platform: "Direct Client",
  grossAmount: "",
  currency: "UAH",
  customFee: "0",
  startDate: "",
  endDate: "",
  payoutDate: "",
  status: "In Progress",
  notes: "",
  tax_model: "fop_3",
};

const CURRENCY_ITEMS = Object.fromEntries(
  CURRENCIES.map((currency) => [currency, currency]),
) as Record<Currency, string>;

const TAX_MODEL_ITEMS = { ...TAX_MODEL_LABELS };

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
  const { addTransaction, updateTransaction, rates, isAdmin, currentUserEmail } = useFinance();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const editing = Boolean(transaction);

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      setForm({
        title: transaction.title,
        clientName: transaction.client_name ?? transaction.clientName ?? "",
        platform: transaction.platform,
        grossAmount: String(transaction.grossAmount),
        currency: transaction.currency,
        customFee: String(transaction.customFee),
        startDate: (transaction.startDate || transaction.date).slice(0, 10),
        endDate: transaction.endDate?.slice(0, 10) ?? "",
        payoutDate: transaction.payoutDate?.slice(0, 10) ?? "",
        status: transaction.status,
        notes: transaction.notes ?? "",
        tax_model: getTaxModel(transaction),
      });
      return;
    }
    setForm({
      ...EMPTY_FORM,
      startDate: todayIsoDate(),
      tax_model: defaultTaxModelForCreator({ isAdmin, email: currentUserEmail }),
    });
  }, [currentUserEmail, isAdmin, open, transaction]);

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
          tax_model: form.tax_model,
        },
        rates.toEur[form.currency],
      );
    } catch {
      return null;
    }
  }, [customFee, form.currency, form.tax_model, grossAmount, lockedRate, rates.toEur]);
  const previewRates = useMemo(
    () => ({
      ...rates,
      toEur: { ...rates.toEur, [form.currency]: lockedRate },
    }),
    [form.currency, lockedRate, rates],
  );

  const formatPreviewAmount = useCallback(
    (amountEur: number): string => {
      const original = convertToDisplay(amountEur, form.currency, previewRates);
      const uah = convertToDisplay(amountEur, "UAH", previewRates);
      return formatAmountWithUahApprox(original, form.currency, uah);
    },
    [form.currency, previewRates],
  );

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const handleEndDateChange = useCallback((value: string) => {
    setForm((current) => ({
      ...current,
      ...applyEndDateChange(current.status, value),
    }));
  }, []);

  const handleStatusChange = useCallback((nextStatus: PaymentStatus) => {
    setForm((current) => ({
      ...current,
      ...applyStatusChange(nextStatus, current.endDate, todayIsoDate()),
    }));
  }, []);

  const onFormFieldEvent = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
      return;
    }
    if (target.name === "end_date") {
      handleEndDateChange(target.value);
      return;
    }
    if (target.name === "status" && isPaymentStatus(target.value)) {
      handleStatusChange(target.value);
    }
  }, [handleEndDateChange, handleStatusChange]);

  const validate = useCallback((): string | null => {
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
  }, [customFee, form.endDate, form.payoutDate, form.startDate, form.title, grossAmount]);

  const onSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const clientName = form.clientName.trim();
    const uahSnapshot = preview
      ? resolveUahSnapshot({
          grossAmount,
          currency: form.currency,
          netPayoutEur: preview.netPayout,
          exchangeRateAtCreation: lockedRate,
          rates,
          uahRateAtCreation:
            transaction && transaction.currency === form.currency
              ? transaction.uahRateAtCreation
              : undefined,
        })
      : undefined;
    const payload = {
      title: form.title.trim(),
      clientName: clientName || undefined,
      client_name: clientName || null,
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
      tax_model: form.tax_model,
      exchangeRateAtCreation: lockedRate,
      uahRateAtCreation: uahSnapshot?.uahRateAtCreation,
      gross_uah: uahSnapshot?.gross_uah,
      net_uah: uahSnapshot?.net_uah,
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
  }, [
    addTransaction,
    form.clientName,
    form.currency,
    form.endDate,
    form.notes,
    form.payoutDate,
    form.platform,
    form.startDate,
    form.status,
    form.tax_model,
    form.title,
    grossAmount,
    customFee,
    lockedRate,
    onOpenChange,
    preview,
    rates,
    transaction,
    updateTransaction,
    validate,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-dvh max-h-dvh flex-col gap-0 overflow-hidden p-0 md:h-auto md:max-h-[min(90vh,calc(100dvh-2rem))] md:max-w-2xl"
        showCloseButton
      >
        <form
          onSubmit={onSubmit}
          onChange={onFormFieldEvent}
          onInput={onFormFieldEvent}
          className="flex min-h-0 flex-1 flex-col"
        >
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
            <div className="grid gap-1.5 sm:col-span-2">
              <div className="flex h-5 items-center">
                <Label htmlFor="client_name">Клієнт / Компанія</Label>
              </div>
              <div className="relative">
                <Input
                  id="client_name"
                  value={form.clientName}
                  onChange={(event) => setField("clientName", event.target.value)}
                  placeholder="напр. TechCorp, Upwork Client, Олександр"
                  className="pl-9"
                />
                <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
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
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={(event) => {
                  if (isPaymentStatus(event.target.value)) {
                    handleStatusChange(event.target.value);
                  }
                }}
                className="h-8 min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-8 md:text-sm dark:bg-input/30"
              >
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
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
            {isAdmin ? (
            <div className="grid gap-1.5">
              <div className="flex h-5 items-center">
                <Label htmlFor="tax_model">Модель податку</Label>
              </div>
              <Select
                value={form.tax_model}
                items={TAX_MODEL_ITEMS}
                onValueChange={(value) => value && isTaxModel(value) && setField("tax_model", value)}
              >
                <SelectTrigger id="tax_model" className="w-full">
                  <SelectValue>
                    {(value: TaxModel | null) =>
                      value ? TAX_MODEL_LABELS[value] : TAX_MODEL_LABELS[form.tax_model]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {TAX_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {TAX_MODEL_LABELS[model]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            ) : null}
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
              <input
                id="endDate"
                name="end_date"
                type="date"
                value={form.endDate}
                onChange={(event) => handleEndDateChange(event.target.value)}
                className="h-8 min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-8 md:text-sm dark:bg-input/30"
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
            Зафіксований курс EUR: {formatRate(lockedRate)} ·{" "}
            {form.startDate
              ? formatWeekSpan(weekKeyFromIsoDate(form.startDate))
              : "—"}
          </p>

          {preview ? (
            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">База</div>
                <div className="tabular-nums">
                  {formatPreviewAmount(preview.taxableBase)}
                </div>
              </div>
              {form.tax_model === "fop_3" ? (
                <>
                  <div>
                    <div className="text-muted-foreground">Фірма 30%</div>
                    <div className="tabular-nums">
                      {formatPreviewAmount(preview.companyTax)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{taxModelLabel(form.tax_model)}</div>
                    <div className="tabular-nums">
                      {formatPreviewAmount(preview.spainTax)}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-muted-foreground">{taxModelLabel(form.tax_model)}</div>
                    <div className="tabular-nums">
                      {formatPreviewAmount(preview.spainTax)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Фірма 30%</div>
                    <div className="tabular-nums">
                      {formatPreviewAmount(preview.companyTax)}
                    </div>
                  </div>
                </>
              )}
              <div>
                <div className="text-muted-foreground">Net</div>
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
