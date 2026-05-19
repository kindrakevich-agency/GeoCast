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

export function useCountdown(targetIso: string): Countdown {
  const targetMs = new Date(targetIso).getTime();
  const [state, setState] = useState<Countdown>(() => compute(targetMs));

  useEffect(() => {
    const id = window.setInterval(() => setState(compute(targetMs)), 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  return state;
}

export const pad = (n: number) => String(n).padStart(2, "0");

export function formatCountdown(c: Countdown): string {
  if (c.expired) return "00:00";
  if (c.days > 0) return `${c.days}d ${pad(c.hours)}h ${pad(c.minutes)}m`;
  if (c.hours > 0) return `${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`;
  return `${pad(c.minutes)}:${pad(c.seconds)}`;
}
