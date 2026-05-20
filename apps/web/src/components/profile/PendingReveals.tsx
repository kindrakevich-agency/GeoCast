"use client";

import { useCallback, useEffect, useState } from "react";
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
 * The section always renders when on-chain mode is enabled — when no
 * round qualifies we show an explicit empty state so the user knows the
 * feature exists and there's just nothing to do right now (rather than
 * a confusing missing heading).
 */
export function PendingReveals({ roundNumbers }: { roundNumbers: number[] }) {
  if (!isOnchainEnabled()) return null;

  return (
    <section className="mt-8" data-component="pending-reveals">
      <PendingRevealsBody roundNumbers={roundNumbers} />
    </section>
  );
}

function PendingRevealsBody({ roundNumbers }: { roundNumbers: number[] }) {
  // Each row reports its visibility back via setVisible so the parent
  // can decide whether to render the empty-state placeholder. The
  // visibility map is keyed by roundNumber.
  const [visibility, setVisibility] = useState<Record<number, boolean>>({});

  const setVisible = useCallback((n: number, v: boolean) => {
    setVisibility((prev) => (prev[n] === v ? prev : { ...prev, [n]: v }));
  }, []);

  const reported = Object.keys(visibility).length;
  const visibleCount = Object.values(visibility).filter(Boolean).length;
  // "Settled" = every passed-in round has reported its visibility at least
  // once. Until then we don't know whether the section is truly empty, so
  // we hold off on the empty-state to avoid flashing it before the rows
  // fetch their on-chain state.
  const settled = reported >= roundNumbers.length;

  return (
    <>
      <h2 className="mb-3 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
        Pending reveals
      </h2>
      {roundNumbers.length === 0 ? (
        <EmptyState>
          No reveals pending. Once you place an on-chain pin and its round
          closes, you'll have a window to reveal it here.
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-2">
            {roundNumbers.map((n) => (
              <PendingRevealRow
                key={n}
                roundNumber={n}
                onVisibilityChange={setVisible}
              />
            ))}
          </ul>
          {settled && visibleCount === 0 && (
            <EmptyState>
              Nothing to reveal right now. We'll surface a button here when
              one of your on-chain pins enters its reveal window.
            </EmptyState>
          )}
        </>
      )}
    </>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <GlassPanel className="p-4">
      <p className="text-sm text-[var(--color-text-muted)]">{children}</p>
    </GlassPanel>
  );
}

function PendingRevealRow({
  roundNumber,
  onVisibilityChange,
}: {
  roundNumber: number;
  onVisibilityChange: (n: number, visible: boolean) => void;
}) {
  const cfg = getOnchainConfig();
  const onchain = useOnchainRound(roundNumber);
  const { status, reveal } = useReveal(roundNumber);
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  // Compute visibility — only show the row when the round is in its
  // reveal window AND we have a stashed commit for it on this client.
  const stashed = loadStashedCommit(cfg.chainId, roundNumber);
  const isInRevealWindow =
    onchain.exists &&
    onchain.resolvedAt === 0 &&
    now >= onchain.closesAt &&
    now < onchain.revealsAt;
  const isVisible = isInRevealWindow && stashed !== null;

  // Report visibility — fires on first commit AND on every change, so the
  // parent's empty-state logic stays accurate as on-chain data streams in.
  useEffect(() => {
    onVisibilityChange(roundNumber, isVisible);
  }, [isVisible, roundNumber, onVisibilityChange]);

  if (!isVisible || !stashed) return null;

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
