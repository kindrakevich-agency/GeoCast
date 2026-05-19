"use client";

import { useState } from "react";
import { BottomHint } from "@/components/round/BottomHint";
import { ConfirmModal } from "@/components/round/ConfirmModal";
import { MapStage } from "@/components/map/MapStage";
import { QuestionCard } from "@/components/round/QuestionCard";
import { SidePanel } from "@/components/round/SidePanel";
import { TopBar } from "@/components/round/TopBar";
import { demoPlayers, demoPresence, demoRound, type LngLat } from "@/lib/mock";

export default function ActiveRoundPage() {
  const [pending, setPending] = useState<LngLat | null>(null);
  const [myPin, setMyPin] = useState<LngLat | null>(null);
  const placed = myPin !== null;

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
        myPin={myPin}
        presence={demoPresence}
        players={demoPlayers}
        onMapClick={onMapClick}
      />

      <TopBar wallet="0x7f4c…a3b1" balance={placed ? 99 : 100} />

      <QuestionCard
        question={demoRound.question}
        closesAt={demoRound.closesAt}
        participants={demoRound.totalParticipants}
        pool={demoRound.poolCredits}
        roundNumber={demoRound.number}
      />

      <SidePanel
        open={placed}
        myPin={myPin}
        participants={demoRound.totalParticipants}
        players={demoPlayers}
      />

      <BottomHint placed={placed} coords={myPin} />

      <ConfirmModal
        open={pending !== null}
        coords={pending}
        onConfirm={onConfirm}
        onCancel={() => setPending(null)}
      />
    </main>
  );
}
