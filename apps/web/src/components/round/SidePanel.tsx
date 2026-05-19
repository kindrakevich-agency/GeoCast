"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import type { MockPlayer } from "@/lib/mock";
import { motion } from "framer-motion";

export type SidePanelProps = {
  open: boolean;
  myPin: { lng: number; lat: number } | null;
  participants: number;
  players: MockPlayer[];
};

export function SidePanel({ open, myPin, participants, players }: SidePanelProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ x: open ? 0 : "110%" }}
      transition={{ type: "spring", stiffness: 180, damping: 24 }}
      className="pointer-events-auto absolute right-4 top-1/2 z-30 hidden w-[320px] -translate-y-1/2 lg:block"
    >
      <GlassPanel variant="strong" className="overflow-hidden p-5">
        <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          Your pin
        </p>
        <h3 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-xl font-semibold">
          Locked in
        </h3>

        <div className="mb-5 rounded-[var(--radius)] border border-[var(--color-border)] bg-black/30 p-3 font-[family-name:var(--font-jetbrains-mono)] text-xs">
          {myPin ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">lat</span>
                <span style={{ color: "var(--color-cyan)" }}>{myPin.lat.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-muted)]">lng</span>
                <span style={{ color: "var(--color-cyan)" }}>{myPin.lng.toFixed(4)}</span>
              </div>
            </>
          ) : (
            <span className="text-[var(--color-text-muted)]">—</span>
          )}
        </div>

        <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          Active explorers ({participants})
        </p>
        <ul className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1 text-sm">
          {players.slice(0, 8).map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/5">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--color-cyan)" }}
                />
                <span>{p.handle}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {p.countryHint}
                </span>
              </span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
                {p.wallet}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          Live leaderboard reveals on resolution. Your payout scales with
          how close your pin lands to the truth.
        </div>
      </GlassPanel>
    </motion.aside>
  );
}
