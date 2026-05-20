"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useClaim } from "@/hooks/useClaim";
import { useClaimProof, type ClaimProof } from "@/hooks/useClaimProof";
import { isOnchainEnabled } from "@/lib/onchain/config";

/**
 * "Claimable winnings" section on /me. Renders one card per resolved
 * round where the server has a non-null Merkle proof for this wallet.
 * Hidden entirely when the on-chain contract isn't configured (yet).
 *
 * The parent passes in the list of resolved roundNumbers from
 * useMyPredictions — that's the bridge between off-chain history and
 * on-chain claim state.
 */
export function ClaimableWinnings({ resolvedRoundIds }: { resolvedRoundIds: number[] }) {
  if (!isOnchainEnabled()) {
    // Contract not deployed yet — render nothing. No fake claim UI.
    return null;
  }
  if (resolvedRoundIds.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
        Claimable winnings
      </h2>
      <ul className="space-y-2">
        {resolvedRoundIds.map((roundId) => (
          <ClaimableRowFetcher key={roundId} roundId={roundId} />
        ))}
      </ul>
    </section>
  );
}

function ClaimableRowFetcher({ roundId }: { roundId: number }) {
  const { proof, isLoading } = useClaimProof(roundId);
  if (isLoading || proof === null) return null;
  if (BigInt(proof.amount) === 0n) return null; // 0-payout pin — skip
  return <ClaimableRow proof={proof} />;
}

function ClaimableRow({ proof }: { proof: ClaimProof }) {
  const { status, claim } = useClaim(proof.roundId);
  const [pressed, setPressed] = useState(false);

  const onClick = async () => {
    setPressed(true);
    await claim(BigInt(proof.amount), proof.proof);
  };

  const phase = status.phase;
  const disabled = phase === "claiming" || phase === "done";

  return (
    <motion.li
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <GlassPanel className="flex items-center gap-4 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/30 font-[family-name:var(--font-jetbrains-mono)] text-xs">
          #{proof.roundId}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            Round #{proof.roundId} —{" "}
            <span style={{ color: "var(--color-green)" }}>
              {proof.amountUsdc.toFixed(2)} USDC
            </span>
          </p>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
            {proof.distanceKm !== null && proof.rank !== null
              ? `rank #${proof.rank} · ${proof.distanceKm < 100 ? proof.distanceKm.toFixed(1) : Math.round(proof.distanceKm)} km off`
              : "ready to claim"}
          </p>
        </div>
        <div className="shrink-0">
          {phase === "done" ? (
            <span
              className="rounded-full border px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "var(--color-green)", borderColor: "var(--color-green)" }}
            >
              ✓ claimed
            </span>
          ) : (
            <button
              onClick={onClick}
              disabled={disabled}
              className="rounded-full border border-[var(--color-green)] px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--color-green)] transition-colors hover:bg-[var(--color-green)] hover:text-[var(--color-bg)] disabled:opacity-50"
            >
              {phase === "claiming" ? "claiming…" : pressed && phase === "error" ? "retry" : "claim"}
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
