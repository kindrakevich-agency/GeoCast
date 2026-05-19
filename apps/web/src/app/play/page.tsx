import { redirect } from "next/navigation";
import type { ApiRound } from "@/lib/api/types";

/**
 * Server-side redirect from the stable "Play" URL to whatever round is
 * currently live. Fetches /api/rounds/current at request time and 302s to
 * /rounds/{id}.
 *
 * Why this exists: the round page renders the *live* current round
 * regardless of URL slug, which makes /rounds/demo (or any URL) misleading.
 * Routing through /play guarantees the URL bar always shows the real round
 * ULID once you land on the game screen, so deep links + shares work.
 *
 * Fallback: if no round is live, send the user back to `/` where the
 * countdown-to-next-round UI lives.
 */
export const dynamic = "force-dynamic";

async function fetchCurrentRound(): Promise<ApiRound | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "https://geocast.kindrakevich.com/api";
  try {
    const res = await fetch(`${base}/rounds/current`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ApiRound;
  } catch {
    return null;
  }
}

export default async function PlayPage() {
  const round = await fetchCurrentRound();
  if (!round) redirect("/");
  redirect(`/rounds/${round.id}`);
}
