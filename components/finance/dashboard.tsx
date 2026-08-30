"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { CloudMigrationBanner } from "@/components/finance/cloud-migration-banner";
import { BackupControls, MoreToolsDropdown } from "@/components/finance/backup-controls";
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

  function openNewProject() {
    setSelectedProject(null);
    setIsModalOpen(true);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full min-w-0 max-w-7xl flex-col gap-4 overflow-x-hidden px-4 py-4 sm:gap-6 sm:py-6 md:px-6 lg:px-8">
      <header className="flex min-w-0 flex-col gap-3 md:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.18em] text-blue-900 uppercase print:hidden dark:text-blue-300">
            Фінансова CRM
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-blue-900 sm:text-2xl dark:text-blue-100">
            Freelance Flow
          </h1>
          <p className="hidden text-sm text-muted-foreground print:hidden md:block">
            {isAdmin
              ? "Базова валюта: EUR · Податок в Іспанії 19%, податок компанії 30% · Курс валют онлайн із фіксацією на дату створення"
              : "Ваші проєкти, чисті виплати та персональні показники · Базова валюта EUR"}
          </p>
          <p className="hidden text-sm text-muted-foreground print:block">
            Фінансовий звіт · {formatDate(new Date().toISOString())} · Валюта звіту:{" "}
            {displayCurrency}
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 print:hidden md:hidden">
          <div className="flex items-center justify-between gap-2">
            <CurrencySwitcher value={displayCurrency} onChange={setDisplayCurrency} />
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Оновити курс"
                className="h-8 w-8 p-0"
                onClick={() => void refreshRates()}
                disabled={ratesRefreshing}
              >
                <RefreshCw className={ratesRefreshing ? "animate-spin" : undefined} />
              </Button>
              <LogoutButton compact />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <MoreToolsDropdown />
            <Button type="button" onClick={openNewProject} className="h-8 px-2.5">
              <Plus />
              <span className="hidden min-[380px]:inline">Додати проєкт</span>
              <span className="sr-only min-[380px]:hidden">Додати проєкт</span>
            </Button>
          </div>
        </div>

        <div className="hidden w-full flex-wrap items-center gap-2 print:hidden md:flex lg:w-auto lg:justify-end">
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
          <Button type="button" onClick={openNewProject}>
            <Plus />
            Додати проєкт
          </Button>
        </div>
      </header>

      <CloudMigrationBanner />

      <p className="min-w-0 text-xs text-muted-foreground print:hidden" role="status">
        Курс оновлено {formatDate(rates.fetchedAt)} · 1 USD = {formatRate(uahPerUnit("USD", rates))}{" "}
        UAH · 1 EUR = {formatRate(uahPerUnit("EUR", rates))} UAH
        {rates.stale ? " · використано збережений курс" : ""}
        {ratesError ? ` · ${ratesError}` : ""}
      </p>

      <MetricCards />
      <WeeklyChart />

      <Card className="min-w-0 overflow-x-hidden overflow-y-visible">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
