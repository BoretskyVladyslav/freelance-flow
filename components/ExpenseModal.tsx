"use client";

import { useState } from "react";
import { Receipt, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addExpense } from "@/services/supabase-expenses";
import { CURRENCIES, type Currency, type Expense } from "@/types/finance";
import { todayIsoDate } from "@/lib/week";

export interface ExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpenseAdded?: (expense: Expense) => void;
  defaultCurrency?: Currency;
}

const COMMON_EXPENSES = [
  "Cursor",
  "Vercel",
  "Figma",
  "Loom",
  "Kinsta",
  "WP Engine",
  "Imagify",
] as const;

export function ExpenseModal({
  open,
  onOpenChange,
  onExpenseAdded,
  defaultCurrency = "UAH",
}: ExpenseModalProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIsoDate());
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const numAmount = Number(amount);

    if (!cleanTitle) {
      toast.error("Введіть назву витрати");
      return;
    }

    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      toast.error("Сума повинна бути більшою за 0");
      return;
    }

    setSubmitting(true);
    try {
      const created = await addExpense({
        title: cleanTitle,
        amount: numAmount,
        currency,
        expense_date: date || todayIsoDate(),
      });

      toast.success(`Витрату «${cleanTitle}» додано`);
      setTitle("");
      setAmount("");
      setDate(todayIsoDate());
      onOpenChange(false);
      onExpenseAdded?.(created);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не вдалося зберегти витрату");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Додати операційну витрату</DialogTitle>
              <DialogDescription>
                Підписки, хостинг, інструменти розробки або інші витрати бізнесу
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Quick suggestions */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Швидкий вибір сервісу:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_EXPENSES.map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() => setTitle(service)}
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                    title === service
                      ? "border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-400 dark:bg-rose-950/60 dark:text-rose-300"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {service}
                </button>
              ))}
            </div>
          </div>

          {/* Title with datalist */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-title">Назва витрати</Label>
            <Input
              id="expense-title"
              list="expense-suggestions"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="напр. Cursor, Vercel Pro, Figma..."
              required
            />
            <datalist id="expense-suggestions">
              {COMMON_EXPENSES.map((service) => (
                <option key={service} value={service} />
              ))}
            </datalist>
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="expense-amount">Сума</Label>
              <Input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-currency">Валюта</Label>
              <select
                id="expense-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} className="dark:bg-slate-900">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="expense-date">Дата витрати</Label>
            <Input
              id="expense-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {submitting ? "Збереження..." : "Зберегти витрату"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ExpenseModal;
