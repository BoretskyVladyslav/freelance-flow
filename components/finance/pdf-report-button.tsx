"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/finance/finance-provider";
import { downloadPdfReport } from "@/lib/pdf-report";
import { cn } from "@/lib/utils";

type PdfReportButtonProps = {
  className?: string;
  size?: "sm" | "default";
};

export function PdfReportButton({ className, size = "sm" }: PdfReportButtonProps) {
  const { filteredViews, displayTotals, displayCurrency, rates, filters, hydrated } =
    useFinance();
  const [busy, setBusy] = useState(false);

  async function onExport() {
    if (!hydrated) {
      toast.error("Дані ще завантажуються.");
      return;
    }
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn("pointer-events-auto cursor-pointer", className)}
      onClick={() => void onExport()}
      disabled={busy}
    >
      <FileText />
      {busy ? "Формування…" : "Звіт у PDF"}
    </Button>
  );
}
