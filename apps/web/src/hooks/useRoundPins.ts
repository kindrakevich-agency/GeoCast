"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api/client";

/**
 * Anonymized pins for a round. Returns [] for:
 *   - Open round + caller hasn't placed yet (server hides until commit)
 *   - Anonymous caller on an open round
 *   - Scheduled rounds (no pins yet)
 *
 * Refetches when the round id changes or when refetchKey changes (the
 * round page bumps this after a successful pin placement so the heatmap
 * picks up the new aggregate immediately).
 */
export function useRoundPins(
  roundId: string | null | undefined,
  refetchKey: number = 0,
): { pins: Array<{ lat: number; lng: number }>; isLoading: boolean; error: ApiError | Error | null } {
  const [pins, setPins] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    if (!roundId) return;
    setIsLoading(true);
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<Array<{ lat: number; lng: number }>>(
          `/rounds/${roundId}/pins`,
          { signal: ctrl.signal },
        );
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
  }, [roundId, refetchKey]);

  return { pins, isLoading, error };
}
