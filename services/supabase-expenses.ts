import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Expense } from "@/types/finance";
import { isCurrency } from "@/types/finance";

const LOCAL_STORAGE_KEY = "freelance_flow_expenses";

function getLocalExpenses(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalExpenses(expenses: Expense[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(expenses));
  } catch {}
}

export async function getExpenses(): Promise<Expense[]> {
  if (!isSupabaseConfigured()) {
    return getLocalExpenses();
  }

  try {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false });

    if (error) {
      console.warn("Could not fetch expenses from Supabase, falling back to local:", error.message);
      return getLocalExpenses();
    }

    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      amount: Number(row.amount),
      currency: isCurrency(row.currency) ? row.currency : "UAH",
      expense_date: row.expense_date,
      created_at: row.created_at,
    }));
  } catch {
    return getLocalExpenses();
  }
}

export async function addExpense(
  expense: Omit<Expense, "id" | "created_at"> & { id?: string },
): Promise<Expense> {
  const newExpense: Expense = {
    id:
      expense.id ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `exp_${Date.now()}`),
    title: expense.title.trim(),
    amount: expense.amount,
    currency: expense.currency || "UAH",
    expense_date: expense.expense_date || new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    const list = getLocalExpenses();
    saveLocalExpenses([newExpense, ...list]);
    return newExpense;
  }

  try {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        id: newExpense.id,
        title: newExpense.title,
        amount: newExpense.amount,
        currency: newExpense.currency,
        expense_date: newExpense.expense_date,
      })
      .select()
      .single();

    if (error) {
      console.warn("Supabase insert error, falling back to local:", error.message);
      const list = getLocalExpenses();
      saveLocalExpenses([newExpense, ...list]);
      return newExpense;
    }

    return {
      id: data.id,
      title: data.title,
      amount: Number(data.amount),
      currency: isCurrency(data.currency) ? data.currency : "UAH",
      expense_date: data.expense_date,
      created_at: data.created_at,
    };
  } catch {
    const list = getLocalExpenses();
    saveLocalExpenses([newExpense, ...list]);
    return newExpense;
  }
}

export async function deleteExpense(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const list = getLocalExpenses();
    saveLocalExpenses(list.filter((e) => e.id !== id));
    return;
  }

  try {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      console.warn("Supabase delete error:", error.message);
      const list = getLocalExpenses();
      saveLocalExpenses(list.filter((e) => e.id !== id));
    }
  } catch {
    const list = getLocalExpenses();
    saveLocalExpenses(list.filter((e) => e.id !== id));
  }
}
