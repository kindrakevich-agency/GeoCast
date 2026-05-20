"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AmbientMap } from "@/components/map/AmbientMap";
import { ConnectWalletButton } from "@/components/auth/ConnectWalletButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { landingStats as mockStats } from "@/lib/landing-pins";
import { useAuth } from "@/hooks/useAuth";
import { useStats } from "@/hooks/useStats";

/**
 * Landing page. Five sections, all over the ambient world map background:
 *
 *   1. Hero          — wordmark, tagline, Connect Wallet, scroll cue
 *   2. How it works  — 4 sequential steps
 *   3. Scoring       — the haversine + payout formula, plus a tiny example
 *   4. Live stats    — pins this week, last winner, active rounds
 *   5. Final CTA     — second Connect Wallet
 *
 * The ambient map is `fixed inset-0` so it stays put as the user scrolls;
 * each section sits on its own page-height-ish band so scrolling feels
 * cinematic rather than docs-y.
 */
export default function Home() {
  const router = useRouter();
  const { isAuthed } = useAuth();
  const onSignedIn = () => router.push("/play");

  return (
    <main className="relative min-h-screen w-screen overflow-x-hidden bg-[var(--color-bg)] scanlines">
      {/* Fixed background — sits behind everything, no scroll */}
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

      {/* When already signed in, a quiet shortcut to the live round */}
      {isAuthed && (
        <Link
          href="/play"
          className="pointer-events-auto fixed right-6 top-6 z-40 rounded-full border border-[var(--color-cyan)] bg-black/50 px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-cyan)] backdrop-blur-md transition-colors hover:bg-[var(--color-cyan)] hover:text-[var(--color-bg)]"
        >
          ► Go to active round
        </Link>
      )}

      <div className="relative z-10">
        <HeroSection onSignedIn={onSignedIn} />
        <HowItWorksSection />
        <ScoringSection />
        <StatsSection />
        <FinalCTASection onSignedIn={onSignedIn} />
        <Footer />
      </div>
    </main>
  );
}

// -------------------- Hero --------------------

function HeroSection({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <section className="relative grid min-h-screen w-full place-items-center px-6">
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
            <PulseDot color="cyan" /> daily geo-prediction game · live
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
            One question, one pin, closest answer wins the pool.
          </p>

          <ConnectWalletButton onSignedIn={onSignedIn} />

          <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            SIWE · no email, no password, no tracking
          </p>
        </GlassPanel>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]"
      >
        scroll · how it works ↓
      </motion.div>
    </section>
  );
}

// -------------------- How it works --------------------

const STEPS = [
  {
    n: "01",
    title: "Sign in with your wallet",
    body:
      "SIWE: sign a one-time message. No password, no email, no tracking. Your address IS your account.",
    accent: "cyan" as const,
  },
  {
    n: "02",
    title: "Drop one pin",
    body:
      "Each round asks one question. Click anywhere on the world map to commit your prediction. One credit, one pin, no take-backs.",
    accent: "magenta" as const,
  },
  {
    n: "03",
    title: "Wait for the truth",
    body:
      "Round closes after 24h. The cron flips it to closed, then an admin (or future oracle) reveals the actual location.",
    accent: "amber" as const,
  },
  {
    n: "04",
    title: "Closest pin wins biggest",
    body:
      "Haversine distance, ranked. The pool is split by inverse distance — the closest pin gets the largest share, but even far pins earn a sliver.",
    accent: "green" as const,
  },
];

