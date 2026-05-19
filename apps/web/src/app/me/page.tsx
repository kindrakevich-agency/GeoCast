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
import {
  careerPins as mockCareerPins,
  myStats,
  recentRounds as mockRecentRounds,
  type PastRound,
} from "@/lib/profile-mock";
import { shortWallet } from "@/lib/mock";

/**
 * Profile page with three distinct states:
 *   1. Anonymous            → full demo (mock heatmap, mock timeline)
 *   2. Authed with history  → live heatmap + live timeline (mixed resolved
 *                              and in-progress pins, no demo fallback)
 *   3. Authed, empty        → empty-state CTAs pointing at the active round
 *
 * Stat-grid headline numbers come from /api/me. Avg distance + best result
 * are derived from the live history (resolved rounds only) — never from
 * mock numbers when authed, which was the source of the misleading
 * "Recent rounds · 8 (demo)" complaint.
 */
export default function ProfilePage() {
  const { user, isAuthed } = useMe();
  const { pins: livePins } = useCareerPins();
  const { data: history } = useMyPredictions(10);

  // Mixed history: include in-progress pins (rank/distance null) so a user
  // who's placed a pin on the active round sees themselves in the timeline.
  const liveRecentRounds = useMemo<PastRound[]>(() => {
    if (!history) return [];
    return history.items.map((it) => ({
      number: it.round.number,
      question: it.round.question,
      date: it.placedAt.slice(0, 10),
      myPin: it.myPin,
      totalPlayers: it.round.totalParticipants,
      answerLabel: it.round.answer
        ? `${it.round.answer.lat.toFixed(2)}, ${it.round.answer.lng.toFixed(2)}`
        : null,
      answer: it.round.answer,
      distanceKm: it.distanceKm,
      rank: it.rank,
      payout: it.payout,
    }));
  }, [history]);

  // Resolved-only slice for averages — in-progress rounds have no distance,
  // so they can't contribute to "avg distance" or "best result".
  const resolvedHistory = useMemo(
    () => liveRecentRounds.filter((r) => r.distanceKm !== null && r.rank !== null),
    [liveRecentRounds],
  );

  // Source-of-truth flags. Drives the three-state branching below.
  const hasLivePins = livePins !== null && livePins.length > 0;
  const hasLiveHistory = liveRecentRounds.length > 0;
  const isAuthedEmpty = isAuthed && livePins !== null && livePins.length === 0
                                 && history !== null && history.items.length === 0;

  // Display data: live for authed-with-data, mock for everyone else.
  const careerPins = hasLivePins ? livePins : mockCareerPins;
  const recentRounds = hasLiveHistory ? liveRecentRounds : mockRecentRounds;

  const wallet = user?.walletAddress ?? myStats.wallet;
  const gamesPlayed = user?.gamesPlayed ?? myStats.gamesPlayed;
  const creditsBalance = user?.creditsBalance ?? myStats.totalCreditsEarned;
  const totalScore = user?.totalScore ?? myStats.totalScore;

  // Derived stats: from real history when authed-with-data, mock otherwise.
  const avgDistanceKm = isAuthed
    ? resolvedHistory.length > 0
      ? resolvedHistory.reduce((a, r) => a + (r.distanceKm as number), 0) / resolvedHistory.length
      : null
    : myStats.avgDistanceKm;
  const bestDistanceKm = isAuthed
    ? resolvedHistory.length > 0
      ? Math.min(...resolvedHistory.map((r) => r.distanceKm as number))
      : null
    : myStats.bestDistanceKm;
  const bestRank = isAuthed
    ? resolvedHistory.length > 0
      ? Math.min(...resolvedHistory.map((r) => r.rank as number))
      : null
    : myStats.bestRank;

  const winRate =
    recentRounds.filter((r) => r.rank !== null && (r.rank as number) <= 10).length /
    Math.max(1, recentRounds.length);

  return (
    <main className="relative min-h-screen w-screen overflow-y-auto overflow-x-hidden bg-[var(--color-bg)] scanlines">
      <div className="fixed inset-0 z-0 opacity-40">
        <AmbientMap />
      </div>

      <Link
        href="/play"
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
            value={avgDistanceKm !== null ? avgDistanceKm.toFixed(0) : "—"}
            unit={avgDistanceKm !== null ? "km" : undefined}
            accent="magenta"
            hint={isAuthed && avgDistanceKm === null ? "no resolved rounds yet" : undefined}
          />
          <StatCard
            label="Best result"
            value={bestDistanceKm !== null ? bestDistanceKm.toFixed(1) : "—"}
            unit={bestDistanceKm !== null ? "km" : undefined}
            accent="green"
            hint={
              isAuthed
                ? bestRank !== null
                  ? `#${bestRank} place`
                  : "no resolved rounds yet"
                : `#${myStats.bestRank} place`
            }
          />
          <StatCard
            label={isAuthed ? "Credits" : "Credits earned"}
            value={creditsBalance.toLocaleString()}
            accent="cyan"
            hint={isAuthed ? "live balance" : `top-10 rate ${(winRate * 100).toFixed(0)}%`}
          />
        </motion.div>

        <motion.section
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.3 }}
          className="mt-8"
        >
          {hasLivePins || !isAuthed ? (
            <CareerHeatmap pins={careerPins} />
          ) : (
            <EmptyState
              title="Your career heatmap starts here"
              body="Every pin you drop lands on this map for life. Drop your first one and the heatmap begins."
              cta="Drop a pin →"
            />
          )}
        </motion.section>

        <motion.section
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.24, duration: 0.3 }}
          className="mt-8"
        >
          <h2 className="mb-3 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            Recent rounds · {hasLiveHistory ? liveRecentRounds.length : mockRecentRounds.length}
            {hasLiveHistory || !isAuthed ? null : null}
            {!hasLiveHistory && !isAuthed && (
              <span className="ml-2 text-[var(--color-text-muted)] opacity-60">(demo)</span>
            )}
          </h2>
          {hasLiveHistory || !isAuthed ? (
            <ul className="space-y-2">
              {recentRounds.map((r, i) => (
                <RecentRoundCard key={r.number} round={r} index={i} />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="You haven't played a round yet"
              body="One pin, one round, one shot at the truth. Your timeline fills in as soon as you place your first pin."
              cta="Go to the active round →"
              compact
            />
          )}
        </motion.section>

        <p className="mt-10 text-center text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          {isAuthed ? (
            isAuthedEmpty ? (
              <>welcome · sign your first pin to populate this page</>
            ) : (
              <>live profile · {user?.walletAddress ? shortWallet(user.walletAddress) : ""}</>
            )
          ) : (
            <>
              {myStats.pinsPerWeek} pins/week · total score {myStats.totalScore.toFixed(2)} ·
              (demo data)
            </>
          )}
        </p>
      </div>
    </main>
  );
}

function EmptyState({
  title,
  body,
  cta,
  compact = false,
}: {
  title: string;
  body: string;
  cta: string;
  compact?: boolean;
}) {
  return (
    <GlassPanel
      className={`flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border-dashed text-center ${
        compact ? "px-6 py-8" : "px-6 py-16"
      }`}
    >
      <p className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold">
        {title}
      </p>
      <p className="max-w-md text-sm text-[var(--color-text-muted)]">{body}</p>
      <Link
        href="/play"
        className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--color-cyan)] px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--color-cyan)] transition-colors hover:bg-[var(--color-cyan)] hover:text-[var(--color-bg)]"
      >
        {cta}
      </Link>
    </GlassPanel>
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
