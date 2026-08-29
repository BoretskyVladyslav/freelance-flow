import { loadSnapshot } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  ensureProjectUuid,
  transactionToRow,
} from "@/services/supabase-projects";

const MIGRATION_FLAG = "freelance-flow/cloud-migration-done";

export type LocalMigrationResult = {
  inserted: number;
  skipped: number;
};

export function hasCompletedCloudMigration(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MIGRATION_FLAG) === "1";
}

export function markCloudMigrationDone(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MIGRATION_FLAG, "1");
}

export async function countLegacyLocalProjects(): Promise<number> {
  const snapshot = await loadSnapshot();
  return snapshot.transactions.length;
}

export async function migrateLocalToSupabase(): Promise<LocalMigrationResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase не налаштовано.");
  }

  const supabase = createBrowserSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Потрібна автентифікація для перенесення проєктів.");
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("is_admin");
  if (roleError) {
    throw new Error(roleError.message);
  }
  if (!isAdmin) {
    throw new Error("Перенесення доступне лише адміністратору.");
  }

  const local = await loadSnapshot();
  if (local.transactions.length === 0) {
    markCloudMigrationDone();
    return { inserted: 0, skipped: 0 };
  }

  const { data: existing, error: existingError } = await supabase.from("projects").select("id");
  if (existingError) {
    throw new Error(existingError.message);
  }
  const existingIds = new Set((existing ?? []).map((row) => row.id));

  const rows = [];
  let skipped = 0;
  for (const transaction of local.transactions) {
    const id = ensureProjectUuid(transaction.id);
    if (existingIds.has(id) || existingIds.has(transaction.id)) {
      skipped += 1;
      continue;
    }
    existingIds.add(id);
    rows.push(
      transactionToRow(
        {
          ...transaction,
          id,
          employeeId: user.id,
          createdBy: transaction.createdBy || user.id,
        },
        user.id,
      ),
    );
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("projects").insert(rows);
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  markCloudMigrationDone();
  return { inserted: rows.length, skipped };
}
