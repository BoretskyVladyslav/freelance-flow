import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authCookieOptions, mergeAuthCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = cookies();
  const secure = process.env.NODE_ENV === "production";

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: authCookieOptions(secure),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        void headers;
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, mergeAuthCookieOptions(options, secure));
          });
        } catch {
          // Called from a Server Component; middleware refreshes the session.
        }
      },
    },
  });
}
