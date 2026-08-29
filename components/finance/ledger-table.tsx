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
  DropdownMenuPortal,
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
import { formatDate, formatMoney } from "@/lib/format";
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
      <TooltipTrigger render={<Badge variant="secondary" className="cursor-help" />}>
        Податки
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">{summary}</TooltipContent>
    </Tooltip>
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
            <TableHead>Net до отримання</TableHead>
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
                <Tooltip>
                  <TooltipTrigger
                    title={row.title}
                    render={
                      <div className="max-w-[200px] cursor-help truncate font-medium sm:max-w-[300px]" />
                    }
                  >
                    {row.title}
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{row.title}</TooltipContent>
                </Tooltip>
                {row.notes ? (
                  <div className="max-w-[200px] truncate text-xs text-muted-foreground sm:max-w-[300px]">
                    {row.notes}
                  </div>
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
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    nativeButton
                    render={<Button type="button" variant="ghost" size="icon-sm" />}
                  >
                    <MoreHorizontal />
                    <span className="sr-only">Відкрити дії</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuContent align="end" side="bottom" className="z-[200] w-max min-w-44">
                      <DropdownMenuItem
                        onClick={() => {
                          onEdit(row);
                        }}
                      >
                        Редагувати
                      </DropdownMenuItem>
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
                  </DropdownMenuPortal>
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
