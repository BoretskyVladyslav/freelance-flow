"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, ChevronRight, Copy, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
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
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatMoney, formatGrossUahTooltip, formatLedgerTaxTooltip, formatSignedMoney, formatWeekSpan } from "@/lib/format";
import { formatTransactionTelegram } from "@/lib/telegram-copy";
import { FormattedDate } from "@/components/ui/formatted-date";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/labels";
import { convertOriginalToUah, convertToDisplay, eurAmountToLockedUah, moneyNumber } from "@/lib/tax-calculator";
import { uahPerUnit } from "@/lib/exchange-rates";
import { weekKeyFromIsoDate } from "@/lib/week";
import type { TransactionView } from "@/lib/aggregates";
import {
  PAYMENT_STATUSES,
  getTaxModel,
  getTransactionStartDate,
  type Currency,
  type ExchangeRates,
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

const PAGE_SIZES = ["10", "25", "50", "all"] as const;
type PageSize = (typeof PAGE_SIZES)[number];

const PAGE_SIZE_ITEMS: Record<PageSize, string> = {
  "10": "10",
  "25": "25",
  "50": "50",
  all: "Всі",
};

const compactHead = "h-8 px-2 py-1.5";
const compactCell = "px-2 py-1.5";

function rowWeekSpan(row: TransactionView): string {
  return formatWeekSpan(weekKeyFromIsoDate(getTransactionStartDate(row)));
}

function isPageSize(value: string | null): value is PageSize {
  return value === "10" || value === "25" || value === "50" || value === "all";
}

function shownLabel(startIndex: number, endIndex: number, total: number): string {
  if (total === 0 || endIndex <= startIndex) return `Показано 0–0 з ${total} транзакцій`;
  return `Показано ${startIndex + 1}–${endIndex} з ${total} транзакцій`;
}

function sameRates(left: ExchangeRates, right: ExchangeRates): boolean {
  if (left === right) return true;
  return (
    left.toEur.EUR === right.toEur.EUR &&
    left.toEur.USD === right.toEur.USD &&
    left.toEur.UAH === right.toEur.UAH &&
    left.toEur.PLN === right.toEur.PLN
  );
}

function sameRow(left: TransactionView, right: TransactionView): boolean {
  if (left === right) return true;
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.status === right.status &&
    left.platform === right.platform &&
    left.currency === right.currency &&
    left.grossAmount === right.grossAmount &&
    left.customFee === right.customFee &&
    left.exchangeRateAtCreation === right.exchangeRateAtCreation &&
    left.notes === right.notes &&
    left.clientName === right.clientName &&
    left.client_name === right.client_name &&
    left.date === right.date &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    left.payoutDate === right.payoutDate &&
    left.weekNumber === right.weekNumber &&
    left.tax_model === right.tax_model &&
    left.gross_uah === right.gross_uah &&
    left.net_uah === right.net_uah &&
    left.uahRateAtCreation === right.uahRateAtCreation &&
    left.breakdown.grossInBase === right.breakdown.grossInBase &&
    left.breakdown.spainTax === right.breakdown.spainTax &&
    left.breakdown.companyTax === right.breakdown.companyTax &&
    left.breakdown.postSpainBase === right.breakdown.postSpainBase &&
    left.breakdown.netPayout === right.breakdown.netPayout &&
    left.breakdown.currencyGainLoss === right.breakdown.currencyGainLoss
  );
}

async function copyTransactionForTelegram(row: TransactionView): Promise<void> {
  try {
    await navigator.clipboard.writeText(formatTransactionTelegram(row));
    toast.success("Скопійовано для Telegram!");
  } catch {
    toast.error("Не вдалося скопіювати.");
  }
}

type LedgerTableProps = {
  onEdit: (transaction: Transaction) => void;
};

type LedgerEntryProps = {
  row: TransactionView;
  displayCurrency: Currency;
  rates: ExchangeRates;
  isAdmin: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onStatus: (id: string, status: PaymentStatus) => void;
  onCopyTelegram: (row: TransactionView) => void;
};

function ledgerEntryPropsAreEqual(prev: LedgerEntryProps, next: LedgerEntryProps): boolean {
  return (
    prev.displayCurrency === next.displayCurrency &&
    prev.isAdmin === next.isAdmin &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.onStatus === next.onStatus &&
    prev.onCopyTelegram === next.onCopyTelegram &&
    sameRates(prev.rates, next.rates) &&
    sameRow(prev.row, next.row)
  );
}

