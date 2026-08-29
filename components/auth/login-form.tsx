"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [setupAvailable, setSetupAvailable] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !configured) return;
    void fetch("/api/setup-admin")
      .then((response) => response.json())
      .then((payload: { available?: boolean; hasAdmin?: boolean }) => {
        setSetupAvailable(Boolean(payload.available && !payload.hasAdmin));
      })
      .catch(() => {
        setSetupAvailable(false);
      });
  }, [configured]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) {
      toast.error("Supabase не налаштовано.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function onCreateAdmin() {
    if (!configured) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/setup-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });
      const payload = (await response.json()) as {
        error?: string;
        needsEmailConfirmation?: boolean;
      };
      if (!response.ok) {
        toast.error(payload.error ?? "Не вдалося створити адміна.");
        return;
      }
      if (payload.needsEmailConfirmation) {
        toast.success("Адміна створено. Підтвердіть email, потім увійдіть.");
        return;
      }
      toast.success("Адміна створено.");
      router.replace("/");
      router.refresh();
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
    <form onSubmit={onSubmit} className="grid gap-4">
      {setupAvailable ? (
        <div className="grid gap-1.5">
          <Label htmlFor="fullName">Повне імʼя</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Владислав"
          />
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
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
          type="password"
          autoComplete={setupAvailable ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        Увійти
      </Button>
      {setupAvailable ? (
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          className="w-full"
          onClick={() => void onCreateAdmin()}
        >
          Створити першого адміна (dev)
        </Button>
      ) : null}
    </form>
  );
}
