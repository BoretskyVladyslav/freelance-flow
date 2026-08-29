"use client";

import { useEffect, useState } from "react";
import { CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/finance/finance-provider";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  countLegacyLocalProjects,
  hasCompletedCloudMigration,
  migrateLocalToSupabase,
} from "@/services/projects";

export function CloudMigrationBanner() {
  const { reloadProjects, hydrated } = useFinance();
  const [visible, setVisible] = useState(false);
  const [legacyCount, setLegacyCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured() || hasCompletedCloudMigration()) {
      setVisible(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const [{ data: isAdmin }, count] = await Promise.all([
          supabase.rpc("is_admin"),
          countLegacyLocalProjects(),
        ]);
        if (cancelled) return;
        setLegacyCount(count);
        setVisible(Boolean(isAdmin) && count > 0);
      } catch {
        if (!cancelled) setVisible(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  if (!visible) return null;

  async function onMigrate() {
    setBusy(true);
    try {
      const result = await migrateLocalToSupabase();
      await reloadProjects();
      setVisible(false);
      toast.success(
        result.inserted > 0
          ? `Перенесено проєктів: ${result.inserted}.`
          : "Локальні проєкти вже є в хмарі.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не вдалося перенести проєкти.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Alert className="print:hidden">
      <CloudUpload />
      <AlertTitle>Локальні дані ще в браузері</AlertTitle>
      <AlertDescription>
        Знайдено {legacyCount} проєкт(ів) в IndexedDB. Перенесіть їх у Supabase одним натисканням —
        дія доступна адміністратору і виконується один раз.
      </AlertDescription>
      <div className="col-start-2 mt-3">
        <Button type="button" size="sm" disabled={busy} onClick={() => void onMigrate()}>
          Перенести збережені проєкти з браузера в хмару
        </Button>
      </div>
    </Alert>
  );
}
