"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { formatCountdown, useCountdown } from "@/hooks/useCountdown";
import { motion } from "framer-motion";

export type QuestionCardProps = {
  question: string;
  closesAt: string;
  participants: number;
  pool: number;
  roundNumber: number;
  status?: "open" | "resolved";
};

export function QuestionCard({
  question,
  closesAt,
  participants,
  pool,
  roundNumber,
  status = "open",
}: QuestionCardProps) {
  const { countdown, ready } = useCountdown(closesAt);
  const urgent = status === "open" && ready && countdown.total > 0 && countdown.total < 5 * 60_000;
  const resolved = status === "resolved";

  return (
    <motion.div
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 18 }}
      className="pointer-events-auto absolute left-1/2 top-24 z-30 w-[min(680px,calc(100%-2rem))] -translate-x-1/2"
    >
      <GlassPanel className="overflow-hidden p-6 sm:p-7">
        <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: resolved ? "var(--color-magenta)" : "var(--color-cyan)",
                boxShadow: resolved
                  ? "0 0 10px var(--color-magenta)"
                  : "0 0 10px var(--color-cyan)",
              }}
            />
            {resolved ? "Resolved" : "Round live"}
          </span>
          <span>#{roundNumber}</span>
        </div>

        <h1 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-[clamp(1.4rem,2.4vw,2rem)] font-semibold leading-tight">
          {question}
        </h1>

        <div className="flex flex-wrap items-end justify-between gap-4">
          {resolved ? (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                Truth revealed
              </p>
              <p
                className="font-[family-name:var(--font-jetbrains-mono)] text-[clamp(1.4rem,2.4vw,1.9rem)] font-semibold leading-none text-glow-magenta"
                style={{ color: "var(--color-magenta)" }}
              >
                Lisbon, PT
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                Closes in
              </p>
              <p
                className={`font-[family-name:var(--font-jetbrains-mono)] text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-none tabular-nums ${
                  urgent ? "animate-pulse-soft" : ""
                }`}
                style={{
                  color: urgent ? "var(--color-amber)" : "var(--color-text)",
                }}
                suppressHydrationWarning
              >
                {ready ? formatCountdown(countdown) : "—:—"}
              </p>
            </div>
          )}

          <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
            <Pill label="explorers" value={participants.toLocaleString()} />
            <Pill label="pool" value={`${pool} cr`} accent />
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

function Pill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white/[0.03] px-3 py-2">
      <p className="mb-0.5 text-[9px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className="font-[family-name:var(--font-jetbrains-mono)] text-sm"
        style={{ color: accent ? "var(--color-cyan)" : "var(--color-text)" }}
      >
        {value}
      </p>
    </div>
  );
}
