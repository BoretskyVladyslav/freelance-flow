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
 * Ease-out count toward `value` over about 500ms.
 * The displayed amount starts at 0, so the first mount counts up, and later
 * filter or currency changes continue from the number already on screen.
 * Reduced motion snaps to the target. Mount this only after hydration.
 */
export function useCountUp(value: number, options?: CountUpOptions): number {
  const duration = options?.duration ?? 500;
  const decimals = options?.decimals ?? 2;
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    if (!Number.isFinite(value) || prefersReducedMotion() || duration <= 0) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const from = displayRef.current;
    if (from === target) return;

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = progress === 1 ? target : roundTo(from + (target - from) * eased, decimals);
      if (next !== displayRef.current) {
        displayRef.current = next;
        setDisplay(next);
      }
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = target;
        setDisplay(target);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [decimals, duration, value]);

  return display;
}
