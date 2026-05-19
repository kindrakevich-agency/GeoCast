"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { motion } from "framer-motion";
import type { RankedEntry } from "@/lib/scoring";

export type LeaderboardProps = {
  open: boolean;
  entries: RankedEntry[];
  myRank: number | null;
  myPayout: number;
};

export function Leaderboard({ open, entries, myRank, myPayout }: LeaderboardProps) {
  const top10 = entries.slice(0, 10);
  const me = entries.find((e) => e.isMe);
  const meBelowCut = me && me.rank > 10;

  return (
    <motion.aside
      initial={false}
      animate={{ x: open ? 0 : "110%" }}
      transition={{ type: "spring", stiffness: 160, damping: 22, delay: open ? 1.4 : 0 }}
      className="pointer-events-auto absolute right-4 top-1/2 z-40 hidden w-[360px] -translate-y-1/2 lg:block"
    >
      <GlassPanel variant="strong" className="overflow-hidden p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
              Final leaderboard
            </p>
            <h3 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold">
              Round #482
            </h3>
          </div>
          {myRank !== null && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                Your rank
              </p>
              <p
                className="font-[family-name:var(--font-jetbrains-mono)] text-2xl font-semibold"
                style={{ color: myRank <= 10 ? "var(--color-green)" : "var(--color-text)" }}
              >
                #{myRank}
              </p>
            </div>
          )}
        </div>

        <ul className="space-y-1.5">
          {top10.map((e, i) => (
            <motion.li
              key={e.id}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.6 + i * 0.04, duration: 0.25 }}
              className={`flex items-center justify-between rounded-md px-2.5 py-2 text-sm ${
                e.isMe ? "ring-glow-cyan" : "hover:bg-white/5"
              }`}
              style={{
                background: e.isMe ? "rgba(0, 212, 255, 0.06)" : undefined,
              }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-[family-name:var(--font-jetbrains-mono)] text-[10px]"
                  style={{
                    background:
                      e.rank === 1
                        ? "var(--color-green)"
                        : e.rank <= 3
                        ? "var(--color-cyan)"
                        : "rgba(255,255,255,0.06)",
                    color: e.rank <= 3 ? "var(--color-bg)" : "var(--color-text)",
                  }}
                >
                  {e.rank}
                </span>
                <span className="min-w-0 truncate">
                  <span className={e.isMe ? "font-medium" : undefined}>
                    {e.isMe ? "You" : e.handle}
                  </span>
                  <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
                    {e.countryHint}
                  </span>
                </span>
              </span>
              <span className="ml-2 flex shrink-0 items-baseline gap-3 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums">
                <span style={{ color: e.isMe ? "var(--color-cyan)" : "var(--color-text-muted)" }}>
                  {e.distanceKm < 10
                    ? e.distanceKm.toFixed(2)
                    : e.distanceKm < 100
                    ? e.distanceKm.toFixed(1)
                    : Math.round(e.distanceKm)}
                  <span className="ml-0.5 text-[9px]">km</span>
                </span>
                <span style={{ color: e.payout > 0 ? "var(--color-green)" : "var(--color-text-muted)" }}>
                  +{e.payout}
                </span>
              </span>
            </motion.li>
          ))}
        </ul>

        {meBelowCut && me && (
          <>
            <div className="my-2 border-t border-dashed border-[var(--color-border)]" />
            <div
              className="flex items-center justify-between rounded-md px-2.5 py-2 text-sm ring-glow-cyan"
              style={{ background: "rgba(0, 212, 255, 0.06)" }}
            >
              <span className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white/5 font-[family-name:var(--font-jetbrains-mono)] text-[10px]">
                  {me.rank}
                </span>
                <span className="font-medium">You</span>
              </span>
              <span className="flex items-baseline gap-3 font-[family-name:var(--font-jetbrains-mono)] text-xs tabular-nums">
                <span style={{ color: "var(--color-cyan)" }}>
                  {me.distanceKm < 100 ? me.distanceKm.toFixed(1) : Math.round(me.distanceKm)} km
                </span>
                <span style={{ color: me.payout > 0 ? "var(--color-green)" : "var(--color-text-muted)" }}>
                  +{me.payout}
                </span>
              </span>
            </div>
          </>
        )}

        <div
          className="mt-4 flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-black/30 p-3 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>Pool distributed</span>
          <span
            className="font-[family-name:var(--font-jetbrains-mono)]"
            style={{ color: "var(--color-cyan)" }}
          >
            {entries.reduce((acc, e) => acc + e.payout, 0)} cr
          </span>
        </div>
      </GlassPanel>
    </motion.aside>
  );
}
