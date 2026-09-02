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
  DropdownMenuSeparator,
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
import { formatMoney, formatSignedMoney, formatWeekSpan } from "@/lib/format";
import { FormattedDate } from "@/components/ui/formatted-date";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/labels";
import { convertToDisplay, moneyNumber } from "@/lib/tax-calculator";
import { weekKeyFromIsoDate } from "@/lib/week";
import type { TransactionView } from "@/lib/aggregates";
import {
  PAYMENT_STATUSES,
  getTransactionStartDate,
  type PaymentStatus,
  type Platform,
  type Transaction,
} from "@/types/finance";

const PLATFORM_BADGE_CLASS: Record<Platform, string> = {
  Freelancehunt: "border bg-sky-100 text-sky-800 border-sky-200",
  "Freelance BG": "border bg-purple-100 text-purple-800 border-purple-200",
  "Direct Client": "border bg-slate-100 text-slate-800 border-slate-200",
  Other: "border bg-slate-100 text-slate-800 border-slate-200",
};

const STATUS_CLASS: Record<PaymentStatus, string> = {
  "In Progress":
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Paid: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Pending: "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
};

const compactHead = "h-8 px-2 py-1.5";
const compactCell = "px-2 py-1.5";

function rowWeekSpan(row: TransactionView): string {
  return formatWeekSpan(weekKeyFromIsoDate(getTransactionStartDate(row)));
}

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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        type="button"
        nativeButton
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "relative z-[1] h-11 w-11 pointer-events-auto cursor-pointer p-0 md:h-8 md:w-8",
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        aria-label={`Дії для ${row.title}`}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Відкрити дії</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="z-[10050]">
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            onEdit(row);
          }}
        >
          Редагувати
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
        <DropdownMenuSeparator />
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
          <span className="cursor-help tabular-nums text-rose-600 dark:text-rose-400" />
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
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredViews.map((row) => {
          const net = formatMoney(
            convertToDisplay(row.breakdown.netPayout, displayCurrency, rates),
            displayCurrency,
          );
          return (
            <article
              key={row.id}
              className="relative rounded-xl border border-slate-200/80 bg-card p-4 pr-14 shadow-sm dark:border-slate-800"
            >
              <div className="mb-3 flex items-start gap-2">
                <p className="min-w-0 flex-1 text-base font-semibold leading-snug">
                  {row.title}
                </p>
                <Badge
                  variant="outline"
                  className={cn("max-w-[42%] shrink-0 truncate", PLATFORM_BADGE_CLASS[row.platform])}
                >
                  {PLATFORM_LABELS[row.platform]}
                </Badge>
              </div>
              <div className="absolute top-2 right-2">
                <RowActions
                  row={row}
                  onEdit={onEdit}
                  onDelete={(transaction) => setPendingDelete(transaction)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Дата / Тиждень</p>
                  <p className="font-medium whitespace-nowrap">
                    <FormattedDate value={getTransactionStartDate(row)} />
                  </p>
                  <p className="text-xs text-muted-foreground">{rowWeekSpan(row)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Gross</p>
                  <p className="tabular-nums">{formatMoney(row.grossAmount, row.currency)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Статус</p>
                  <Badge variant="outline" className={STATUS_CLASS[row.status]}>
                    {STATUS_LABELS[row.status]}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Net</p>
                  <p className="tabular-nums text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {net}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="hidden md:block">
      <Table
        containerClassName="overflow-x-hidden"
        className="w-full table-fixed border-collapse text-xs"
      >
        <TableHeader>
          <TableRow>
            <TableHead className={cn(compactHead, "w-[18%]")}>
              Дата / Тиждень
            </TableHead>
            <TableHead className={cn(compactHead, "w-[28%] pl-2")}>Проєкт</TableHead>
            <TableHead className={cn(compactHead, "hidden w-[10%] sm:table-cell")}>
              Платформа
            </TableHead>
            <TableHead className={cn(compactHead, "w-[12%]")}>Gross (оригінал)</TableHead>
            <TableHead className={cn(compactHead, "hidden w-[12%] md:table-cell")}>
              Податки
            </TableHead>
            <TableHead className={cn(compactHead, "w-[12%]")}>Net до отримання</TableHead>
            <TableHead className={cn(compactHead, "w-[8%]")}>Статус</TableHead>
            <TableHead className={cn(compactHead, "w-10")}>
              <span className="sr-only">Дії</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredViews.map((row) => (
            <TableRow key={row.id} className="border-0">
              <TableCell className={cn(compactCell, "w-[18%] whitespace-nowrap")}>
                <div className="font-medium leading-tight">
                  <FormattedDate value={getTransactionStartDate(row)} />
                </div>
                <div className="text-[11px] leading-tight text-muted-foreground">
                  {row.endDate ? (
                    <>
                      → <FormattedDate value={row.endDate} variant="day-month" />
                      {" · "}
                    </>
                  ) : null}
                  {rowWeekSpan(row)}
                </div>
                {row.payoutDate ? (
                  <div className="text-[11px] leading-tight text-muted-foreground">
                    Виплата: <FormattedDate value={row.payoutDate} />
                  </div>
                ) : null}
              </TableCell>
              <TableCell className={cn(compactCell, "w-[28%] truncate pl-2")}>
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
                  <div className="truncate text-[11px] text-muted-foreground">{row.notes}</div>
                ) : null}
              </TableCell>
              <TableCell className={cn(compactCell, "hidden w-[10%] overflow-hidden sm:table-cell")}>
                <Badge variant="outline" className={cn("max-w-full truncate", PLATFORM_BADGE_CLASS[row.platform])}>
                  {PLATFORM_LABELS[row.platform]}
                </Badge>
              </TableCell>
              <TableCell className={cn(compactCell, "w-[12%] tabular-nums")}>
                {formatMoney(row.grossAmount, row.currency)}
              </TableCell>
              <TableCell className={cn(compactCell, "hidden w-[12%] md:table-cell")}>
                <TaxDetails row={row} />
              </TableCell>
              <TableCell className={cn(compactCell, "w-[12%] tabular-nums font-medium text-emerald-600 dark:text-emerald-400")}>
                {formatMoney(
                  convertToDisplay(row.breakdown.netPayout, displayCurrency, rates),
                  displayCurrency,
                )}
              </TableCell>
              <TableCell className={cn(compactCell, "w-[8%]")}>
                <Badge variant="outline" className={STATUS_CLASS[row.status]}>
                  {STATUS_LABELS[row.status]}
                </Badge>
              </TableCell>
              <TableCell className={cn(compactCell, "w-10")}>
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
