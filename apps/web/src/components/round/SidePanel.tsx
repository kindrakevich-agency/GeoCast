"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { shortWallet } from "@/lib/mock";
import { motion } from "framer-motion";

export type SidePanelProps = {
  open: boolean;
  myPin: { lng: number; lat: number } | null;
  /** Total predictions on this round (server-side total). */
  participants: number;
  /** Live watcher count from Pusher presence (may exceed participants
   *  if some viewers haven't placed yet). */
  watching: number;
  /** Other connected wallets right now (from Pusher presence). Real data,
   *  not a fabricated roster. */
  peers: Array<{ userId: string; wallet: string; isAdmin: boolean }>;
};

/**
 * Right-edge panel after the user places their pin. Shows the pin coords,
 * the live numbers (watchers + pins), and the actually-connected peers
 * pulled from the Pusher presence channel. No mock data anywhere.
 */
export function SidePanel({ open, myPin, participants, watching, peers }: SidePanelProps) {
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

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Stat label="Watching" value={watching} accent="cyan" />
          <Stat label="Pins placed" value={participants} accent="magenta" />
        </div>

        {peers.length > 0 && (
          <>
            <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
              In this room ({peers.length})
            </p>
            <ul className="max-h-[200px] space-y-1 overflow-y-auto pr-1 text-sm">
              {peers.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background: p.isAdmin ? "var(--color-magenta)" : "var(--color-cyan)",
                        boxShadow: `0 0 8px ${p.isAdmin ? "var(--color-magenta)" : "var(--color-cyan)"}`,
                      }}
                    />
                    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[11px]">
                      {shortWallet(p.wallet)}
                    </span>
                    {p.isAdmin && (
                      <span
                        className="text-[8px] uppercase tracking-[0.18em]"
                        style={{ color: "var(--color-magenta)" }}
                      >
                        admin
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-4 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          Live leaderboard reveals on resolution. Your payout scales with
          how close your pin lands to the truth.
        </div>
      </GlassPanel>
    </motion.aside>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "cyan" | "magenta";
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-black/30 p-2.5">
      <p className="mb-0.5 text-[9px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className="font-[family-name:var(--font-jetbrains-mono)] text-lg font-bold tabular-nums"
        style={{ color: `var(--color-${accent})` }}
      >
        {value}
      </p>
    </div>
  );
}
