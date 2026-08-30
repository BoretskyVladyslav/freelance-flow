"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidEmail, sanitizeEmail } from "@/lib/auth/credentials";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const configured = isSupabaseConfigured();

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      toast.error("Supabase не налаштовано.");
      return;
    }
    const cleanEmail = sanitizeEmail(email);
    setEmail(cleanEmail);
    if (!isValidEmail(cleanEmail)) {
      toast.error("Введіть коректну email-адресу.");
      return;
    }
    if (!password) {
      toast.error("Введіть пароль.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
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
    <form
      method="post"
      action="/login"
      noValidate
      onSubmit={handleLogin}
      className="grid gap-4 touch-manipulation"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="username"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          lang="en"
          enterKeyHint="go"
          value={email}
          onChange={(event) => setEmail(event.target.value.trim())}
          placeholder="you@company.com"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Пароль</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pr-9"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={showPassword ? "Сховати пароль" : "Показати пароль"}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <button type="submit" disabled={submitting} className={cn(buttonVariants(), "w-full")}>
        Увійти
      </button>
    </form>
  );
}
