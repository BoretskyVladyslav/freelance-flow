"use client";

import { useRef } from "react";
import { Download, FileText, MoreHorizontal, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFinance } from "@/components/finance/finance-provider";
import { downloadPdfReport } from "@/lib/pdf-report";
import { cn } from "@/lib/utils";

function useBackupFile() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { exportBackup, importBackup, transactions } = useFinance();

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? "");
        if (transactions.length > 0) {
          const confirmed = window.confirm(
            "Імпорт замінить усі поточні транзакції. Продовжити?",
          );
          if (!confirmed) return;
        }
        importBackup(raw);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не вдалося імпортувати файл.");
      }
    };
    reader.readAsText(file);
  }

  return { fileRef, exportBackup, onFile };
}

export function BackupControls() {
  const { fileRef, exportBackup, onFile } = useBackupFile();

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={exportBackup}>
        <Download />
        Експорт
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
      >
        <Upload />
        Імпорт
      </Button>
    </div>
  );
}

export function MoreToolsDropdown() {
  const { fileRef, exportBackup, onFile } = useBackupFile();
  const { filteredViews, displayTotals, displayCurrency, rates, filters, hydrated } =
    useFinance();

  async function onPdf() {
    if (!hydrated) {
      toast.error("Дані ще завантажуються.");
      return;
    }
    try {
      const fileName = await downloadPdfReport({
        views: filteredViews,
        totals: displayTotals,
        displayCurrency,
        rates,
        filters,
      });
      toast.success(`Завантажено ${fileName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не вдалося сформувати PDF.");
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          nativeButton
          aria-label="Звіт, експорт і імпорт"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-11 w-11 pointer-events-auto cursor-pointer p-0 md:h-8 md:w-8",
          )}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="min-h-11 cursor-pointer"
            onClick={() => void onPdf()}
          >
            <FileText className="size-4" />
            Звіт у PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportBackup}>
            <Download className="size-4" />
            Експорт
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Імпорт
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