function HowItWorksSection() {
  return (
    <section className="relative w-full px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionEyebrow>How it works</SectionEyebrow>
        <h2 className="mb-12 max-w-3xl font-[family-name:var(--font-space-grotesk)] text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-tight">
          One question per day.{" "}
          <span style={{ color: "var(--color-cyan)" }}>One pin.</span>{" "}
          <span style={{ color: "var(--color-magenta)" }}>One chance.</span>
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <GlassPanel className="h-full p-6">
                <p
                  className="mb-4 font-[family-name:var(--font-jetbrains-mono)] text-3xl font-bold"
                  style={{ color: `var(--color-${s.accent})` }}
                >
                  {s.n}
                </p>
                <h3 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-base font-semibold">
                  {s.title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">{s.body}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// -------------------- Scoring --------------------

function ScoringSection() {
  return (
    <section className="relative w-full px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionEyebrow>The math</SectionEyebrow>
        <h2 className="mb-12 max-w-3xl font-[family-name:var(--font-space-grotesk)] text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-tight">
          Scoring is{" "}
          <span style={{ color: "var(--color-amber)" }}>inverse distance</span>.
          Long-tail friendly.
        </h2>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
          >
            <GlassPanel className="space-y-5 p-7">
              <p className="text-sm text-[var(--color-text-muted)]">
                For each prediction at haversine distance <Tk>d</Tk> km from the truth,
                we compute a raw score:
              </p>
              <Formula>
                raw_score ={" "}
                <span style={{ color: "var(--color-cyan)" }}>1 / (1 + d)</span>
              </Formula>
              <p className="text-sm text-[var(--color-text-muted)]">
                Then your payout is your share of the pool:
              </p>
              <Formula>
                payout = <Tk>floor</Tk>(pool ×{" "}
                <span style={{ color: "var(--color-magenta)" }}>raw_score</span> /
                Σ raw_scores)
              </Formula>
              <p className="text-sm text-[var(--color-text-muted)]">
                That single curve does two things at once: the closest pin always
                takes the biggest share, but a pin 2,000 km off still earns a sliver.
                Long-tail engagement, no zero-sum trap.
              </p>
            </GlassPanel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <GlassPanel className="space-y-3 p-7">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                Example · 100-credit pool · 3 players
              </p>
              <ExampleRow rank={1} distance={12} share={87} color="green" />
              <ExampleRow rank={2} distance={340} share={9} color="cyan" />
              <ExampleRow rank={3} distance={1820} share={2} color="amber" />
              <p className="pt-2 text-[10px] text-[var(--color-text-muted)] opacity-70">
                Resolved pool: 98 cr (rounding leaves 2 cr in the protocol bucket)
              </p>
            </GlassPanel>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ExampleRow({
  rank,
  distance,
  share,
  color,
}: {
  rank: number;
  distance: number;
  share: number;
  color: "green" | "cyan" | "amber";
}) {
  return (
    <div className="grid grid-cols-[36px_1fr_60px_60px] items-center gap-3 rounded-md border border-[var(--color-border)] bg-black/20 px-3 py-2">
      <span
        className="grid h-7 w-7 place-items-center rounded-full font-[family-name:var(--font-jetbrains-mono)] text-xs font-semibold"
        style={{
          background: `var(--color-${color})`,
          color: "var(--color-bg)",
        }}
      >
        #{rank}
      </span>
      <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--color-text-muted)]">
        {distance < 100 ? distance.toFixed(0) : Math.round(distance).toLocaleString()} km off
      </span>
      <span className="font-[family-name:var(--font-jetbrains-mono)] text-right text-xs text-[var(--color-text-muted)]">
        {(1 / (1 + distance)).toFixed(4)}
      </span>
      <span
        className="font-[family-name:var(--font-jetbrains-mono)] text-right text-sm font-semibold"
        style={{ color: `var(--color-${color})` }}
      >
        +{share} cr
      </span>
    </div>
  );
}

// -------------------- Live stats --------------------

function StatsSection() {
  const { stats } = useStats();
  // Real data when available; mock as fallback so the page never flashes
  // a loading shell. The footer subtitle below the cards quietly reveals
  // which source we're showing.
  const live = stats !== null;
  const pinsThisWeek = stats?.pinsThisWeek ?? mockStats.pinsThisWeek;
  const activeRounds = stats?.activeRounds ?? mockStats.activeRounds;
  const totalExplorers = stats?.totalExplorers ?? mockStats.totalPlayers;
  const winner = stats?.lastWinner ?? mockStats.lastWinner;

  return (
    <section className="relative w-full px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionEyebrow>Live activity</SectionEyebrow>
        <h2 className="mb-12 max-w-3xl font-[family-name:var(--font-space-grotesk)] text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-tight">
          The map is{" "}
          <span style={{ color: "var(--color-cyan)" }}>always playing</span>.
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatBox label="Pins this week" value={pinsThisWeek.toLocaleString()} accent="cyan" />
          <StatBox label="Active rounds" value={activeRounds.toString()} accent="green" />
          <StatBox label="Total explorers" value={totalExplorers.toLocaleString()} accent="magenta" />
          {winner ? (
            <StatBox
              label="Last winner"
              value={`${winner.kmOff} km off`}
              sub={`${winner.wallet} · +${winner.payout} cr`}
              accent="amber"
            />
          ) : (
            <StatBox
              label="Last winner"
              value="—"
              sub="no resolved rounds yet"
              accent="amber"
            />
          )}
        </div>

        <p className="mt-5 text-center font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] opacity-60">
          {live ? "live · /api/stats" : "loading…"}
        </p>
      </div>
    </section>
  );
}

function StatBox({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "cyan" | "magenta" | "green" | "amber";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4 }}
    >
      <GlassPanel className="p-5">
        <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
          {label}
        </p>
        <p
          className="font-[family-name:var(--font-jetbrains-mono)] text-2xl font-bold tabular-nums"
          style={{ color: `var(--color-${accent})` }}
        >
          {value}
        </p>
        {sub && (
          <p className="mt-1 truncate font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
            {sub}
          </p>
        )}
      </GlassPanel>
    </motion.div>
  );
}

// -------------------- Final CTA --------------------

function FinalCTASection({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <section className="relative w-full px-6 py-24 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl"
      >
        <GlassPanel
          variant="strong"
          className="overflow-hidden rounded-[var(--radius-xl)] p-9 text-center sm:p-10"
        >
          <p className="mb-4 text-[10px] uppercase tracking-[0.35em] text-[var(--color-text-muted)]">
            <PulseDot color="magenta" /> ready to predict?
          </p>
          <h2 className="mb-6 font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            One pin per round.
            <br />
            <span
              className="bg-gradient-to-br from-[var(--color-cyan)] to-[var(--color-magenta)] bg-clip-text text-transparent"
            >
              The world is your guess.
            </span>
          </h2>
          <ConnectWalletButton onSignedIn={onSignedIn} />
          <p className="mt-5 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            free · 100 starter credits
          </p>
        </GlassPanel>
      </motion.div>
    </section>
  );
}

// -------------------- Footer --------------------

function Footer() {
  return (
    <footer className="relative w-full px-6 pb-10 pt-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-6 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        <span>
          GeoCast · {new Date().getFullYear()} · built by{" "}
          <a
            href="https://github.com/kindrakevich-agency"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--color-cyan)]"
          >
            kindrakevich-agency
          </a>
        </span>
        <span className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
          <Link href="/play" className="hover:text-white">Active round</Link>
          <a
            href="https://github.com/kindrakevich-agency/GeoCast"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white"
          >
            source
          </a>
        </span>
      </div>
    </footer>
  );
}

// -------------------- Tiny atoms --------------------

function PulseDot({ color }: { color: "cyan" | "magenta" }) {
  const c = color === "cyan" ? "var(--color-cyan)" : "var(--color-magenta)";
  return (
    <span
      className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full align-middle"
      style={{ background: c, boxShadow: `0 0 10px ${c}` }}
    />
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)] backdrop-blur-md">
      <span
        className="inline-block h-1 w-1 rounded-full"
        style={{ background: "var(--color-cyan)", boxShadow: "0 0 6px var(--color-cyan)" }}
      />
      {children}
    </p>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-black/40 px-4 py-3 font-[family-name:var(--font-jetbrains-mono)] text-sm text-[var(--color-text)]">
      {children}
    </pre>
  );
}

function Tk({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-[family-name:var(--font-jetbrains-mono)] text-[var(--color-amber)]">
      {children}
    </span>
  );
}
