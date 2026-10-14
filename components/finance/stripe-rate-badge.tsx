"use client";

import { useState } from "react";
import { Coins } from "lucide-react";
import { useFinance } from "@/components/finance/finance-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMounted } from "@/hooks/use-mounted";
import { uahPerUnit, type FxSettings } from "@/lib/exchange-rates";
import { formatRate } from "@/lib/format";

function parseUserRate(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function draftFromRate(value: number): string {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

export function StripeRateBadge() {
  const {
    rates,
    fxSettings,
    saveFxSettings,
    isAdmin,
    recalculateRecentStripeRates,
    ratesRefreshing,
  } = useFinance();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(fxSettings.mode);
  const [eurDraft, setEurDraft] = useState("");
  const [usdDraft, setUsdDraft] = useState("");
  const [spreadDraft, setSpreadDraft] = useState(String(fxSettings.spreadPercent));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const eurPerUnit = mounted ? uahPerUnit("EUR", rates) : null;
  const usdToEur = mounted ? rates.toEur.USD : null;

  const syncDrafts = () => {
    setMode(fxSettings.mode);
    setSpreadDraft(String(fxSettings.spreadPercent));
    setEurDraft(
      fxSettings.eurUah !== undefined
        ? draftFromRate(fxSettings.eurUah)
        : eurPerUnit
          ? draftFromRate(eurPerUnit)
          : "",
    );
    setUsdDraft(
      fxSettings.usdEur !== undefined
        ? draftFromRate(fxSettings.usdEur)
        : usdToEur
          ? draftFromRate(usdToEur)
          : "",
    );
    setFormError(null);
  };

  const onSave = async () => {
    const eurUah = parseUserRate(eurDraft);
    const usdEur = parseUserRate(usdDraft);
    if (mode === "manual" && eurDraft.trim() && (eurUah === null || eurUah <= 5)) {
      setFormError("Курс 1 € вкажіть у гривнях, наприклад 49,80.");
      return;
    }
    if (mode === "manual" && usdDraft.trim() && (usdEur === null || usdEur >= 5)) {
      setFormError("Курс 1 $ вкажіть у євро, наприклад 0,85.");
      return;
    }
    const spread = Number(spreadDraft.replace(",", "."));
    const next: FxSettings = {
      mode,
      spreadPercent: Number.isFinite(spread) ? spread : fxSettings.spreadPercent,
      eurUah: mode === "manual" && eurUah !== null && eurUah > 5 ? eurUah : fxSettings.eurUah,
      usdEur: mode === "manual" && usdEur !== null && usdEur < 5 ? usdEur : fxSettings.usdEur,
    };
    setSaving(true);
    setFormError(null);
    try {
      await saveFxSettings(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) syncDrafts();
      }}
    >
      <PopoverTrigger
        className="inline-flex h-8 min-h-11 max-w-full items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-left text-xs font-medium text-blue-950 md:min-h-8 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100"
        aria-label="Курс Stripe"
      >
        <Coins className="size-3.5 shrink-0 text-blue-900 dark:text-blue-200" />
        <span className="truncate">
          Курс Stripe
          {mounted && eurPerUnit !== null && usdToEur !== null
            ? ` · 1 € = ${formatRate(eurPerUnit)} ₴ · 1 $ = ${formatRate(usdToEur)} €`
            : ""}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] gap-3 p-3" align="start">
        <div>
          <p className="font-medium text-blue-900 dark:text-blue-100">Курс Stripe</p>
          <p className="text-xs text-muted-foreground">
            {rates.fxMode === "manual"
              ? "Вручну, як на екрані Stripe"
              : rates.source === "stripe_settlement"
                ? "З останнього розрахунку Stripe"
                : `Авто, з FX комісією ${String(Math.abs(rates.spreadPercent ?? fxSettings.spreadPercent)).replace(".", ",")}%`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            className={`rounded-md px-2 py-2 text-xs font-medium ${mode === "stripe_auto" ? "bg-background text-blue-900 shadow-sm" : "text-muted-foreground"}`}
            aria-pressed={mode === "stripe_auto"}
            onClick={() => setMode("stripe_auto")}
          >
            Stripe Auto
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-2 text-xs font-medium ${mode === "manual" ? "bg-background text-blue-900 shadow-sm" : "text-muted-foreground"}`}
            aria-pressed={mode === "manual"}
            onClick={() => setMode("manual")}
          >
            Вручну
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {mode === "stripe_auto"
            ? "З урахуванням FX комісії Stripe"
            : "Точний курс з екрана інвойса Stripe"}
        </p>

        {mode === "stripe_auto" ? (
          <label className="flex flex-col gap-1 text-xs">
            FX комісія, %
            <Input
              inputMode="decimal"
              value={spreadDraft}
              onChange={(event) => setSpreadDraft(event.target.value)}
              aria-label="FX комісія Stripe у відсотках"
            />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs">
              1 € = ₴
              <Input
                inputMode="decimal"
                value={eurDraft}
                onChange={(event) => setEurDraft(event.target.value)}
                aria-label="Гривень за 1 євро"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              1 $ = €
              <Input
                inputMode="decimal"
                value={usdDraft}
                onChange={(event) => setUsdDraft(event.target.value)}
                aria-label="Євро за 1 долар"
              />
            </label>
          </div>
        )}

        {formError ? <p className="text-xs text-rose-600">{formError}</p> : null}

        <div className="flex flex-col gap-2">
          <Button type="button" size="sm" onClick={() => void onSave()} disabled={saving || ratesRefreshing}>
            Зберегти курс
          </Button>
          {isAdmin ? (
            <Button type="button" size="sm" variant="outline" onClick={recalculateRecentStripeRates}>
              Перерахувати з 1 серпня
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
