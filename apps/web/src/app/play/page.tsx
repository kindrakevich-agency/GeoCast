import { redirect } from "next/navigation";
import type { ApiRound } from "@/lib/api/types";
import { UpcomingRoundView } from "./UpcomingRoundView";

/**
 * "Play" entry point — the URL the Game nav link points at. Resolution
 * order:
 *
 *   1. /api/rounds/current returns an open round  → 302 to /rounds/{id}
 *   2. /api/rounds/upcoming returns a scheduled    → render the "next
 *      round opens in Xh Ym" countdown page (no redirect)
 *   3. Neither                                     → 302 to /
 *
 * The countdown branch matters for the continuous-rounds model: between
 * the moment round N closes and round N+1 opens (1 second), the SSR
 * would otherwise bounce players to home. With this branch they land
 * on a "wait for the next round" page instead.
 */
export const dynamic = "force-dynamic";

async function fetchJson<T>(path: string): Promise<T | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "https://geocast.games/api";
  try {
    const res = await fetch(`${base}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function PlayPage() {
  const current = await fetchJson<ApiRound>("/rounds/current");
  if (current) {
    redirect(`/rounds/${current.id}`);
  }

  const upcoming = await fetchJson<ApiRound>("/rounds/upcoming");
  if (upcoming) {
    return <UpcomingRoundView round={upcoming} />;
  }

  redirect("/");
}
