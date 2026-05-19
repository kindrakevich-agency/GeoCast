"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BottomHint } from "@/components/round/BottomHint";
import { ClaimBar } from "@/components/round/ClaimBar";
import { Confetti } from "@/components/round/Confetti";
import { ConfirmModal } from "@/components/round/ConfirmModal";
import { DistanceBadge } from "@/components/round/DistanceBadge";
import { Leaderboard } from "@/components/round/Leaderboard";
import { MapStage } from "@/components/map/MapStage";
import { QuestionCard } from "@/components/round/QuestionCard";
import { SidePanel } from "@/components/round/SidePanel";
import { TopBar } from "@/components/round/TopBar";
import { useCurrentRound } from "@/hooks/useCurrentRound";
import { useAuth } from "@/hooks/useAuth";
import { usePusherChannel } from "@/hooks/usePusherChannel";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { ApiPlacePredictionResponse } from "@/lib/api/types";
import { demoPlayers, demoPresence, demoRound, type LngLat } from "@/lib/mock";
import { rank, withUserPin } from "@/lib/scoring";

/**
 * Active round screen.
 *
 * Reads the round from /api/rounds/current (falls back to demoRound mock).
 *
 * Pin placement:
 *   - Authenticated + round is from API → POST /api/rounds/{id}/predictions,
 *     update local + auth-context state from the response.
 *   - Otherwise → local-only mock placement so the demo loop still works.
 */
