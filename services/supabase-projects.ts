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
  type Transaction,
} from "@/types/finance";
import type { Database } from "@/types/database";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];

function toIsoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function rowToTransaction(row: ProjectRow): Transaction | null {
  if (!isPlatform(row.platform) || !isCurrency(row.currency) || !isPaymentStatus(row.status)) {
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name ?? undefined,
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
  };
}

function transactionToRow(transaction: Transaction, userId: string): ProjectInsert {
  return {
    id: transaction.id,
    employee_id: transaction.employeeId || userId,
    created_by: transaction.createdBy || userId,
    title: transaction.title,
    client_id: transaction.clientId ?? null,
    client_name: transaction.clientName ?? null,
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
  };
}

export const supabaseProjectsRepository = {
  async load(): Promise<FinanceSnapshot> {
    const local = await loadSnapshot();
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const transactions = (data ?? [])
      .map(rowToTransaction)
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

    const { data: existing, error: existingError } = await supabase.from("projects").select("id");
    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingIds = (existing ?? []).map((row) => row.id);
    if (snapshot.transactions.length === 0 && existingIds.length > 0) {
      await savePreferences({
        lastKnownRates: snapshot.lastKnownRates,
        displayCurrency: snapshot.displayCurrency,
      });
      return;
    }

    const keepIds = new Set(snapshot.transactions.map((row) => row.id));
    const toDelete = existingIds.filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase.from("projects").delete().in("id", toDelete);
      if (deleteError) throw new Error(deleteError.message);
    }

    if (snapshot.transactions.length > 0) {
      const rows = snapshot.transactions.map((transaction) =>
        transactionToRow(transaction, user.id),
      );
      const { error: upsertError } = await supabase.from("projects").upsert(rows, { onConflict: "id" });
      if (upsertError) throw new Error(upsertError.message);
    }

    await savePreferences({
      lastKnownRates: snapshot.lastKnownRates,
      displayCurrency: snapshot.displayCurrency,
    });
  },

  serializeBackup,
  parseBackup: parseImportedBackup,
};
