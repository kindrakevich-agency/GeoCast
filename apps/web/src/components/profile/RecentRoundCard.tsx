"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { motion } from "framer-motion";
import type { PastRound } from "@/lib/profile-mock";

export function RecentRoundCard({ round, index }: { round: PastRound; index: number }) {
  const isResolved = round.rank !== null && round.distanceKm !== null;
  const isClosed = !isResolved && round.status === "closed";
  const top10 = isResolved && (round.rank as number) <= 10;
  const top3 = isResolved && (round.rank as number) <= 3;
  const formattedDistance = isResolved
    ? (round.distanceKm as number) < 10
      ? (round.distanceKm as number).toFixed(2)
      : (round.distanceKm as number) < 100
      ? (round.distanceKm as number).toFixed(1)
      : Math.round(round.distanceKm as number).toString()
    : null;

  return (
    <motion.li
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.05 * index }}
    >
      <GlassPanel className="flex items-stretch gap-0 overflow-hidden p-0">
        <div className="grid w-14 shrink-0 place-items-center border-r border-[var(--color-border)] bg-black/30">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              round
            </p>
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-base font-semibold">
              {round.number}
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 truncate text-sm">{round.question}</p>
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
              {round.date} ·{" "}
              {isResolved && round.answerLabel ? (
                <>answer: <span className="text-[var(--color-text)]">{round.answerLabel}</span></>
              ) : isClosed ? (
                <span style={{ color: "var(--color-amber)" }}>closed · awaiting admin reveal</span>
              ) : (
                <span style={{ color: "var(--color-cyan)" }}>round open · pin placed</span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-baseline gap-4 text-right">
            {isResolved ? (
              <>
                <Cell label="distance">
                  <span style={{ color: "var(--color-magenta)" }}>{formattedDistance}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)]"> km</span>
                </Cell>
                <Cell label="rank">
                  <span
                    style={{
                      color: top3
                        ? "var(--color-green)"
                        : top10
                        ? "var(--color-cyan)"
                        : "var(--color-text)",
                    }}
                  >
                    #{round.rank}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]"> /{round.totalPlayers}</span>
                </Cell>
                <Cell label="earned">
                  <span style={{ color: round.payout > 0 ? "var(--color-green)" : "var(--color-text-muted)" }}>
                    +{round.payout}
                  </span>
                </Cell>
              </>
            ) : (
              <Cell label="status">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: isClosed ? "var(--color-amber)" : "var(--color-cyan)" }}
                >
                  <span
                    className="inline-block h-1 w-1 animate-pulse rounded-full"
                    style={{
                      background: isClosed ? "var(--color-amber)" : "var(--color-cyan)",
                      boxShadow: `0 0 6px ${isClosed ? "var(--color-amber)" : "var(--color-cyan)"}`,
                    }}
                  />
                  {isClosed ? "awaiting reveal" : "round open"}
                </span>
              </Cell>
            )}
          </div>
        </div>
      </GlassPanel>
    </motion.li>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm font-semibold tabular-nums">
        {children}
      </p>
    </div>
  );
}
