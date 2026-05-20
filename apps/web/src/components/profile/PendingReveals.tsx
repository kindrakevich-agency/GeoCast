"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useOnchainRound } from "@/hooks/useOnchainRound";
import { useReveal } from "@/hooks/useReveal";
import { isOnchainEnabled, getOnchainConfig } from "@/lib/onchain/config";
import { loadStashedCommit } from "@/lib/onchain/commit";

/**
 * "Pending reveals" section on /me. Lists rounds where:
 *   - The user committed on-chain (stash in localStorage exists)
 *   - The on-chain round state shows we're in the reveal window
 *     (closesAt ≤ now < revealsAt)
 *   - The round hasn't been resolved yet
 *
 * Reveals are time-sensitive — miss the window and the bet is forfeit. The
 * empty state is silent (component returns null) so the section only shows
 * up when there's actual work to do.
 */
export function PendingReveals({ roundNumbers }: { roundNumbers: number[] }) {
  if (!isOnchainEnabled()) return null;
  if (roundNumbers.length === 0) return null;

  return (
    <section className="mt-8" data-component="pending-reveals">
      <PendingRevealsBody roundNumbers={roundNumbers} />
    </section>
  );
}

function PendingRevealsBody({ roundNumbers }: { roundNumbers: number[] }) {
  // Render one Row per round. Each row decides whether it qualifies for
  // a reveal (in-window + has stashed commit) and returns null otherwise.
  // The outer section header is unconditional here — we only render it
  // if at least one row would be visible. To gate the header, render
  // header inside the rows-have-content tree:
  const rows = roundNumbers.map((n) => (
    <PendingRevealRow key={n} roundNumber={n} />
  ));

  return (
    <>
      <h2 className="mb-3 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
        Pending reveals
      </h2>
      <ul className="space-y-2">{rows}</ul>
    </>
  );
}

function PendingRevealRow({ roundNumber }: { roundNumber: number }) {
  const cfg = getOnchainConfig();
  const onchain = useOnchainRound(roundNumber);
  const { status, reveal } = useReveal(roundNumber);
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  // Render conditions — all must hold to show this row at all.
  if (!onchain.exists) return null;
  if (onchain.resolvedAt > 0) return null; // already resolved
  if (now < onchain.closesAt) return null; // still in commit window
  if (now >= onchain.revealsAt) return null; // missed it

  const stashed = loadStashedCommit(cfg.chainId, roundNumber);
  if (!stashed) return null; // no client-side commit to reveal

  const phase = status.phase;
  const disabled = phase === "revealing" || phase === "done";

  return (
    <motion.li
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <GlassPanel className="flex items-center gap-4 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/30 font-[family-name:var(--font-jetbrains-mono)] text-xs">
          #{roundNumber}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            Round #{roundNumber} —{" "}
            <span style={{ color: "var(--color-amber)" }}>reveal your pin</span>
          </p>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
            committed lat {stashed.lat.toFixed(4)}, lng {stashed.lng.toFixed(4)}
            {" · "}
            window ends {new Date(onchain.revealsAt * 1000).toLocaleTimeString()}
          </p>
        </div>
        <div className="shrink-0">
          {phase === "done" ? (
            <span
              className="rounded-full border px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "var(--color-green)", borderColor: "var(--color-green)" }}
            >
              ✓ revealed
            </span>
          ) : (
            <button
              onClick={() => reveal()}
              disabled={disabled}
              className="rounded-full border border-[var(--color-amber)] px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--color-amber)] transition-colors hover:bg-[var(--color-amber)] hover:text-[var(--color-bg)] disabled:opacity-50"
            >
              {phase === "revealing" ? "revealing…" : "reveal pin"}
            </button>
          )}
        </div>
      </GlassPanel>
      {phase === "error" && (
        <p className="mt-1 px-4 text-[10px] text-[var(--color-magenta)]">
          {status.message}
        </p>
      )}
    </motion.li>
  );
}
