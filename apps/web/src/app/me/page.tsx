"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { AmbientMap } from "@/components/map/AmbientMap";
import { Avatar } from "@/components/profile/Avatar";
import { CareerHeatmap } from "@/components/profile/CareerHeatmap";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { RecentRoundCard } from "@/components/profile/RecentRoundCard";
import { StatCard } from "@/components/profile/StatCard";
import { useCareerPins } from "@/hooks/useCareerPins";
import { useMe } from "@/hooks/useMe";
import { useMyPredictions } from "@/hooks/useMyPredictions";
import type { ApiPredictionHistoryItem } from "@/lib/api/types";
import { careerPins as mockCareerPins, myStats, recentRounds as mockRecentRounds, type PastRound } from "@/lib/profile-mock";
import { shortWallet } from "@/lib/mock";

/**
 * Profile page. When a JWT is in storage, /api/me supplies the headline
 * stats, /api/me/career-pins fills the heatmap, and /api/me/predictions
 * fills the recent-rounds timeline. Each section independently falls back
 * to the mock data so an empty-history user still sees a full page, and
 * an unauthenticated visitor gets the full demo.
 */
export default function ProfilePage() {
  const { user, isAuthed } = useMe();
  const { pins: livePins } = useCareerPins();
  const { data: history } = useMyPredictions(10);

  const wallet = user?.walletAddress ?? myStats.wallet;
  const gamesPlayed = user?.gamesPlayed ?? myStats.gamesPlayed;
  const creditsBalance = user?.creditsBalance ?? myStats.totalCreditsEarned;
  const totalScore = user?.totalScore ?? myStats.totalScore;

  const careerPins = livePins && livePins.length > 0 ? livePins : mockCareerPins;
  const isCareerPinsLive = livePins !== null && livePins.length > 0;

  // Convert API history to the PastRound shape the timeline card already
  // renders. Only resolved rounds carry the fields the card needs.
  const liveRecentRounds = useMemo<PastRound[]>(() => {
    if (!history) return [];
    return history.items
      .filter((it): it is ApiPredictionHistoryItem & { distanceKm: number; rank: number; round: { answer: NonNullable<ApiPredictionHistoryItem["round"]["answer"]> } } =>
        it.round.answer !== null && it.distanceKm !== null && it.rank !== null,
      )
      .map((it) => ({
        number: it.round.number,
        question: it.round.question,
        date: it.placedAt.slice(0, 10),
        answerLabel: `${it.round.answer.lat.toFixed(2)}, ${it.round.answer.lng.toFixed(2)}`,
        myPin: it.myPin,
        answer: it.round.answer,
        distanceKm: it.distanceKm,
        rank: it.rank,
        totalPlayers: it.round.totalParticipants,
        payout: it.payout,
      }));
  }, [history]);

  const recentRounds = liveRecentRounds.length > 0 ? liveRecentRounds : mockRecentRounds;
  const isHistoryLive = liveRecentRounds.length > 0;

  const winRate = (
    (recentRounds.filter((r) => r.rank <= 10).length / recentRounds.length) * 100
  ).toFixed(0);

  return (
    <main className="relative min-h-screen w-screen overflow-y-auto overflow-x-hidden bg-[var(--color-bg)] scanlines">
      <div className="fixed inset-0 z-0 opacity-40">
        <AmbientMap />
      </div>

      <Link
        href="/rounds/demo"
        className="pointer-events-auto fixed right-6 top-6 z-30 rounded-full border border-[var(--color-border)] bg-black/40 px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] backdrop-blur-md transition-colors hover:border-[var(--color-cyan)] hover:text-white"
      >
        Active round →
      </Link>

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
        >
          <GlassPanel
            variant="strong"
            className="overflow-hidden rounded-[var(--radius-xl)] p-7 sm:p-9"
          >
            <div className="flex flex-wrap items-center gap-6">
              <Avatar wallet={wallet} size={96} />
              <div className="flex-1">
                <p className="mb-1 text-[10px] uppercase tracking-[0.35em] text-[var(--color-text-muted)]">
                  {isAuthed
                    ? `Profile · ${user?.isAdmin ? "admin" : "player"}`
                    : `Profile · joined round #${myStats.joinedRound}`}
                </p>
                <h1 className="mb-1 font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold tracking-tight sm:text-4xl">
                  {isAuthed && user ? "you" : myStats.handle}
                </h1>
                <button
                  className="group inline-flex items-center gap-2 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--color-text-muted)] transition-colors hover:text-white"
                  title="Click to copy"
                  onClick={() => navigator.clipboard?.writeText(wallet)}
                >
                  {shortWallet(wallet)}
                  <CopyIcon />
                </button>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                  {isAuthed ? "Score" : "All-time rank"}
                </p>
                <p
                  className="font-[family-name:var(--font-jetbrains-mono)] text-3xl font-bold tabular-nums"
                  style={{ color: "var(--color-cyan)" }}
                >
                  {isAuthed ? totalScore.toFixed(2) : `#${myStats.allTimeRank}`}
                </p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatCard label="Games played" value={gamesPlayed} />
          <StatCard
            label="Avg distance"
            value={myStats.avgDistanceKm.toFixed(0)}
            unit="km"
            accent="magenta"
            hint={isAuthed ? "demo data" : undefined}
          />
          <StatCard
            label="Best result"
            value={myStats.bestDistanceKm.toFixed(1)}
            unit="km"
            accent="green"
            hint={isAuthed ? "demo data" : `#${myStats.bestRank} place`}
          />
          <StatCard
            label={isAuthed ? "Credits" : "Credits earned"}
            value={creditsBalance.toLocaleString()}
            accent="cyan"
            hint={isAuthed ? "live balance" : `top-10 rate ${winRate}%`}
          />
        </motion.div>

        <motion.section
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.3 }}
          className="mt-8"
        >
          <CareerHeatmap pins={careerPins} />
        </motion.section>

        <motion.section
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.24, duration: 0.3 }}
          className="mt-8"
        >
          <h2 className="mb-3 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            Recent rounds · {recentRounds.length}
            {isHistoryLive ? null : (
              <span className="ml-2 text-[var(--color-text-muted)] opacity-60">(demo)</span>
            )}
          </h2>
          <ul className="space-y-2">
            {recentRounds.map((r, i) => (
              <RecentRoundCard key={r.number} round={r} index={i} />
            ))}
          </ul>
        </motion.section>

        <p className="mt-10 text-center text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          {isAuthed
            ? `live profile · ${user?.walletAddress ? shortWallet(user.walletAddress) : ""}${isCareerPinsLive ? "" : " · heatmap demo"}`
            : `${myStats.pinsPerWeek} pins/week · total score ${myStats.totalScore.toFixed(2)} · (demo data)`}
        </p>
      </div>
    </main>
  );
}

function CopyIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="opacity-50 transition-opacity group-hover:opacity-100"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
