"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_STRIPE_FX_SPREAD_PERCENT, LAST_RESORT_RATES } from "@/lib/exchange-rates";
import { isExchangeRates, type ExchangeRates } from "@/types/finance";

type ExchangeRateState = {
  rates: ExchangeRates;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
};

export function useExchangeRates(
  persistedRates: ExchangeRates | null,
  spreadPercent = DEFAULT_STRIPE_FX_SPREAD_PERCENT,
  enabled = true,
) {
  const fallback = persistedRates ?? LAST_RESORT_RATES;
  const [state, setState] = useState<ExchangeRateState>({
    rates: { ...fallback, stale: true },
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchRates = useCallback(async (refresh = false) => {
    setState((current) => ({
      ...current,
      loading: current.loading || !refresh,
      refreshing: refresh,
      error: null,
    }));

    try {
      const params = new URLSearchParams();
      params.set("spread", String(spreadPercent));
      if (refresh) params.set("refresh", "1");
      const response = await fetch(`/api/exchange-rates?${params.toString()}`, {
        cache: refresh ? "no-store" : "default",
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok || !isExchangeRates(payload)) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Актуальний курс недоступний.";
        throw new Error(message);
      }

      setState({
        rates: { ...payload, stale: false },
        loading: false,
        error: null,
        refreshing: false,
      });
      return payload;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Актуальний курс недоступний.";
      setState((current) => ({
        rates: { ...current.rates, stale: true },
        loading: false,
        error: message,
        refreshing: false,
      }));
      return null;
    }
  }, [spreadPercent]);

  useEffect(() => {
    if (!enabled) return;
    void fetchRates(false);
  }, [enabled, fetchRates]);

  useEffect(() => {
    if (!persistedRates) return;
    setState((current) =>
      current.rates.stale
        ? { ...current, rates: { ...persistedRates, stale: true } }
        : current,
    );
  }, [persistedRates]);

  const refresh = useCallback(() => fetchRates(true), [fetchRates]);

  return useMemo(
    () => ({
      rates: state.rates,
      loading: state.loading,
      error: state.error,
      refreshing: state.refreshing,
      refresh,
    }),
    [refresh, state.error, state.loading, state.rates, state.refreshing],
  );
}
