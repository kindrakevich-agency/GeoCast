"use client";

import { useEffect, useState } from "react";

export type Countdown = {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

const compute = (targetMs: number): Countdown => {
  const total = Math.max(0, targetMs - Date.now());
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  return { total, days, hours, minutes, seconds, expired: total === 0 };
};

const ZERO: Countdown = { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: false };

export function useCountdown(targetIso: string): { countdown: Countdown; ready: boolean } {
  const targetMs = new Date(targetIso).getTime();
  // Deterministic initial state (no Date.now during SSR) — then sync on mount.
  const [state, setState] = useState<Countdown>(ZERO);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(compute(targetMs));
    setReady(true);
    const id = window.setInterval(() => setState(compute(targetMs)), 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  return { countdown: state, ready };
}

export const pad = (n: number) => String(n).padStart(2, "0");

export function formatCountdown(c: Countdown): string {
  if (c.expired) return "00:00";
  if (c.days > 0) return `${c.days}d ${pad(c.hours)}h ${pad(c.minutes)}m`;
  if (c.hours > 0) return `${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`;
  return `${pad(c.minutes)}:${pad(c.seconds)}`;
}
