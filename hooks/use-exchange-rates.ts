"use client";

import { useCallback, useEffect, useState } from "react";
import { LAST_RESORT_RATES } from "@/lib/exchange-rates";
import { isExchangeRates, type ExchangeRates } from "@/types/finance";

type ExchangeRateState = {
  rates: ExchangeRates;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
};

export function useExchangeRates(persistedRates: ExchangeRates | null) {
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
      const response = await fetch(
        refresh ? "/api/exchange-rates?refresh=1" : "/api/exchange-rates",
        { cache: refresh ? "no-store" : "default" },
      );
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
  }, []);

  useEffect(() => {
    void fetchRates(false);
  }, [fetchRates]);

  useEffect(() => {
    if (!persistedRates) return;
    setState((current) =>
      current.rates.stale
        ? { ...current, rates: { ...persistedRates, stale: true } }
        : current,
    );
  }, [persistedRates]);

  return {
    ...state,
    refresh: () => fetchRates(true),
  };
}
