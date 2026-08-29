import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type ServerClient = ReturnType<typeof createServerSupabaseClient>;

type AdminSession =
  | { ok: true; supabase: ServerClient; user: User }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminSession> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Не авторизовано." }, { status: 401 }),
    };
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Недостатньо прав." }, { status: 403 }),
    };
  }

  return { ok: true, supabase, user };
}
