"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch, getValidToken } from "@/lib/api/client";
import type { ApiUser } from "@/lib/api/types";

export type UseMeResult = {
  user: ApiUser | null;
  isLoading: boolean;
  /** True while we have a JWT in storage and are awaiting the response. */
  isAuthed: boolean;
  error: ApiError | Error | null;
};

/**
 * Loads `/api/me` when a JWT is present in localStorage. When no JWT,
 * returns user: null without making any request — the caller is expected
 * to render the unauthenticated state (e.g. mock profile placeholder).
 */
export function useMe(): UseMeResult {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    const token = getValidToken();
    if (!token) {
      setIsAuthed(false);
      setIsLoading(false);
      return;
    }
    setIsAuthed(true);
    setIsLoading(true);

    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<ApiUser>("/me", { signal: ctrl.signal });
        if (!cancelled) setUser(data);
      } catch (e) {
        if (cancelled) return;
        if ((e as Error).name === "AbortError") return;
        setError(e as Error);
        // If we got a 401 the token is stale — let the caller decide
        // whether to clear it. We don't auto-clear here.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  return { user, isLoading, isAuthed, error };
}
