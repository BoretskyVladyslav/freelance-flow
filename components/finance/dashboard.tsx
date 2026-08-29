"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { BackupControls } from "@/components/finance/backup-controls";
import { CurrencySwitcher } from "@/components/finance/currency-switcher";
import { useFinance } from "@/components/finance/finance-provider";
import { LedgerFilters } from "@/components/finance/ledger-filters";
import { LedgerTable } from "@/components/finance/ledger-table";
import { MetricCards } from "@/components/finance/metric-cards";
import { PdfReportButton } from "@/components/finance/pdf-report-button";
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Transaction | null>(null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Фінансова CRM
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Freelance Flow</h1>
          <p className="text-sm text-muted-foreground">
            Базова валюта: EUR · Податок в Іспанії 19%, податок компанії 30% · Курс валют онлайн із
            фіксацією на дату створення
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <CurrencySwitcher value={displayCurrency} onChange={setDisplayCurrency} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshRates()}
            disabled={ratesRefreshing}
          >
            <RefreshCw className={ratesRefreshing ? "animate-spin" : undefined} />
            Оновити курс
          </Button>
          <PdfReportButton />
          <BackupControls />
          <Button
            type="button"
            onClick={() => {
              setSelectedProject(null);
              setIsModalOpen(true);
            }}
          >
            <Plus />
            Додати проєкт
          </Button>
        </div>
      </header>

      <p className="text-xs text-muted-foreground" role="status">
        Курс оновлено {formatDate(rates.fetchedAt)} · 1 USD = {formatRate(rates.toEur.USD)} EUR
        {rates.stale ? " · використано збережений курс" : ""}
        {ratesError ? ` · ${ratesError}` : ""}
      </p>

      <MetricCards />
      <WeeklyChart />

      <Card className="overflow-visible">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Журнал транзакцій</CardTitle>
          <LedgerFilters />
        </CardHeader>
        <CardContent className="overflow-visible">
          <LedgerTable
            onEdit={(project) => {
              setSelectedProject(project);
              setIsModalOpen(true);
            }}
          />
        </CardContent>
      </Card>

      <QuickEntryDialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setSelectedProject(null);
        }}
        transaction={selectedProject}
      />
    </main>
  );
}
