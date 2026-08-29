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
            "Importing a backup replaces all current transactions. Continue?",
          );
          if (!confirmed) return;
        }
        importBackup(raw);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Import failed.");
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
        Export
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
      >
        <Upload />
        Import
      </Button>
    </div>
  );
}
