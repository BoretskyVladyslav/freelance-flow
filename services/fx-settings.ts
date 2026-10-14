import { parseFxSettings, type FxSettings } from "@/lib/exchange-rates";
import { loadStoredFxSettings, saveStoredFxSettings } from "@/lib/storage";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const FX_ROW_ID = "default";

function fromCloudRow(row: {
  mode?: string | null;
  spread_percent?: number | string | null;
  eur_uah?: number | string | null;
  usd_eur?: number | string | null;
}): FxSettings {
  return parseFxSettings({
    mode: row.mode,
    spreadPercent: row.spread_percent == null ? undefined : Number(row.spread_percent),
    eurUah: row.eur_uah == null ? undefined : Number(row.eur_uah),
    usdEur: row.usd_eur == null ? undefined : Number(row.usd_eur),
  });
}

export async function loadFxSettings(): Promise<FxSettings> {
  const local = parseFxSettings(await loadStoredFxSettings());
  if (!isSupabaseConfigured()) return local;

  try {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("fx_settings")
      .select("*")
      .eq("id", FX_ROW_ID)
      .maybeSingle();
    if (error || !data) return local;
    const remote = fromCloudRow(data);
    await saveStoredFxSettings(remote);
    return remote;
  } catch {
    return local;
  }
}

export async function saveFxSettings(
  settings: FxSettings,
): Promise<{ cloud: boolean; warning?: string }> {
  const parsed = parseFxSettings(settings);
  await saveStoredFxSettings(parsed);
  if (!isSupabaseConfigured()) return { cloud: false };

  try {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("fx_settings").upsert({
      id: FX_ROW_ID,
      mode: parsed.mode,
      spread_percent: parsed.spreadPercent,
      eur_uah: parsed.eurUah ?? null,
      usd_eur: parsed.usdEur ?? null,
    });
    if (error) return { cloud: false, warning: error.message };
    return { cloud: true };
  } catch (error) {
    return {
      cloud: false,
      warning: error instanceof Error ? error.message : "Не вдалося записати курс у хмару.",
    };
  }
}
