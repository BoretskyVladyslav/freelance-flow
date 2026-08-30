"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { CloudMigrationBanner } from "@/components/finance/cloud-migration-banner";
import { BackupControls } from "@/components/finance/backup-controls";
import { CurrencySwitcher } from "@/components/finance/currency-switcher";
import { useFinance } from "@/components/finance/finance-provider";
import { LedgerFilters } from "@/components/finance/ledger-filters";
import { LedgerTable } from "@/components/finance/ledger-table";
import { MetricCards } from "@/components/finance/metric-cards";
import { PdfReportButton } from "@/components/finance/pdf-report-button";
import { QuickEntryDialog } from "@/components/finance/quick-entry-dialog";
import { WeeklyChart } from "@/components/finance/weekly-chart";
import { TeamPanel } from "@/components/team/team-panel";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uahPerUnit } from "@/lib/exchange-rates";
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
    isAdmin,
  } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Transaction | null>(null);

  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-7xl flex-col gap-6 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase print:hidden">
            Фінансова CRM
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Freelance Flow</h1>
          <p className="text-sm text-muted-foreground print:hidden">
            {isAdmin
              ? "Базова валюта: EUR · Податок в Іспанії 19%, податок компанії 30% · Курс валют онлайн із фіксацією на дату створення"
              : "Ваші проєкти, чисті виплати та персональні показники · Базова валюта EUR"}
          </p>
          <p className="hidden text-sm text-muted-foreground print:block">
            Фінансовий звіт · {formatDate(new Date().toISOString())} · Валюта звіту:{" "}
            {displayCurrency}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 print:hidden lg:w-auto lg:justify-end">
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
          <LogoutButton />
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

      <CloudMigrationBanner />

      <p className="text-xs text-muted-foreground print:hidden" role="status">
        Курс оновлено {formatDate(rates.fetchedAt)} · 1 USD = {formatRate(uahPerUnit("USD", rates))}{" "}
        UAH · 1 EUR = {formatRate(uahPerUnit("EUR", rates))} UAH
        {rates.stale ? " · використано збережений курс" : ""}
        {ratesError ? ` · ${ratesError}` : ""}
      </p>

      <MetricCards />
      <WeeklyChart />

      <Card className="min-w-0 overflow-x-hidden overflow-y-visible">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Журнал транзакцій</CardTitle>
          <LedgerFilters />
        </CardHeader>
        <CardContent className="overflow-x-hidden overflow-y-visible">
          <LedgerTable
            onEdit={(project) => {
              setSelectedProject(project);
              setIsModalOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {isAdmin && isSupabaseConfigured() ? <TeamPanel /> : null}

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
