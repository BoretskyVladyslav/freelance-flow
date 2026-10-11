"use client";

import { useEffect, useRef, useState } from "react";

type CountUpOptions = {
  duration?: number;
  decimals?: number;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Ease-out count toward `value`.
 * The first render and the hydration commit keep the exact value so SSR matches.
 * Later updates (period or employee filters) animate.
 */
export function useCountUp(value: number, options?: CountUpOptions): number {
  const duration = options?.duration ?? 400;
  const decimals = options?.decimals ?? 2;
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const hydratedRef = useRef(false);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      displayRef.current = value;
      setDisplay(value);
      return;
    }

    if (!Number.isFinite(value) || prefersReducedMotion() || duration <= 0) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }

    const from = displayRef.current;
    if (from === value) return;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = progress === 1 ? value : roundTo(from + (value - from) * eased, decimals);
      if (next !== displayRef.current) {
        displayRef.current = next;
        setDisplay(next);
      }
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = value;
        setDisplay(value);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [decimals, duration, value]);

  return display;
}
