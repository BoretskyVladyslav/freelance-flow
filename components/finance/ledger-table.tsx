"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFinance } from "@/components/finance/finance-provider";
import { formatDate, formatMoney, formatSignedMoney } from "@/lib/format";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/labels";
import { convertToDisplay } from "@/lib/tax-calculator";
import {
  PAYMENT_STATUSES,
  getTransactionStartDate,
  type PaymentStatus,
  type Platform,
  type Transaction,
} from "@/types/finance";
import type { TransactionView } from "@/lib/aggregates";

const PLATFORM_VARIANT: Record<Platform, "default" | "secondary" | "outline" | "ghost"> = {
  Freelancehunt: "default",
  "Freelance BG": "secondary",
  "Direct Client": "outline",
  Other: "ghost",
};

const STATUS_VARIANT: Record<PaymentStatus, "default" | "secondary" | "outline"> = {
  Paid: "default",
  Pending: "secondary",
  "In Progress": "outline",
};

type LedgerTableProps = {
  onEdit: (transaction: Transaction) => void;
};

function TaxDetails({ row }: { row: TransactionView }) {
  const { displayCurrency, rates } = useFinance();
  const items = [
    ["Gross у EUR", row.breakdown.grossInBase],
    ["Комісія у EUR", row.breakdown.feeInBase],
    ["Оподатковувана база", row.breakdown.taxableBase],
    ["Податок в Іспанії 19%", row.breakdown.spainTax],
    ["Податок фірми 30%", row.breakdown.companyTax],
    ["Net на дату створення", row.breakdown.netPayout],
    ["Net за актуальним курсом", row.breakdown.currentNetPayoutAtLiveRate],
  ] as const;

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" />}>
        Податки
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <PopoverHeader>
          <PopoverTitle>Розбивка податків</PopoverTitle>
          <PopoverDescription>
            Кожен крок послідовності округлено до 2 знаків після коми.
          </PopoverDescription>
        </PopoverHeader>
        <dl className="grid gap-1.5 text-sm">
          {items.map(([label, amount]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">
                {formatMoney(convertToDisplay(amount, displayCurrency, rates), displayCurrency)}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t pt-1.5">
            <dt className="text-muted-foreground">Курсова різниця</dt>
            <dd className="tabular-nums">
              {formatSignedMoney(
                convertToDisplay(row.breakdown.currencyGainLoss, displayCurrency, rates),
                displayCurrency,
              )}
            </dd>
          </div>
        </dl>
      </PopoverContent>
    </Popover>
  );
}

export function LedgerTable({ onEdit }: LedgerTableProps) {
  const {
    filteredViews,
    displayCurrency,
    rates,
    deleteTransaction,
    updateTransaction,
    hydrated,
  } = useFinance();
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Завантаження журналу…</p>;
  }

  if (filteredViews.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Немає проєктів, які відповідають вибраним фільтрам.
      </p>
    );
  }

  return (
    <>
    <Table className="min-w-[920px]">
      <TableHeader>
        <TableRow>
          <TableHead>Дата / Тиждень</TableHead>
          <TableHead>Проєкт</TableHead>
          <TableHead>Платформа</TableHead>
          <TableHead>Gross (оригінал)</TableHead>
          <TableHead>Податки</TableHead>
          <TableHead>Net до виплати</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Дії</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredViews.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium">
                {formatDate(getTransactionStartDate(row))}
                {row.endDate ? ` — ${formatDate(row.endDate)}` : ""}
              </div>
              <div className="text-xs text-muted-foreground">Т{row.weekNumber}</div>
              {row.payoutDate ? (
                <div className="text-xs text-muted-foreground">
                  Виплата: {formatDate(row.payoutDate)}
                </div>
              ) : null}
            </TableCell>
            <TableCell>
              <div className="font-medium">{row.title}</div>
              {row.notes ? (
                <div className="max-w-56 truncate text-xs text-muted-foreground">{row.notes}</div>
              ) : null}
            </TableCell>
            <TableCell>
              <Badge variant={PLATFORM_VARIANT[row.platform]}>
                {PLATFORM_LABELS[row.platform]}
              </Badge>
            </TableCell>
            <TableCell className="tabular-nums">
              {formatMoney(row.grossAmount, row.currency)}
            </TableCell>
            <TableCell>
              <TaxDetails row={row} />
            </TableCell>
            <TableCell className="tabular-nums font-medium">
              {formatMoney(
                convertToDisplay(row.breakdown.netPayout, displayCurrency, rates),
                displayCurrency,
              )}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABELS[row.status]}</Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                  <MoreHorizontal />
                  <span className="sr-only">Відкрити дії</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(row)}>Редагувати</DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Змінити статус</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {PAYMENT_STATUSES.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          disabled={row.status === status}
                          onClick={() => updateTransaction(row.id, { status })}
                        >
                          {STATUS_LABELS[status]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setPendingDelete(row)}
                  >
                    Видалити
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити проєкт?</AlertDialogTitle>
            <AlertDialogDescription>
              Проєкт «{pendingDelete?.title}» буде видалено без можливості відновлення.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete) deleteTransaction(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