const RowActions = memo(function RowActions({
  row,
  isAdmin,
  onEdit,
  onDelete,
  onStatus,
  onCopyTelegram,
}: {
  row: TransactionView;
  isAdmin: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onStatus: (id: string, status: PaymentStatus) => void;
  onCopyTelegram: (row: TransactionView) => void;
}) {
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
            onCopyTelegram(row);
          }}
        >
          <Copy />
          Копіювати для Telegram
        </DropdownMenuItem>
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
              onStatus(row.id, status);
              setOpen(false);
            }}
          >
            {STATUS_LABELS[status]}
          </DropdownMenuItem>
        ))}
        {isAdmin ? (
          <>
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
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

const TaxDetails = memo(function TaxDetails({
  row,
  displayCurrency,
  rates,
}: {
  row: TransactionView;
  displayCurrency: Currency;
  rates: ExchangeRates;
}) {
  const taxModel = getTaxModel(row);
  const totalTaxEur = moneyNumber(row.breakdown.spainTax + row.breakdown.companyTax);
  const totalTaxDisplay = convertToDisplay(totalTaxEur, displayCurrency, rates);
  const lockedUahInput = {
    currency: row.currency,
    exchangeRateAtCreation: row.exchangeRateAtCreation,
    rates,
    uahRateAtCreation: row.uahRateAtCreation,
  };
  const taxesUah = eurAmountToLockedUah(row.breakdown.spainTax, lockedUahInput);
  const feeUah = eurAmountToLockedUah(row.breakdown.companyTax, lockedUahInput);
  const summary = formatLedgerTaxTooltip(taxModel, taxesUah, feeUah);

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
});

const GrossAmount = memo(function GrossAmount({
  row,
  rates,
}: {
  row: TransactionView;
  rates: ExchangeRates;
}) {
  const amount = formatMoney(row.grossAmount, row.currency);
  if (row.currency === "UAH") {
    return <span className="tabular-nums">{amount}</span>;
  }

  const uahRate =
    row.uahRateAtCreation && Number.isFinite(row.uahRateAtCreation) && row.uahRateAtCreation > 0
      ? row.uahRateAtCreation
      : uahPerUnit(row.currency, rates);
  const grossUah =
    typeof row.gross_uah === "number" && Number.isFinite(row.gross_uah)
      ? row.gross_uah
      : convertOriginalToUah(row.grossAmount, row.currency, rates, uahRate);
  const summary = formatGrossUahTooltip(grossUah, uahRate, row.currency);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="cursor-help tabular-nums underline decoration-dotted decoration-muted-foreground/70 underline-offset-2"
          />
        }
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {amount}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">{summary}</TooltipContent>
    </Tooltip>
  );
});

const LedgerCard = memo(function LedgerCard({
  row,
  displayCurrency,
  rates,
  isAdmin,
  onEdit,
  onDelete,
  onStatus,
  onCopyTelegram,
}: LedgerEntryProps) {
  const net = formatMoney(
    convertToDisplay(row.breakdown.netPayout, displayCurrency, rates),
    displayCurrency,
  );
  const clientName = row.client_name || row.clientName;

  return (
    <article className="relative rounded-xl border border-slate-200/80 bg-card p-4 pr-14 shadow-sm dark:border-slate-800">
      <div className="mb-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug">{row.title}</p>
          {clientName ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <span className="shrink-0">👤</span>
              <span className="truncate font-medium">{clientName}</span>
            </p>
          ) : null}
        </div>
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
          isAdmin={isAdmin}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatus={onStatus}
          onCopyTelegram={onCopyTelegram}
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
          <p className="min-w-0">
            <GrossAmount row={row} rates={rates} />
          </p>
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
      <button
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 h-11 w-full")}
        onClick={() => onCopyTelegram(row)}
      >
        <Copy />
        Копіювати для Telegram
      </button>
    </article>
  );
}, ledgerEntryPropsAreEqual);

const LedgerTableRow = memo(function LedgerTableRow({
  row,
  displayCurrency,
  rates,
  isAdmin,
  onEdit,
  onDelete,
  onStatus,
  onCopyTelegram,
}: LedgerEntryProps) {
  const net = formatMoney(
    convertToDisplay(row.breakdown.netPayout, displayCurrency, rates),
    displayCurrency,
  );
  const clientName = row.client_name || row.clientName;

  return (
    <TableRow className="border-0">
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
        {clientName ? (
          <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <span className="shrink-0">👤</span>
            <span className="truncate font-medium text-slate-600 dark:text-slate-300">
              {clientName}
            </span>
          </div>
        ) : null}
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
        <GrossAmount row={row} rates={rates} />
      </TableCell>
      <TableCell className={cn(compactCell, "hidden w-[12%] md:table-cell")}>
        <TaxDetails row={row} displayCurrency={displayCurrency} rates={rates} />
      </TableCell>
      <TableCell className={cn(compactCell, "w-[12%] tabular-nums font-medium text-emerald-600 dark:text-emerald-400")}>
        {net}
      </TableCell>
      <TableCell className={cn(compactCell, "w-[8%]")}>
        <Badge variant="outline" className={STATUS_CLASS[row.status]}>
          {STATUS_LABELS[row.status]}
        </Badge>
      </TableCell>
      <TableCell className={cn(compactCell, "w-10")}>
        <RowActions
          row={row}
          isAdmin={isAdmin}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatus={onStatus}
          onCopyTelegram={onCopyTelegram}
        />
      </TableCell>
    </TableRow>
  );
}, ledgerEntryPropsAreEqual);

