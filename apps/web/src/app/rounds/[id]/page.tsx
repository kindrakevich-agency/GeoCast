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
import { demoPlayers, demoPresence, demoRound, type LngLat } from "@/lib/mock";
import { rank, withUserPin } from "@/lib/scoring";

export default function ActiveRoundPage() {
  const [pending, setPending] = useState<LngLat | null>(null);
  const [myPin, setMyPin] = useState<LngLat | null>(null);
  const [resolved, setResolved] = useState(false);
  const placed = myPin !== null;

  const answer = demoRound.answer ?? null;

  const ranked = useMemo(() => {
    if (!resolved || !myPin || !answer) return null;
    const all = withUserPin(demoPlayers, myPin);
    return rank(all, answer, demoRound.poolCredits);
  }, [resolved, myPin, answer]);

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
        question={demoRound.question}
        closesAt={demoRound.closesAt}
        participants={demoRound.totalParticipants}
        pool={demoRound.poolCredits}
        roundNumber={demoRound.number}
        status={resolved ? "resolved" : "open"}
      />

      {!resolved && (
        <SidePanel
          open={placed}
          myPin={myPin}
          participants={demoRound.totalParticipants}
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

      {/* Dev-only trigger — wire to a real /resolve action once the API lands. */}
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
