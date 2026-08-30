import { createBrowserClient } from "@supabase/ssr";
import { authCookieOptions, isHttpsProtocol } from "@/lib/supabase/cookie-options";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export function createBrowserSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  const secure =
    typeof window !== "undefined" ? isHttpsProtocol(window.location.protocol) : true;
  return createBrowserClient<Database>(url, anonKey, {
    cookieOptions: authCookieOptions(secure),
  });
}
