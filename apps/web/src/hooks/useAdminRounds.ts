"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch, getValidToken } from "@/lib/api/client";
import type { ApiAdminRound } from "@/lib/api/types";

export type UseAdminRoundsResult = {
  rounds: ApiAdminRound[];
  isLoading: boolean;
  isSettled: boolean;
  error: ApiError | Error | null;
  refetch: () => void;
};

/**
 * Loads GET /api/admin/rounds. Auth-gated server-side; calling this when
 * the local user isn't admin returns 401/403 → falls into error state.
 */
export function useAdminRounds(): UseAdminRoundsResult {
  const [rounds, setRounds] = useState<ApiAdminRound[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [bump, setBump] = useState(0);

  const refetch = useCallback(() => setBump((n) => n + 1), []);

  useEffect(() => {
    if (!getValidToken()) {
      setIsSettled(true);
      return;
    }
    setIsLoading(true);
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<ApiAdminRound[]>("/admin/rounds", {
          signal: ctrl.signal,
        });
        if (!cancelled) setRounds(data);
      } catch (e) {
        if (cancelled) return;
        if ((e as Error).name === "AbortError") return;
        setError(e as Error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsSettled(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [bump]);

  return { rounds, isLoading, isSettled, error, refetch };
}
