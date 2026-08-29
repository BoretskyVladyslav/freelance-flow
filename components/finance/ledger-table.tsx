"use client";

import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { convertToDisplay } from "@/lib/tax-calculator";
import type { PaymentStatus, Platform, Transaction } from "@/types/finance";
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
    ["Gross in EUR", row.breakdown.grossInBase],
    ["Fee in EUR", row.breakdown.feeInBase],
    ["Taxable base", row.breakdown.taxableBase],
    ["Spain tax 19%", row.breakdown.spainTax],
    ["Company tax 30%", row.breakdown.companyTax],
    ["Net at creation", row.breakdown.netPayout],
    ["Net at live rate", row.breakdown.currentNetPayoutAtLiveRate],
  ] as const;

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="sm" />}>
        Taxes
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <PopoverHeader>
          <PopoverTitle>Tax breakdown</PopoverTitle>
          <PopoverDescription>
            Sequence is rounded to 2 decimals at every step.
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
            <dt className="text-muted-foreground">Gain / loss</dt>
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
  const { filteredViews, displayCurrency, rates, deleteTransaction, hydrated } = useFinance();

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Loading ledger…</p>;
  }

  if (filteredViews.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No projects match the current filters.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date / Week</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Platform</TableHead>
          <TableHead>Original gross</TableHead>
          <TableHead>Taxes</TableHead>
          <TableHead>Net payout</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-10">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredViews.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <div className="font-medium">{formatDate(row.date)}</div>
              <div className="text-xs text-muted-foreground">W{row.weekNumber}</div>
            </TableCell>
            <TableCell>
              <div className="font-medium">{row.title}</div>
              {row.notes ? (
                <div className="max-w-56 truncate text-xs text-muted-foreground">{row.notes}</div>
              ) : null}
            </TableCell>
            <TableCell>
              <Badge variant={PLATFORM_VARIANT[row.platform]}>{row.platform}</Badge>
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
              <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                  <MoreHorizontal />
                  <span className="sr-only">Open actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(row)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      const confirmed = window.confirm(`Delete “${row.title}”?`);
                      if (confirmed) deleteTransaction(row.id);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
