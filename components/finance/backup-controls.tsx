"use client";

import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/finance/finance-provider";

export function BackupControls() {
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