export default function ActiveRoundPage() {
  const { round: liveRound, isLoading } = useCurrentRound();
  const { isAuthed, updateUser } = useAuth();

  const [pending, setPending] = useState<LngLat | null>(null);
  const [myPin, setMyPin] = useState<LngLat | null>(null);
  const [resolved, setResolved] = useState(false);
  const placed = myPin !== null;

  // Local pool/participants override populated from /predictions response.
  // (Live round state could lag — we got the authoritative numbers back from
  // the POST.)
  const [livePool, setLivePool] = useState<number | null>(null);
  const [liveParticipants, setLiveParticipants] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const usingLive = liveRound !== null;
  const round = liveRound ?? {
    id: demoRound.id,
    number: demoRound.number,
    question: demoRound.question,
    description: demoRound.description,
    opensAt: demoRound.opensAt,
    closesAt: demoRound.closesAt,
    poolCredits: demoRound.poolCredits,
    totalParticipants: demoRound.totalParticipants,
    status: demoRound.status,
    answer: demoRound.answer ?? null,
  };

  const displayPool = livePool ?? (round.poolCredits || demoRound.poolCredits);
  const displayParticipants =
    liveParticipants ?? (round.totalParticipants || demoRound.totalParticipants);

  const answer = round.answer ?? null;

  // ---------- Real-time (Pusher) ----------
  // Subscribe to `round-{id}` when the round is live (not the demo mock).
  // Server emits `pin-placed` on every successful POST /predictions and
  // `round-resolved` once on admin /resolve. No-op when Pusher isn't
  // configured (NEXT_PUBLIC_PUSHER_KEY unset) — the page still works
  // off synchronous API responses.
  const pusherChannel = usingLive ? `round-${round.id}` : null;
  usePusherChannel(pusherChannel, {
    "pin-placed": (data) => {
      const d = data as { count?: number; pool?: number };
      if (typeof d.count === "number") setLiveParticipants(d.count);
      if (typeof d.pool === "number") setLivePool(d.pool);
    },
    "round-resolved": (data) => {
      const d = data as { answer?: { lat: number; lng: number } };
      if (d.answer) {
        // The local `answer` variable is derived from `round` — we can't
        // mutate the API response here, so we trigger the resolution
        // choreography via local state. The user's own pin (myPin) and
        // demoPlayers seed the leaderboard until /api/rounds/{id}/results
        // lands. For now: just flip into the resolved view.
        setResolved(true);
      }
    },
  });

  const ranked = useMemo(() => {
    if (!resolved || !myPin || !answer) return null;
    const all = withUserPin(demoPlayers, myPin);
    return rank(all, answer, displayPool);
  }, [resolved, myPin, answer, displayPool]);

  const me = ranked?.find((e) => e.isMe) ?? null;
  const myDistance = me?.distanceKm ?? 0;
  const myRank = me?.rank ?? null;
  const myPayout = me?.payout ?? 0;
  const top10 = myRank !== null && myRank <= 10;

  const onMapClick = (coords: LngLat) => {
    if (placed || submitting) return;
    setSubmitError(null);
    setPending(coords);
  };

  // The full POST happy path is gated by: authenticated + live round.
  // Anonymous users / demo round → local-only mock placement.
  const shouldHitApi = isAuthed && usingLive;

  const onConfirm = async () => {
    if (!pending) return;
    const coords = pending;

    if (!shouldHitApi) {
      setMyPin(coords);
      setPending(null);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await apiFetch<ApiPlacePredictionResponse>(
        `/rounds/${round.id}/predictions`,
        { method: "POST", body: { lat: coords.lat, lng: coords.lng } },
      );

      setMyPin({ lat: result.prediction.lat, lng: result.prediction.lng });
      setLivePool(result.pool);
      setLiveParticipants(result.participants);
      updateUser({ creditsBalance: result.balance });
      setPending(null);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? humanizeApiError(e)
          : (e as Error).message || "Failed to place pin.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)] scanlines">
      <MapStage
        placed={placed}
        resolved={resolved}
        myPin={myPin}
        answer={resolved ? answer : null}
        presence={demoPresence}
        players={demoPlayers}
        onMapClick={onMapClick}
      />

      <TopBar wallet="0x7f4c…a3b1" balance={100} />

      <QuestionCard
        question={round.question}
        closesAt={round.closesAt}
        participants={displayParticipants}
        pool={displayPool}
        roundNumber={round.number}
        status={resolved ? "resolved" : "open"}
      />

      {!resolved && (
        <SidePanel
          open={placed}
          myPin={myPin}
          participants={displayParticipants}
          players={demoPlayers}
        />
      )}

      {!resolved && <BottomHint placed={placed} coords={myPin} />}

      <ConfirmModal
        open={pending !== null}
        coords={pending}
        onConfirm={onConfirm}
        onCancel={() => {
          setPending(null);
          setSubmitError(null);
        }}
      />

      {/* Submit error toast — sits above the BottomHint */}
      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            className="pointer-events-auto absolute bottom-24 left-1/2 z-40 -translate-x-1/2"
          >
            <div
              className="glass-strong flex items-center gap-3 rounded-full px-5 py-3 text-sm"
              style={{
                boxShadow: "0 0 0 1px rgba(255, 0, 110, 0.4), 0 8px 32px rgba(255, 0, 110, 0.25)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-magenta)", boxShadow: "0 0 10px var(--color-magenta)" }}
              />
              <span className="text-[var(--color-text)]">{submitError}</span>
              <button
                onClick={() => setSubmitError(null)}
                className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-white"
              >
                dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DistanceBadge distanceKm={myDistance} visible={resolved} />

      <Leaderboard
        open={resolved}
        entries={ranked ?? []}
        myRank={myRank}
        myPayout={myPayout}
      />

      <Confetti fire={resolved && top10} />

      {resolved && <ClaimBar payout={myPayout} />}

      {/* Source-of-truth indicator */}
      <div className="pointer-events-none fixed bottom-2 left-2 z-50 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] opacity-50">
        {isLoading
          ? "loading…"
          : usingLive
          ? `api · round #${round.number} · ${shouldHitApi ? "signed in" : "demo mode (sign in to play)"}`
          : "mock data"}
      </div>

      {placed && !resolved && (
        <button
          onClick={() => setResolved(true)}
          className="pointer-events-auto absolute bottom-6 right-4 z-40 rounded-full border border-dashed border-[var(--color-border)] bg-black/50 px-4 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--color-text-muted)] backdrop-blur-md transition-colors hover:border-[var(--color-magenta)] hover:text-white"
        >
          dev · resolve round →
        </button>
      )}

      {resolved && (
        <button
          onClick={() => {
            setResolved(false);
            setMyPin(null);
            setLivePool(null);
            setLiveParticipants(null);
          }}
          className="pointer-events-auto absolute bottom-6 right-4 z-40 rounded-full border border-dashed border-[var(--color-border)] bg-black/50 px-4 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--color-text-muted)] backdrop-blur-md transition-colors hover:border-[var(--color-cyan)] hover:text-white"
        >
          dev · reset round →
        </button>
      )}
    </main>
  );
}

function humanizeApiError(e: ApiError): string {
  // The API serializes errors as either { detail } (Symfony) or { error }
  // (custom). Pull whichever's there; fall back to status text.
  const body = e.body;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === "string") return b.detail;
    if (typeof b.error === "string") return b.error;
    if (typeof b.message === "string") return b.message;
  }
  if (e.status === 401) return "Please sign in to place a pin.";
  if (e.status === 409) return "Round closed or you've already placed a pin here.";
  if (e.status === 400) return "Coordinates rejected by the server.";
  return e.message || "Failed to place pin.";
}
