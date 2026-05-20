"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { AnimatePresence, motion } from "framer-motion";

export type BottomHintProps = {
  placed: boolean;
  coords: { lng: number; lat: number } | null;
  /** What the player pays per pin. Defaults to "1 credit". */
  costLabel?: string;
};

export function BottomHint({ placed, coords, costLabel = "1 credit" }: BottomHintProps) {
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
      <AnimatePresence mode="wait">
        {!placed ? (
          <motion.div
            key="hint-place"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GlassPanel className="pointer-events-auto flex items-center gap-3 rounded-full px-5 py-3 text-sm">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-cyan)", boxShadow: "0 0 10px var(--color-cyan)" }}
              />
              <span className="text-[var(--color-text-muted)]">
                Click anywhere on the map to place your pin
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs">
                {costLabel}
              </span>
            </GlassPanel>
          </motion.div>
        ) : (
          <motion.div
            key="hint-placed"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GlassPanel className="pointer-events-auto flex items-center gap-3 rounded-full px-5 py-3 text-sm">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-green)", boxShadow: "0 0 10px var(--color-green)" }}
              />
              <span>Pin placed at</span>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--color-cyan)]">
                {coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : ""}
              </span>
              <span className="text-[var(--color-text-muted)]">— awaiting resolution</span>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
