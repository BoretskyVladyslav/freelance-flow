"use client";

import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type LogoutButtonProps = {
  compact?: boolean;
};

export function LogoutButton({ compact = false }: LogoutButtonProps) {
  if (!isSupabaseConfigured()) return null;

  async function onLogout() {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    window.location.assign("/login");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="Вийти"
      className={compact ? "h-8 w-8 p-0" : undefined}
      onClick={() => void onLogout()}
    >
      <LogOut />
      {compact ? <span className="sr-only">Вийти</span> : "Вийти"}
    </Button>
  );
}
