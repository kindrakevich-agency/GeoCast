"use client";

import { useMemo, useState } from "react";
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
import { demoPlayers, demoPresence, demoRound, type LngLat } from "@/lib/mock";
import { rank, withUserPin } from "@/lib/scoring";

/**
 * Active round screen. Tries to fetch the live round from /api/rounds/current.
 * Falls back to demoRound mock when the API returns null (no open round) or
 * errors (which would also be `null` per the hook). The frontend therefore
 * always has something to render — no blank state.
 */
export default function ActiveRoundPage() {
  const [pending, setPending] = useState<LngLat | null>(null);
  const [myPin, setMyPin] = useState<LngLat | null>(null);
  const [resolved, setResolved] = useState(false);
  const placed = myPin !== null;

  const { round: liveRound, isLoading } = useCurrentRound();

  // Normalize whatever we have into the shape the components expect.
  // Live round (when present) → use its fields. Otherwise → demo mock.
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

  const answer = round.answer ?? null;

  // For the resolution choreography we still use the rich demoPlayers
  // dataset since the API doesn't return all-players-in-round for the
  // anonymous reader (that arrives in a future Pusher event).
  const ranked = useMemo(() => {
    if (!resolved || !myPin || !answer) return null;
    const all = withUserPin(demoPlayers, myPin);
    return rank(all, answer, round.poolCredits || demoRound.poolCredits);
  }, [resolved, myPin, answer, round.poolCredits]);

  const me = ranked?.find((e) => e.isMe) ?? null;
  const myDistance = me?.distanceKm ?? 0;
  const myRank = me?.rank ?? null;
  const myPayout = me?.payout ?? 0;
  const top10 = myRank !== null && myRank <= 10;

  const onMapClick = (coords: LngLat) => {
    if (placed) return;
    setPending(coords);
  };

  const onConfirm = () => {
    if (pending) setMyPin(pending);
    setPending(null);
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

      <TopBar wallet="0x7f4c…a3b1" balance={placed ? 99 + myPayout : 100} />

      <QuestionCard
        question={round.question}
        closesAt={round.closesAt}
        participants={round.totalParticipants || demoRound.totalParticipants}
        pool={round.poolCredits || demoRound.poolCredits}
        roundNumber={round.number}
        status={resolved ? "resolved" : "open"}
      />

      {!resolved && (
        <SidePanel
          open={placed}
          myPin={myPin}
          participants={round.totalParticipants || demoRound.totalParticipants}
          players={demoPlayers}
        />
      )}

      {!resolved && <BottomHint placed={placed} coords={myPin} />}

      <ConfirmModal
        open={pending !== null}
        coords={pending}
        onConfirm={onConfirm}
        onCancel={() => setPending(null)}
      />

      <DistanceBadge distanceKm={myDistance} visible={resolved} />

      <Leaderboard
        open={resolved}
        entries={ranked ?? []}
        myRank={myRank}
        myPayout={myPayout}
      />

      <Confetti fire={resolved && top10} />

      {resolved && <ClaimBar payout={myPayout} />}

      {/* Source-of-truth indicator — discreet, dev-only signal that the
          page is reading live data vs the local mock. */}
      <div className="pointer-events-none fixed bottom-2 left-2 z-50 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] opacity-50">
        {isLoading ? "loading…" : usingLive ? `api · round #${round.number}` : "mock data"}
      </div>

      {/* Dev-only trigger — wire to a real /resolve action once the
          admin endpoints land on the frontend. */}
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
          }}
          className="pointer-events-auto absolute bottom-6 right-4 z-40 rounded-full border border-dashed border-[var(--color-border)] bg-black/50 px-4 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--color-text-muted)] backdrop-blur-md transition-colors hover:border-[var(--color-cyan)] hover:text-white"
        >
          dev · reset round →
        </button>
      )}
    </main>
  );
}
