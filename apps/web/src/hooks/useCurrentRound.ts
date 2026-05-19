"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { ApiRound } from "@/lib/api/types";

export type UseCurrentRoundResult = {
  round: ApiRound | null;
  isLoading: boolean;
  error: ApiError | Error | null;
};

/**
 * Fetches `/api/rounds/current` on mount.
 *
 * Returns `round: null` for both states "no round is open right now" and
 * "API errored" — the caller decides whether to fall back to mock data.
 */
export function useCurrentRound(): UseCurrentRoundResult {
  const [round, setRound] = useState<ApiRound | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<ApiRound | null>("/rounds/current", {
          anonymous: true,
          signal: ctrl.signal,
        });
        if (!cancelled) setRound(data);
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

  return { round, isLoading, error };
}
