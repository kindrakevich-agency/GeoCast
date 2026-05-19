"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { motion } from "framer-motion";

export type ClaimBarProps = {
  payout: number;
  nextRoundInHours?: number;
};

export function ClaimBar({ payout, nextRoundInHours = 18 }: ClaimBarProps) {
  return (
    <motion.div
      initial={{ y: 32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 22, delay: 1.8 }}
      className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2"
    >
      <GlassPanel
        variant="strong"
        className="pointer-events-auto flex items-center gap-5 rounded-full px-6 py-3 text-sm"
      >
        <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full animate-pulse-soft"
            style={{ background: "var(--color-amber)", boxShadow: "0 0 10px var(--color-amber)" }}
          />
          Next round in
          <span className="font-[family-name:var(--font-jetbrains-mono)] text-white">
            {nextRoundInHours}h
          </span>
        </span>

        <span className="h-4 w-px bg-[var(--color-border)]" />

        <span className="flex items-center gap-2">
          <span className="text-[var(--color-text-muted)]">You earned</span>
          <span
            className="relative font-[family-name:var(--font-jetbrains-mono)] text-base font-semibold"
            style={{ color: "var(--color-green)" }}
          >
            +{payout} cr
            <motion.span
              initial={{ x: "-120%", opacity: 0 }}
              animate={{ x: "120%", opacity: [0, 0.7, 0] }}
              transition={{ duration: 1.4, delay: 2.4, repeat: 1, repeatDelay: 0.6 }}
              className="pointer-events-none absolute inset-y-0 -inset-x-2 w-1/2 rounded-sm"
              style={{
                background:
                  "linear-gradient(110deg, transparent 30%, rgba(0,255,136,0.55) 50%, transparent 70%)",
                filter: "blur(3px)",
              }}
            />
          </span>
        </span>

        <button
          className="rounded-full px-4 py-1.5 text-xs font-medium text-[var(--color-bg)] ring-glow-cyan transition-transform hover:scale-[1.03]"
          style={{ background: "var(--color-cyan)" }}
        >
          Claim
        </button>
      </GlassPanel>
    </motion.div>
  );
}
