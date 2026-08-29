import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function denyProduction() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") return denyProduction();
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ available: false, hasAdmin: false });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc("has_admin");
  if (error) {
    return NextResponse.json(
      { available: true, hasAdmin: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ available: true, hasAdmin: Boolean(data) });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return denyProduction();
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    fullName?: string;
  };
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const fullName = body.fullName?.trim() ?? "";

  if (!email || password.length < 8) {
    return NextResponse.json(
      { error: "Потрібні email і пароль щонайменше з 8 символів." },
      { status: 400 },
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: hasAdmin, error: adminCheckError } = await supabase.rpc("has_admin");
  if (adminCheckError) {
    return NextResponse.json({ error: adminCheckError.message }, { status: 500 });
  }
  if (hasAdmin) {
    return NextResponse.json({ error: "Адмін уже існує." }, { status: 409 });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    needsEmailConfirmation: !data.session,
    userId: data.user?.id ?? null,
  });
}
