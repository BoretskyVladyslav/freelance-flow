function isPlaceholderUrl(url: string): boolean {
  return /YOUR_SUPABASE_PROJECT_REF|your-project-ref|\[YOUR_/i.test(url);
}

export function normalizeSupabaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function isSupabaseConfigured(): boolean {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  return Boolean(url && anonKey && !isPlaceholderUrl(url));
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey || isPlaceholderUrl(url)) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}
