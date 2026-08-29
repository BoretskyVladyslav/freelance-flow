"use client";

import { useState } from "react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const configured = isSupabaseConfigured();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) {
      toast.error("Supabase не налаштовано.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        toast.error(error?.message ?? "Невірний email або пароль.");
        return;
      }

      const withStatus = await supabase
        .from("profiles")
        .select("id, status")
        .eq("id", data.user.id)
        .maybeSingle();

      const profile =
        withStatus.error && /status/i.test(withStatus.error.message)
          ? await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle()
          : withStatus;

      if (profile.error) {
        await supabase.auth.signOut();
        toast.error(profile.error.message);
        return;
      }

      const status =
        profile.data && "status" in profile.data ? profile.data.status : "active";
      if (!profile.data || status === "disabled") {
        await supabase.auth.signOut();
        toast.error("Доступ закрито. Зверніться до адміністратора.");
        return;
      }

      window.location.assign("/");
    } finally {
      setSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-sm text-muted-foreground">
        Додайте NEXT_PUBLIC_SUPABASE_URL і NEXT_PUBLIC_SUPABASE_ANON_KEY у `.env.local`, щоб увімкнути
        вхід.
      </p>
    );
  }

  return (
    <form method="post" action="/login" onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="username"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <button type="submit" disabled={submitting} className={cn(buttonVariants(), "w-full")}>
        Увійти
      </button>
    </form>
  );
}
