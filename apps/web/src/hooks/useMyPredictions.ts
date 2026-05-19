"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch, getStoredToken } from "@/lib/api/client";
import type { ApiPredictionHistoryResponse } from "@/lib/api/types";

export type UseMyPredictionsResult = {
  data: ApiPredictionHistoryResponse | null;
  isLoading: boolean;
  error: ApiError | Error | null;
};

/**
 * Loads /api/me/predictions?page=1&perPage=N when a JWT is present.
 * Returns null when unauthenticated — caller falls back to mock.
 */
export function useMyPredictions(perPage: number = 10): UseMyPredictionsResult {
  const [data, setData] = useState<ApiPredictionHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    if (!getStoredToken()) return;
    setIsLoading(true);
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const result = await apiFetch<ApiPredictionHistoryResponse>(
          `/me/predictions?page=1&perPage=${perPage}`,
          { signal: ctrl.signal },
        );
        if (!cancelled) setData(result);
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
  }, [perPage]);

  return { data, isLoading, error };
}
