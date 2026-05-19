"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { LeaderboardMap } from "@/components/leaderboard/LeaderboardMap";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { usePusherChannel } from "@/hooks/usePusherChannel";
import type { ApiLeaderboardRow } from "@/lib/api/types";
import {
  leaderboardData,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from "@/lib/leaderboard-mock";
import { shortWallet } from "@/lib/mock";

const TABS: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "all", label: "All-time" },
];

/**
 * API rows lack handle / country / avgDistanceKm / recentPins. Map them
 * onto the existing display shape so the same row component renders both.
 *
 * `isMe` is computed client-side by comparing the row's wallet to the local
 * user's wallet — the leaderboard endpoint is on the public firewall now
 * (so stale tokens can't 401 it), which means the server doesn't see the
 * JWT and can't flag the caller's row server-side.
 */
function apiToDisplay(r: ApiLeaderboardRow, myWallet: string | null): LeaderboardRow {
  const isMe = myWallet !== null && r.wallet.toLowerCase() === myWallet.toLowerCase();
  return {
    rank: r.rank,
    wallet: r.wallet,
    handle: shortWallet(r.wallet),
    gamesPlayed: r.gamesPlayed,
    totalCredits: r.totalCredits,
    totalScore: r.totalScore,
    isMe,
  };
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [hover, setHover] = useState<LeaderboardRow | null>(null);

  const { user } = useAuth();
  const api = useLeaderboard(period);

  // Subscribe to the `leaderboard` channel — server broadcasts
  // `leaderboard-updated` once per round resolve. No-op when Pusher
  // isn't configured (the rest of the page still works off the initial
  // fetch + tab-change refetches).
  usePusherChannel("leaderboard", {
    "leaderboard-updated": () => api.refetch(),
  });

  // Strategy: if the API has rows for this period, show them. Otherwise
  // fall back to the rich mock so the page never looks empty pre-launch.
  const usingApi = api.rows.length > 0;
  const myWallet = user?.walletAddress ?? null;
  const rows: LeaderboardRow[] = useMemo(
    () => (usingApi ? api.rows.map((r) => apiToDisplay(r, myWallet)) : leaderboardData[period]),
    [usingApi, api.rows, period, myWallet],
  );

  const me = useMemo(() => rows.find((r) => r.isMe) ?? null, [rows]);
  const meOutsideTop100 = me && me.rank > 100;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)] scanlines">
      <LeaderboardMap hoverPins={hover?.recentPins ?? null} />

      <Link
        href="/play"
        className="pointer-events-auto absolute left-6 top-6 z-30 rounded-full border border-[var(--color-border)] bg-black/40 px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] backdrop-blur-md transition-colors hover:border-[var(--color-cyan)] hover:text-white"
      >
        ← Active round
      </Link>

      {/* Right slide-in panel (≈1/3 width on desktop) */}
      <motion.aside
        initial={{ x: "110%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
        className="pointer-events-auto absolute right-0 top-0 z-20 flex h-full w-full flex-col sm:w-[480px] sm:p-6"
      >
        <GlassPanel
          variant="strong"
          className="flex h-full min-h-0 flex-col overflow-hidden rounded-none sm:rounded-[var(--radius-xl)]"
        >
          <div className="px-6 pt-6 sm:px-7 sm:pt-7">
            <p className="mb-1 text-[10px] uppercase tracking-[0.35em] text-[var(--color-text-muted)]">
              Leaderboard
            </p>
            <div className="flex items-baseline justify-between">
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold tracking-tight">
                {TABS.find((t) => t.id === period)?.label}
              </h1>
              <p className="text-xs text-[var(--color-text-muted)]">
                top {rows.length} explorer{rows.length === 1 ? "" : "s"}
              </p>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex gap-1 rounded-full border border-[var(--color-border)] bg-black/30 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPeriod(t.id)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    period === t.id ? "text-[var(--color-bg)]" : "text-[var(--color-text-muted)] hover:text-white"
                  }`}
                  style={{
                    background: period === t.id ? "var(--color-cyan)" : "transparent",
                    boxShadow: period === t.id ? "0 0 20px rgba(0, 212, 255, 0.4)" : undefined,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Column headers */}
            <div className="mt-5 grid grid-cols-[36px_1fr_60px_60px] gap-2 px-2 pb-2 text-[9px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              <span>#</span>
              <span>explorer</span>
              <span className="text-right">avg km</span>
              <span className="text-right">credits</span>
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
            {api.isLoading && !usingApi ? (
              <p className="px-2 py-3 text-xs text-[var(--color-text-muted)]">
                Loading leaderboard…
              </p>
            ) : (
              <ul className="space-y-0.5">
                {rows.map((row) => (
                  <LeaderboardRowItem
                    key={`${row.rank}-${row.wallet}`}
                    row={row}
                    onHover={() => setHover(row)}
                    onLeave={() => setHover(null)}
                    hovered={hover?.rank === row.rank}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Sticky "you" row if outside top 100 */}
          {meOutsideTop100 && me && (
            <div className="border-t border-[var(--color-border)] bg-black/40 px-3 py-3 sm:px-4">
              <LeaderboardRowItem
                row={me}
                onHover={() => setHover(me)}
                onLeave={() => setHover(null)}
                hovered={hover?.rank === me.rank}
                sticky
              />
            </div>
          )}

          {/* Source-of-truth indicator */}
          <div className="border-t border-[var(--color-border)] px-6 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] sm:px-7">
            {api.isLoading
              ? "loading…"
              : usingApi
              ? `live · ${api.rows.length} rows from /api/leaderboard`
              : "mock data"}
          </div>
        </GlassPanel>
      </motion.aside>
    </main>
  );
}

function LeaderboardRowItem({
  row,
  hovered,
  onHover,
  onLeave,
  sticky,
}: {
  row: LeaderboardRow;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  sticky?: boolean;
}) {
  const top3 = row.rank <= 3;
  return (
    <li
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`grid cursor-default grid-cols-[36px_1fr_60px_60px] items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
        hovered ? "bg-white/5" : "hover:bg-white/[0.03]"
      }`}
      style={{
        boxShadow: row.isMe ? "0 0 0 1px rgba(0, 212, 255, 0.5), 0 0 16px rgba(0, 212, 255, 0.18)" : undefined,
        background: row.isMe ? "rgba(0, 212, 255, 0.05)" : undefined,
      }}
    >
      <span
        className="grid h-6 w-6 place-items-center rounded-full font-[family-name:var(--font-jetbrains-mono)] text-[10px]"
        style={{
          background:
            row.rank === 1
              ? "var(--color-amber)"
              : top3
              ? "var(--color-cyan)"
              : "rgba(255, 255, 255, 0.06)",
          color: top3 ? "var(--color-bg)" : "var(--color-text)",
        }}
      >
        {row.rank}
      </span>

      <span className="flex min-w-0 items-baseline gap-2 truncate">
        <span className={`truncate text-sm ${row.isMe ? "font-medium" : ""}`}>
          {row.isMe ? "You" : row.handle}
        </span>
        {row.country && (
          <span className="hidden font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-[var(--color-text-muted)] sm:inline">
            {row.country}
          </span>
        )}
        {sticky && (
          <span className="ml-auto text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            your rank
          </span>
        )}
      </span>

      <span className="text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums text-[var(--color-text-muted)]">
        {row.avgDistanceKm === undefined
          ? "—"
          : row.avgDistanceKm < 100
          ? row.avgDistanceKm.toFixed(1)
          : Math.round(row.avgDistanceKm)}
      </span>

      <span
        className="text-right font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums"
        style={{ color: top3 ? "var(--color-green)" : "var(--color-text)" }}
      >
        +{row.totalCredits.toLocaleString()}
      </span>
    </li>
  );
}
