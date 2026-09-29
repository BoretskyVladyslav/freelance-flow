import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  loadSnapshot,
  parseImportedBackup,
  savePreferences,
  serializeBackup,
  type FinanceSnapshot,
} from "@/lib/storage";
import {
  isCurrency,
  isPaymentStatus,
  isPlatform,
  type TaxModel,
  type Transaction,
} from "@/types/finance";
import type { Database } from "@/types/database";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TAX_MODEL_SCHEMA_CACHE_WARNING =
  "[freelance-flow] Supabase schema cache is missing projects.tax_model (PGRST204). Retrying the save without tax_model so the UI does not crash. Apply supabase_fop_tax_migration.sql and reload the PostgREST schema cache.";

export function ensureProjectUuid(id: string): string {
  return UUID_RE.test(id) ? id : crypto.randomUUID();
}

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type ProjectRowLike = Omit<ProjectRow, "tax_model" | "gross_uah" | "net_uah" | "uah_rate_at_creation"> & {
  tax_model?: string | null;
  gross_uah?: number | null;
  net_uah?: number | null;
  uah_rate_at_creation?: number | null;
};
type ProjectWriteResult = { error: { code?: string | null; message?: string | null } | null };

function toIsoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

export function resolveRowTaxModel(value: unknown): TaxModel {
  const fallback = value ?? "spain_19";
  return fallback === "fop_3" ? "fop_3" : "spain_19";
}

export function isTaxModelSchemaCacheError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  const code = String(error.code ?? "").toUpperCase();
  const message = String(error.message ?? "").toLowerCase();
  if (code === "PGRST204") return true;
  if (code === "42703" && message.includes("tax_model")) return true;
  return (
    message.includes("tax_model") &&
    (message.includes("schema cache") ||
      message.includes("could not find") ||
      message.includes("does not exist"))
  );
}

export function stripTaxModelFromRows(rows: ProjectInsert[]): Array<Omit<ProjectInsert, "tax_model">> {
  return rows.map((row) => {
    const {
      tax_model: _taxModel,
      gross_uah: _grossUah,
      net_uah: _netUah,
      uah_rate_at_creation: _uahRate,
      ...rest
    } = row;
    return rest;
  });
}

export async function writeProjectsWithTaxModelFallback(
  write: (rows: ProjectInsert[]) => Promise<ProjectWriteResult>,
  rows: ProjectInsert[],
): Promise<void> {
  const first = await write(rows);
  if (!first.error) return;
  if (!isTaxModelSchemaCacheError(first.error)) {
    throw new Error(first.error.message ?? "Не вдалося зберегти проєкти.");
  }
  console.warn(TAX_MODEL_SCHEMA_CACHE_WARNING);
  const retry = await write(stripTaxModelFromRows(rows) as ProjectInsert[]);
  if (retry.error) {
    throw new Error(retry.error.message ?? "Не вдалося зберегти проєкти.");
  }
}

function rowToTransaction(row: ProjectRowLike): Transaction | null {
  if (!isPlatform(row.platform) || !isCurrency(row.currency) || !isPaymentStatus(row.status)) {
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name ?? undefined,
    client_name: row.client_name ?? undefined,
    platform: row.platform,
    grossAmount: Number(row.gross_amount),
    currency: row.currency,
    customFee: Number(row.custom_fee),
    exchangeRateAtCreation: Number(row.exchange_rate_at_creation),
    date: row.date,
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    payoutDate: toIsoDate(row.payout_date),
    status: row.status,
    weekNumber: row.week_number,
    notes: row.notes ?? undefined,
    employeeId: row.employee_id,
    createdBy: row.created_by ?? undefined,
    tax_model: resolveRowTaxModel(row.tax_model ?? "spain_19"),
    uahRateAtCreation:
      typeof row.uah_rate_at_creation === "number" && row.uah_rate_at_creation > 0
        ? Number(row.uah_rate_at_creation)
        : undefined,
    gross_uah:
      typeof row.gross_uah === "number" && Number.isFinite(row.gross_uah) && row.gross_uah >= 0
        ? Number(row.gross_uah)
        : undefined,
    net_uah:
      typeof row.net_uah === "number" && Number.isFinite(row.net_uah) && row.net_uah >= 0
        ? Number(row.net_uah)
        : undefined,
  };
}

