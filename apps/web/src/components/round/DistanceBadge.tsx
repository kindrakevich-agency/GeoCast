"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { motion } from "framer-motion";

export type DistanceBadgeProps = {
  distanceKm: number;
  visible: boolean;
};

export function DistanceBadge({ distanceKm, visible }: DistanceBadgeProps) {
  if (!visible) return null;

  const formatted =
    distanceKm < 10 ? distanceKm.toFixed(2) : distanceKm < 100 ? distanceKm.toFixed(1) : Math.round(distanceKm).toString();

  return (
    <motion.div
      initial={{ y: 12, opacity: 0, scale: 0.92 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.9 }}
      className="pointer-events-auto absolute left-1/2 top-[42%] z-30 -translate-x-1/2"
    >
      <GlassPanel
        variant="strong"
        className="overflow-hidden rounded-[var(--radius-xl)] px-7 py-5 text-center"
        style={{
          boxShadow:
            "0 8px 32px rgba(255, 0, 110, 0.35), 0 0 0 1px rgba(255, 0, 110, 0.35)",
        }}
      >
        <p className="mb-1 text-[10px] uppercase tracking-[0.35em] text-[var(--color-text-muted)]">
          Distance from truth
        </p>
        <p
          className="font-[family-name:var(--font-jetbrains-mono)] text-[clamp(2.4rem,4vw,3.4rem)] font-semibold leading-none text-glow-magenta tabular-nums"
          style={{ color: "var(--color-magenta)" }}
        >
          {formatted}
          <span className="ml-2 text-[0.55em] font-normal text-[var(--color-text-muted)]">km</span>
        </p>
      </GlassPanel>
    </motion.div>
  );
}
