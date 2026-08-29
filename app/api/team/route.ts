import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient, getServiceRoleKey } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";
import type { ProfileStatus, TeamMember } from "@/types/team";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: readonly UserRole[] = ["admin", "employee"];

function asStatus(value: unknown): ProfileStatus {
  return value === "disabled" ? "disabled" : "active";
}

async function loadMembers(
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<TeamMember[]> {
  const withStatus = await supabase
    .from("profiles")
    .select("id, email, role, full_name, created_at, status")
    .order("created_at", { ascending: true });

  const rows =
    withStatus.error && /status/i.test(withStatus.error.message)
      ? await supabase
          .from("profiles")
          .select("id, email, role, full_name, created_at")
          .order("created_at", { ascending: true })
      : withStatus;

  if (rows.error) {
    throw new Error(rows.error.message);
  }

  const members: TeamMember[] = (rows.data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    createdAt: row.created_at,
    status: asStatus("status" in row ? row.status : "active"),
  }));

  if (!getServiceRoleKey()) return members;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error || !data?.users) return members;
    const banned = new Map(
      data.users.map((user) => [
        user.id,
        Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
      ]),
    );
    return members.map((member) =>
      banned.get(member.id) ? { ...member, status: "disabled" } : member,
    );
  } catch {
    return members;
  }
}

export async function GET() {
  const session = await requireAdmin();
  if (!session.ok) return session.response;

  try {
    const members = await loadMembers(session.supabase);
    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не вдалося завантажити команду.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session.ok) return session.response;

  if (!getServiceRoleKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY не налаштовано на сервері." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    fullName?: string;
    role?: string;
  };

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const fullName = body.fullName?.trim() ?? "";
  const role = body.role as UserRole | undefined;

  if (!EMAIL_RE.test(email) || password.length < 8 || !fullName || !role || !ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Потрібні email, імʼя, роль і пароль щонайменше з 8 символів." },
      { status: 400 },
    );
  }

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "Не вдалося створити користувача." },
        { status: 400 },
      );
    }

    const userId = data.user.id;
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    const profileError = existing
      ? (
          await admin
            .from("profiles")
            .update({ email, role, full_name: fullName, status: "active" })
            .eq("id", userId)
        ).error
      : (
          await admin.from("profiles").insert({
            id: userId,
            email,
            role,
            full_name: fullName,
            status: "active",
          })
        ).error;

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не вдалося додати працівника.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