export function transactionToRow(transaction: Transaction, userId: string): ProjectInsert {
  return {
    id: transaction.id,
    employee_id: transaction.employeeId || userId,
    created_by: transaction.createdBy || userId,
    title: transaction.title,
    client_id: transaction.clientId ?? null,
    client_name: transaction.client_name ?? transaction.clientName ?? null,
    platform: transaction.platform,
    gross_amount: transaction.grossAmount,
    currency: transaction.currency,
    custom_fee: transaction.customFee,
    exchange_rate_at_creation: transaction.exchangeRateAtCreation,
    date: (transaction.startDate || transaction.date).slice(0, 10),
    start_date: toIsoDate(transaction.startDate) ?? null,
    end_date: toIsoDate(transaction.endDate) ?? null,
    payout_date: toIsoDate(transaction.payoutDate) ?? null,
    status: transaction.status,
    week_number: transaction.weekNumber,
    notes: transaction.notes ?? null,
    tax_model: resolveRowTaxModel(transaction.tax_model),
    uah_rate_at_creation: transaction.uahRateAtCreation ?? null,
    gross_uah: transaction.gross_uah ?? null,
    net_uah: transaction.net_uah ?? null,
  };
}

export const supabaseProjectsRepository = {
  async load(): Promise<FinanceSnapshot> {
    const local = await loadSnapshot();
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let query = supabase.from("projects").select("*").order("date", { ascending: false });
    if (user) {
      const profile = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      const role = profile.data?.role || user.user_metadata?.role || user.app_metadata?.role;
      if (role !== "admin") {
        query = query.eq("employee_id", user.id);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const transactions = (data ?? [])
      .map((row) => rowToTransaction(row as ProjectRowLike))
      .filter((row): row is Transaction => row !== null);

    return {
      transactions,
      lastKnownRates: local.lastKnownRates,
      displayCurrency: local.displayCurrency,
    };
  },

  async save(snapshot: FinanceSnapshot): Promise<void> {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Потрібна автентифікація для збереження проєктів.");
    }

    const profile = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = profile.data?.role || user.user_metadata?.role || user.app_metadata?.role;
    const isAdmin = role === "admin";

    let existingQuery = supabase.from("projects").select("id");
    if (!isAdmin) {
      existingQuery = existingQuery.eq("employee_id", user.id);
    }
    const { data: existing, error: existingError } = await existingQuery;
    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingIds = (existing ?? []).map((row) => row.id);
    if (snapshot.transactions.length === 0 && existingIds.length > 0 && !isAdmin) {
      await savePreferences({
        lastKnownRates: snapshot.lastKnownRates,
        displayCurrency: snapshot.displayCurrency,
      });
      return;
    }

    const keepIds = new Set(snapshot.transactions.map((row) => row.id));
    const toDelete = existingIds.filter((id) => !keepIds.has(id));
    if (isAdmin && toDelete.length > 0) {
      const { error: deleteError } = await supabase.from("projects").delete().in("id", toDelete);
      if (deleteError) throw new Error(deleteError.message);
    }

    if (snapshot.transactions.length > 0) {
      const rows = snapshot.transactions.map((transaction) => {
        const row = transactionToRow(transaction, user.id);
        if (!isAdmin) {
          row.employee_id = user.id;
        }
        return row;
      });
      await writeProjectsWithTaxModelFallback(async (payload) => {
        const { error } = await supabase.from("projects").upsert(payload, { onConflict: "id" });
        return { error };
      }, rows);
    }

    await savePreferences({
      lastKnownRates: snapshot.lastKnownRates,
      displayCurrency: snapshot.displayCurrency,
    });
  },

  serializeBackup,
  parseBackup: parseImportedBackup,
};
