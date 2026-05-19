"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch, getValidToken } from "@/lib/api/client";
import type { ApiCareerPin } from "@/lib/api/types";

export type UseCareerPinsResult = {
  pins: ApiCareerPin[] | null;
  /** True until we've either resolved a response or skipped (unauthed). */
  isLoading: boolean;
  /** True when we've confirmed the user has zero career pins (vs still loading). */
  isSettled: boolean;
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
  const [isSettled, setIsSettled] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    if (!getValidToken()) {
      // No token → there's nothing to load. Consider the hook "settled"
      // immediately so the consumer can fall through to the unauthed UI.
      setIsSettled(true);
      return;
    }
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
  }, []);

  return { pins, isLoading, isSettled, error };
}
