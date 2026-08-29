import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export function getServiceRoleKey(): string | null {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return key || null;
}

export function createServiceRoleClient() {
  const key = getServiceRoleKey();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  const { url } = getSupabaseEnv();
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
