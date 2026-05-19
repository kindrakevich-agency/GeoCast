"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch, getStoredToken } from "@/lib/api/client";
import type { ApiCareerPin } from "@/lib/api/types";

export type UseCareerPinsResult = {
  pins: ApiCareerPin[] | null;
  isLoading: boolean;
  error: ApiError | Error | null;
};

/**
 * Loads /api/me/career-pins when a JWT is present. Returns null when
 * unauthenticated — the caller falls back to mock data so the page never
 * looks empty for visitors.
 */
export function useCareerPins(): UseCareerPinsResult {
  const [pins, setPins] = useState<ApiCareerPin[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    if (!getStoredToken()) return;
    setIsLoading(true);
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<ApiCareerPin[]>("/me/career-pins", { signal: ctrl.signal });
        if (!cancelled) setPins(data);
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

  return { pins, isLoading, error };
}
