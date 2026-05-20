"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch, getValidToken } from "@/lib/api/client";

export type AdminSuggestion = {
  id: string;
  resolverCode: string;
  resolverParams: Record<string, unknown>;
  question: string;
  opensAt: string;
  closesAt: string;
  resolvesAt: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  preview: Record<string, unknown> | null;
  createdAt: string;
  usedForRoundId: string | null;
};

export type UseAdminSuggestionsResult = {
  suggestions: AdminSuggestion[];
  isLoading: boolean;
  isSettled: boolean;
  error: ApiError | Error | null;
  refetch: () => void;
};

/**
 * Mirrors useAdminRounds. Hits /api/admin/suggestions (admin-only), returns
 * pending suggestions newest-first.
 */
export function useAdminSuggestions(): UseAdminSuggestionsResult {
  const [suggestions, setSuggestions] = useState<AdminSuggestion[]>([]);
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
        const data = await apiFetch<AdminSuggestion[]>("/admin/suggestions", {
          signal: ctrl.signal,
        });
        if (!cancelled) setSuggestions(data);
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

  return { suggestions, isLoading, isSettled, error, refetch };
}
