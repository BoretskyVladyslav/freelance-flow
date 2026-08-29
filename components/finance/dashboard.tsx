"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { BackupControls } from "@/components/finance/backup-controls";
import { CurrencySwitcher } from "@/components/finance/currency-switcher";
import { useFinance } from "@/components/finance/finance-provider";
import { LedgerFilters } from "@/components/finance/ledger-filters";
import { LedgerTable } from "@/components/finance/ledger-table";
import { MetricCards } from "@/components/finance/metric-cards";
import { QuickEntryDialog } from "@/components/finance/quick-entry-dialog";
import { WeeklyChart } from "@/components/finance/weekly-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatRate } from "@/lib/format";
import type { Transaction } from "@/types/finance";

export function Dashboard() {
  const {
    displayCurrency,
    setDisplayCurrency,
    rates,
    ratesError,
    ratesRefreshing,
    refreshRates,
  } = useFinance();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Financial CRM
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Freelance Flow</h1>
          <p className="text-sm text-muted-foreground">
            EUR base · Spain 19% then company 30% · live FX with locked creation rates
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CurrencySwitcher value={displayCurrency} onChange={setDisplayCurrency} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshRates()}
            disabled={ratesRefreshing}
          >
            <RefreshCw className={ratesRefreshing ? "animate-spin" : undefined} />
            Refresh FX
          </Button>
          <BackupControls />
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus />
            Add project
          </Button>
        </div>
      </header>

      <p className="text-xs text-muted-foreground" role="status">
        FX updated {formatDate(rates.fetchedAt)} · 1 USD = {formatRate(rates.toEur.USD)} EUR
        {rates.stale ? " · using cached rates" : ""}
        {ratesError ? ` · ${ratesError}` : ""}
      </p>

      <MetricCards />
      <WeeklyChart />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Ledger</CardTitle>
          <LedgerFilters />
        </CardHeader>
        <CardContent>
          <LedgerTable
            onEdit={(transaction) => {
              setEditing(transaction);
              setDialogOpen(true);
            }}
          />
        </CardContent>
      </Card>

      <QuickEntryDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        transaction={editing}
      />
    </main>
  );
}
