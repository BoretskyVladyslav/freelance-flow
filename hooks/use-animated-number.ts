"use client";

import { useLayoutEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Counts toward `targetValue` with ease-out cubic.
 * The first render returns `targetValue` so SSR and hydration match.
 * The animation starts in `useLayoutEffect`, before the browser paints.
 */
export function useAnimatedNumber(targetValue: number, duration = 600): number {
  const [value, setValue] = useState(targetValue);
  const valueRef = useRef(targetValue);
  const frameRef = useRef(0);
  const hasMountedRef = useRef(false);

  useLayoutEffect(() => {
    if (!Number.isFinite(targetValue) || prefersReducedMotion() || duration <= 0) {
      hasMountedRef.current = true;
      valueRef.current = targetValue;
      setValue(targetValue);
      return;
    }

    const from = hasMountedRef.current ? valueRef.current : 0;
    hasMountedRef.current = true;

    if (from === targetValue) {
      valueRef.current = targetValue;
      setValue(targetValue);
      return;
    }

    valueRef.current = from;
    setValue(from);

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = progress === 1 ? targetValue : roundCents(from + (targetValue - from) * eased);
      if (next !== valueRef.current) {
        valueRef.current = next;
        setValue(next);
      }
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        valueRef.current = targetValue;
        setValue(targetValue);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [duration, targetValue]);

  return value;
}
