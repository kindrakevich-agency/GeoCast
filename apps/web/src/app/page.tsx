"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AmbientMap } from "@/components/map/AmbientMap";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { landingStats } from "@/lib/landing-pins";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)] scanlines">
      <AmbientMap />

      {/* Top-right discreet "skip to demo" link */}
      <Link
        href="/rounds/demo"
        className="pointer-events-auto absolute right-6 top-6 z-30 rounded-full border border-[var(--color-border)] bg-black/40 px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] backdrop-blur-md transition-colors hover:border-[var(--color-cyan)] hover:text-white"
      >
        Skip → Active round
      </Link>

      {/* Center stage */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 22 }}
        className="pointer-events-auto absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-[58%]"
      >
        <GlassPanel
          variant="strong"
          className="w-[min(520px,calc(100vw-3rem))] overflow-hidden rounded-[var(--radius-xl)] p-9 text-center sm:p-10"
        >
          <p className="mb-4 text-[10px] uppercase tracking-[0.35em] text-[var(--color-text-muted)]">
            <span
              className="mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ background: "var(--color-cyan)", boxShadow: "0 0 10px var(--color-cyan)" }}
            />
            Round #482 · open now
          </p>

          <h1 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-[clamp(2.6rem,7vw,4rem)] font-bold leading-none tracking-tight">
            <span
              className="bg-gradient-to-br from-[var(--color-cyan)] via-white to-[var(--color-magenta)] bg-clip-text text-transparent"
              style={{ textShadow: "0 0 40px rgba(0, 212, 255, 0.25)" }}
            >
              GeoCast
            </span>
          </h1>

          <p className="mb-2 text-lg text-[var(--color-text)]">
            Drop a pin. Predict the world.
          </p>
          <p className="mb-8 text-sm text-[var(--color-text-muted)]">
            One question. One pin. Closest answer wins.
          </p>

          <Link
            href="/rounds/demo"
            className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius)] px-6 py-3.5 font-medium text-[var(--color-bg)] ring-glow-cyan transition-transform hover:scale-[1.015]"
            style={{ background: "var(--color-cyan)" }}
          >
            <WalletIcon />
            <span>Connect Wallet</span>
            <span className="ml-1 font-[family-name:var(--font-jetbrains-mono)] text-xs opacity-70 transition-opacity group-hover:opacity-100">
              → enter round
            </span>
            <motion.span
              initial={{ x: "-130%", opacity: 0 }}
              animate={{ x: "130%", opacity: [0, 0.55, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
              className="pointer-events-none absolute inset-y-0 w-1/3 rounded-sm"
              style={{
                background:
                  "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)",
                filter: "blur(2px)",
              }}
            />
          </Link>

          <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            SIWE — no email, no password, no tracking
          </p>
        </GlassPanel>
      </motion.div>

      {/* Footer stats strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-20"
      >
        <div className="mx-auto max-w-5xl px-6 pb-6">
          <div className="glass flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-full border border-[var(--color-border)] px-6 py-3 text-xs">
            <Stat
              label="Pins this week"
              value={landingStats.pinsThisWeek.toLocaleString()}
            />
            <Sep />
            <Stat
              label="Last winner"
              value={
                <>
                  <span className="font-[family-name:var(--font-jetbrains-mono)]">
                    {landingStats.lastWinner.wallet}
                  </span>
                  <span className="ml-2 text-[var(--color-text-muted)]">
                    {landingStats.lastWinner.kmOff} km off · +{landingStats.lastWinner.payout} cr
                  </span>
                </>
              }
            />
            <Sep />
            <Stat
              label="Active rounds"
              value={landingStats.activeRounds.toString()}
              accent
            />
            <Sep />
            <Stat
              label="Total explorers"
              value={landingStats.totalPlayers.toLocaleString()}
            />
          </div>
        </div>
      </motion.div>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-[9px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className="font-[family-name:var(--font-jetbrains-mono)] text-sm"
        style={{ color: accent ? "var(--color-cyan)" : "var(--color-text)" }}
      >
        {value}
      </span>
    </span>
  );
}

function Sep() {
  return <span className="hidden h-3 w-px bg-[var(--color-border)] sm:block" />;
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 7.5C3 6.12 4.12 5 5.5 5h13A2.5 2.5 0 0 1 21 7.5V9h-2V8a1 1 0 0 0-1-1H6a1 1 0 0 0 0 2h14v2H6a3 3 0 0 1-3-3V7.5z"
        fill="currentColor"
      />
      <path
        d="M3 10h17a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7zm14 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
        fill="currentColor"
      />
    </svg>
  );
}
