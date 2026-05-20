"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { ApiStats } from "@/lib/api/types";

export type UseStatsResult = {
  stats: ApiStats | null;
  isLoading: boolean;
  error: ApiError | Error | null;
};

/**
 * Loads GET /api/stats once on mount. Anonymous-friendly (public firewall).
 * Returns null until the response lands; the caller falls back to mock
 * numbers so the landing never shows a loading flash.
 */
export function useStats(): UseStatsResult {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<ApiStats>("/stats", {
          signal: ctrl.signal,
          anonymous: true,
        });
        if (!cancelled) setStats(data);
      } catch (e) {
        if (cancelled) return;
        if ((e as Error).name === "AbortError") return;
        setError(e as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  return { stats, isLoading, error };
}
