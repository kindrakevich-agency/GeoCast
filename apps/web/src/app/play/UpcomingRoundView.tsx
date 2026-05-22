"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AmbientMap } from "@/components/map/AmbientMap";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useCountdown, formatCountdown } from "@/hooks/useCountdown";
import type { ApiRound } from "@/lib/api/types";

/**
 * "Between rounds" landing — shown on /play when there's no currently-open
 * round but a scheduled one is queued. Live countdown to opens_at; once
 * it hits zero, the page auto-refreshes so the SSR can promote the player
 * into the now-open round.
 */
export function UpcomingRoundView({ round }: { round: ApiRound }) {
  const { countdown, ready } = useCountdown(round.opensAt);

  // When the countdown hits zero, app:rounds:tick (every minute) flips the
  // round to "open" within ~60s. A soft reload picks up the new state.
  if (ready && countdown.expired) {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <main className="relative min-h-screen w-screen overflow-hidden bg-[var(--color-bg)] scanlines">
      {/* Ambient map backdrop with the same dimming as the landing */}
      <div className="fixed inset-0 z-0">
        <AmbientMap />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(10,14,26,0) 0%, rgba(10,14,26,0.6) 60%, rgba(10,14,26,0.95) 100%)",
          }}
        />
      </div>

      <section className="relative z-10 grid min-h-screen w-full place-items-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
          className="pointer-events-auto w-full max-w-[560px]"
        >
          <GlassPanel
            variant="strong"
            className="overflow-hidden rounded-[var(--radius-xl)] p-9 text-center sm:p-10"
          >
            <p className="mb-4 text-[10px] uppercase tracking-[0.35em] text-[var(--color-text-muted)]">
              <PulseDot color="amber" /> Round #{round.number} · scheduled
            </p>

            <h1 className="mb-4 font-[family-name:var(--font-space-grotesk)] text-[clamp(1.6rem,4vw,2.2rem)] font-semibold leading-tight tracking-tight">
              {round.question}
            </h1>

            <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
              Opens in
            </p>

            <p
              className="mb-6 font-[family-name:var(--font-jetbrains-mono)] text-[clamp(2.4rem,6vw,3.6rem)] font-bold tabular-nums"
              style={{
                color: "var(--color-cyan)",
                textShadow: "0 0 24px rgba(0, 212, 255, 0.45)",
              }}
            >
              {ready ? formatCountdown(countdown) : "—"}
            </p>

            <p className="mb-1 text-sm text-[var(--color-text-muted)]">
              Round opens{" "}
              <span className="text-[var(--color-text)]">
                {new Date(round.opensAt).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Closes{" "}
              <span className="text-[var(--color-text)]">
                {new Date(round.closesAt).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>

            <div className="mt-8 grid gap-3">
              <Link
                href="/leaderboard"
                className="rounded-full border border-[var(--color-cyan)] px-5 py-2.5 text-sm text-[var(--color-cyan)] transition-colors hover:bg-[var(--color-cyan)] hover:text-[var(--color-bg)]"
              >
                See the leaderboard while you wait →
              </Link>
              <Link
                href="/me"
                className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] hover:text-white"
              >
                or review your past rounds
              </Link>
            </div>
          </GlassPanel>
        </motion.div>
      </section>
    </main>
  );
}

function PulseDot({ color }: { color: "cyan" | "amber" }) {
  const c = color === "cyan" ? "var(--color-cyan)" : "var(--color-amber)";
  return (
    <span
      className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full align-middle"
      style={{ background: c, boxShadow: `0 0 10px ${c}` }}
    />
  );
}
