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
import { buttonVariants } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFinance } from "@/components/finance/finance-provider";
import { formatDate, formatMoney, formatSignedMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/labels";
import { convertToDisplay, moneyNumber } from "@/lib/tax-calculator";
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

const STATUS_CLASS: Record<PaymentStatus, string> = {
  "In Progress":
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Paid: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Pending: "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
};

type LedgerTableProps = {
  onEdit: (transaction: Transaction) => void;
};

function RowActions({
  row,
  onEdit,
  onDelete,
}: {
  row: TransactionView;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}) {
  const { updateTransaction } = useFinance();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        type="button"
        nativeButton
        className={cn(buttonVariants({ variant: "ghost" }), "relative z-[1] h-8 w-8 p-0")}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        aria-label={`Дії для ${row.title}`}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Відкрити дії</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="z-[9999]">
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            onEdit(row);
          }}
        >
          Редагувати
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Змінити статус</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="z-[9999]">
            {PAYMENT_STATUSES.map((status) => (
              <DropdownMenuItem
                key={status}
                disabled={row.status === status}
                onClick={() => {
                  updateTransaction(row.id, { status });
                  setOpen(false);
                }}
              >
                {STATUS_LABELS[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            setOpen(false);
            onDelete(row);
          }}
        >
          Видалити
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaxDetails({ row }: { row: TransactionView }) {
  const { displayCurrency, rates } = useFinance();
  const totalTaxEur = moneyNumber(row.breakdown.spainTax + row.breakdown.companyTax);
  const totalTaxDisplay = convertToDisplay(totalTaxEur, displayCurrency, rates);
  const spainTax = formatMoney(
    convertToDisplay(row.breakdown.spainTax, displayCurrency, rates),
    displayCurrency,
  );
  const companyTax = formatMoney(
    convertToDisplay(row.breakdown.companyTax, displayCurrency, rates),
    displayCurrency,
  );
  const summary = `Іспанія (19%): ${spainTax} | Фірма (30%): ${companyTax}`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="cursor-help tabular-nums text-destructive dark:text-red-400" />
        }
      >
        {formatSignedMoney(-totalTaxDisplay, displayCurrency)}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">{summary}</TooltipContent>
    </Tooltip>
  );
}

export function LedgerTable({ onEdit }: LedgerTableProps) {
  const { filteredViews, displayCurrency, rates, deleteTransaction, hydrated } = useFinance();
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
      <div className="grid grid-cols-1 gap-4 md:hidden print:hidden">
        {filteredViews.map((row) => {
          const net = formatMoney(
            convertToDisplay(row.breakdown.netPayout, displayCurrency, rates),
            displayCurrency,
          );
          return (
            <div
              key={row.id}
              className="relative rounded-xl border border-slate-200/80 bg-card p-3.5 shadow-sm dark:border-slate-800"
            >
              <div className="mb-3 flex items-start gap-2 pr-8">
                <p className="min-w-0 flex-1 truncate font-medium">{row.title}</p>
                <Badge variant={PLATFORM_VARIANT[row.platform]} className="max-w-[40%] shrink-0 truncate">
                  {PLATFORM_LABELS[row.platform]}
                </Badge>
              </div>
              <div className="absolute top-2 right-2 print:hidden">
                <RowActions
                  row={row}
                  onEdit={onEdit}
                  onDelete={(transaction) => setPendingDelete(transaction)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Дата / Тиждень</p>
                  <p className="font-medium">{formatDate(getTransactionStartDate(row))}</p>
                  <p className="text-xs text-muted-foreground">Т{row.weekNumber}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Валовий:</p>
                  <p className="tabular-nums">{formatMoney(row.grossAmount, row.currency)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Статус</p>
                  <Badge variant="outline" className={STATUS_CLASS[row.status]}>
                    {STATUS_LABELS[row.status]}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">До виплати:</p>
                  <p className="tabular-nums font-bold text-green-600 dark:text-green-400">
                    {net}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden md:block print:block">
      <Table containerClassName="overflow-x-hidden" className="w-full table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[14%]">Дата / Тиждень</TableHead>
            <TableHead className="w-[30%]">Проєкт</TableHead>
            <TableHead className="hidden w-[10%] sm:table-cell">Платформа</TableHead>
            <TableHead className="w-[12%]">Gross (оригінал)</TableHead>
            <TableHead className="hidden w-[12%] md:table-cell">Податки</TableHead>
            <TableHead className="w-[12%]">Net до отримання</TableHead>
            <TableHead className="w-[8%]">Статус</TableHead>
            <TableHead className="w-10 print:hidden">
              <span className="sr-only">Дії</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredViews.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="w-[14%] whitespace-normal">
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
              <TableCell className="w-[30%] max-w-0 overflow-hidden">
                <Tooltip>
                  <TooltipTrigger
                    title={row.title}
                    render={<div className="cursor-help truncate font-medium" />}
                  >
                    {row.title}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{row.title}</TooltipContent>
                </Tooltip>
                {row.notes ? (
                  <div className="truncate text-xs text-muted-foreground">{row.notes}</div>
                ) : null}
              </TableCell>
              <TableCell className="hidden w-[10%] overflow-hidden sm:table-cell">
                <Badge variant={PLATFORM_VARIANT[row.platform]} className="max-w-full truncate">
                  {PLATFORM_LABELS[row.platform]}
                </Badge>
              </TableCell>
              <TableCell className="w-[12%] tabular-nums">
                {formatMoney(row.grossAmount, row.currency)}
              </TableCell>
              <TableCell className="hidden w-[12%] md:table-cell">
                <TaxDetails row={row} />
              </TableCell>
              <TableCell className="w-[12%] tabular-nums font-medium text-green-600 dark:text-green-400">
                {formatMoney(
                  convertToDisplay(row.breakdown.netPayout, displayCurrency, rates),
                  displayCurrency,
                )}
              </TableCell>
              <TableCell className="w-[8%]">
                <Badge variant="outline" className={STATUS_CLASS[row.status]}>
                  {STATUS_LABELS[row.status]}
                </Badge>
              </TableCell>
              <TableCell className="w-10 print:hidden">
                <RowActions
                  row={row}
                  onEdit={onEdit}
                  onDelete={(transaction) => setPendingDelete(transaction)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
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
