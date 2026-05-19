"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AmbientMap } from "@/components/map/AmbientMap";
import { Avatar } from "@/components/profile/Avatar";
import { CareerHeatmap } from "@/components/profile/CareerHeatmap";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { RecentRoundCard } from "@/components/profile/RecentRoundCard";
import { StatCard } from "@/components/profile/StatCard";
import { useMe } from "@/hooks/useMe";
import { careerPins, myStats, recentRounds } from "@/lib/profile-mock";
import { shortWallet } from "@/lib/mock";

/**
 * Profile page. When a JWT is in storage, /api/me data overlays the
 * stat-grid fields we have real values for (wallet, gamesPlayed,
 * creditsBalance, totalScore). The career heatmap + recent rounds
 * still render from mock data — those endpoints (/api/me/career-pins,
 * /api/me/predictions) haven't been built yet.
 *
 * Unauthenticated → pure mock so the page never looks empty.
 */
export default function ProfilePage() {
  const { user, isAuthed } = useMe();

  const wallet = user?.walletAddress ?? myStats.wallet;
  const gamesPlayed = user?.gamesPlayed ?? myStats.gamesPlayed;
  const creditsBalance = user?.creditsBalance ?? myStats.totalCreditsEarned;
  const totalScore = user?.totalScore ?? myStats.totalScore;

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
          </h2>
          <ul className="space-y-2">
            {recentRounds.map((r, i) => (
              <RecentRoundCard key={r.number} round={r} index={i} />
            ))}
          </ul>
        </motion.section>

        <p className="mt-10 text-center text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          {isAuthed
            ? `live profile · ${user?.walletAddress ? shortWallet(user.walletAddress) : ""}`
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