function LedgerFooter({
  label,
  pageSize,
  currentPage,
  pageCount,
  onPageSize,
  onPrevious,
  onNext,
}: {
  label: string;
  pageSize: PageSize;
  currentPage: number;
  pageCount: number;
  onPageSize: (size: PageSize) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border/40 px-4 py-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {label}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={pageSize}
          items={PAGE_SIZE_ITEMS}
          onValueChange={(value) => {
            if (isPageSize(value)) onPageSize(value);
          }}
        >
          <SelectTrigger aria-label="Кількість записів на сторінці" className="h-8 w-[4.75rem] px-2 text-xs">
            <SelectValue>
              {(value: string | null) => (value && isPageSize(value) ? PAGE_SIZE_ITEMS[value] : "10")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {PAGE_SIZE_ITEMS[size]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 px-0"
          aria-label="Попередня сторінка"
          onClick={onPrevious}
          disabled={currentPage <= 1}
        >
          <ChevronLeft />
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          Сторінка {currentPage} з {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 px-0"
          aria-label="Наступна сторінка"
          onClick={onNext}
          disabled={currentPage >= pageCount}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export const LedgerTable = memo(function LedgerTable({ onEdit }: LedgerTableProps) {
  const {
    filteredViews,
    displayCurrency,
    rates,
    deleteTransaction,
    hydrated,
    filters,
    teamScope,
    isAdmin,
    updateTransaction,
  } = useFinance();
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>("10");
  const [printing, setPrinting] = useState(false);

  const filterKey = `${filters.platform}|${filters.status}|${filters.month}|${filters.week}|${teamScope}`;

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    const onBeforePrint = () => {
      flushSync(() => setPrinting(true));
    };
    const onAfterPrint = () => {
      flushSync(() => setPrinting(false));
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  const total = filteredViews.length;
  const pageSizeNumber = pageSize === "all" ? Math.max(total, 1) : Number(pageSize);
  const pageCount = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / pageSizeNumber));
  const currentPage = Math.min(page, pageCount);
  const startIndex = pageSize === "all" || printing ? 0 : (currentPage - 1) * pageSizeNumber;
  const endIndex = pageSize === "all" || printing ? total : Math.min(total, startIndex + pageSizeNumber);
  const visibleRows = useMemo(
    () => filteredViews.slice(startIndex, endIndex),
    [endIndex, filteredViews, startIndex],
  );
  const label = shownLabel(printing ? 0 : startIndex, printing ? total : endIndex, total);

  const handleStatus = useCallback(
    (id: string, status: PaymentStatus) => {
      updateTransaction(id, { status });
    },
    [updateTransaction],
  );

  const handleEdit = useCallback(
    (transaction: Transaction) => {
      onEdit(transaction);
    },
    [onEdit],
  );

  const handleDelete = useCallback((transaction: Transaction) => {
    setPendingDelete(transaction);
  }, []);

  const handleCopyTelegram = useCallback((row: TransactionView) => {
    void copyTransactionForTelegram(row);
  }, []);

  const handlePageSize = useCallback((size: PageSize) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const handlePrevious = useCallback(() => {
    setPage((current) => Math.max(1, Math.min(current, pageCount) - 1));
  }, [pageCount]);

  const handleNext = useCallback(() => {
    setPage((current) => current + 1);
  }, []);

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Завантаження журналу…</p>;
  }

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Немає проєктів, які відповідають вибраним фільтрам.
      </p>
    );
  }

  const rowProps = {
    displayCurrency,
    rates,
    isAdmin,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onStatus: handleStatus,
    onCopyTelegram: handleCopyTelegram,
  };
  const showFooter = total > 10;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {visibleRows.map((row) => (
          <LedgerCard key={row.id} row={row} {...rowProps} />
        ))}
      </div>
      <div className="hidden md:block">
        <Table
          containerClassName="overflow-x-hidden"
          className="w-full table-fixed border-collapse text-xs"
        >
          <TableHeader>
            <TableRow>
              <TableHead className={cn(compactHead, "w-[18%]")}>Дата / Тиждень</TableHead>
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
            {visibleRows.map((row) => (
              <LedgerTableRow key={row.id} row={row} {...rowProps} />
            ))}
          </TableBody>
        </Table>
      </div>
      {showFooter ? (
        <LedgerFooter
          label={label}
          pageSize={pageSize}
          currentPage={pageSize === "all" ? 1 : currentPage}
          pageCount={pageCount}
          onPageSize={handlePageSize}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      ) : null}
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
});
