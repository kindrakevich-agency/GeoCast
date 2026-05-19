"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import type {
  ApiLeaderboardMe,
  ApiLeaderboardResponse,
  ApiLeaderboardRow,
} from "@/lib/api/types";

export type LeaderboardPeriod = "today" | "week" | "all";

export type UseLeaderboardResult = {
  rows: ApiLeaderboardRow[];
  me: ApiLeaderboardMe | null;
  isLoading: boolean;
  error: ApiError | Error | null;
};

/**
 * Fetches `/api/leaderboard?period=<period>`. Re-runs whenever the
 * period changes. Returns the raw API rows — the consumer is free to
 * fall back to mock data on empty.
 */
export function useLeaderboard(period: LeaderboardPeriod): UseLeaderboardResult {
  const [rows, setRows] = useState<ApiLeaderboardRow[]>([]);
  const [me, setMe] = useState<ApiLeaderboardMe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await apiFetch<ApiLeaderboardResponse>(
          `/leaderboard?period=${period}`,
          { signal: ctrl.signal },
        );
        if (cancelled) return;
        setRows(data.rows ?? []);
        setMe(data.me ?? null);
      } catch (e) {
        if (cancelled) return;
        if ((e as Error).name === "AbortError") return;
        setError(e as Error);
        setRows([]);
        setMe(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [period]);

  return { rows, me, isLoading, error };
}
