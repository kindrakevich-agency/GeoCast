"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { AnimatePresence, motion } from "framer-motion";
import type { LngLat } from "@/lib/mock";

export type ConfirmModalProps = {
  open: boolean;
  coords: LngLat | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({ open, coords, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && coords && (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-black/40 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            <GlassPanel
              variant="strong"
              className="w-[min(420px,calc(100vw-3rem))] overflow-hidden rounded-[var(--radius-xl)] p-6"
            >
              <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                Confirm placement
              </p>
              <h2 className="mb-5 font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold">
                Place pin here?
              </h2>

              <div className="mb-5 rounded-[var(--radius)] border border-[var(--color-border)] bg-black/30 p-4">
                <div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                  Coordinates
                </div>
                <div className="font-[family-name:var(--font-jetbrains-mono)] text-sm">
                  <span className="text-[var(--color-text-muted)]">lat </span>
                  <span style={{ color: "var(--color-cyan)" }}>
                    {coords.lat.toFixed(4)}
                  </span>
                  <span className="ml-4 text-[var(--color-text-muted)]">lng </span>
                  <span style={{ color: "var(--color-cyan)" }}>
                    {coords.lng.toFixed(4)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Cost</span>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">
                    1 USDC
                  </span>
                </div>
              </div>

              <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/5 p-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
                <p className="mb-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-cyan)]">
                  On-chain · two wallet signatures
                </p>
                <ol className="ml-4 list-decimal space-y-0.5">
                  <li>Approve USDC spending (skipped if already approved)</li>
                  <li>Commit your pin to the GeoCastPool contract</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] py-2.5 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 rounded-[var(--radius)] py-2.5 text-sm font-medium text-[var(--color-bg)] ring-glow-cyan transition-transform hover:scale-[1.02]"
                  style={{ background: "var(--color-cyan)" }}
                >
                  Place pin
                </button>
              </div>
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
