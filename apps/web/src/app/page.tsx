"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AmbientMap } from "@/components/map/AmbientMap";
import { ConnectWalletButton } from "@/components/auth/ConnectWalletButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Typewriter } from "@/components/ui/Typewriter";
import { landingStats as mockStats } from "@/lib/landing-pins";
import { useAuth } from "@/hooks/useAuth";
import { useStats } from "@/hooks/useStats";
import { QUESTION_TEMPLATES, ALL_QUESTIONS } from "@/lib/question-templates";
import { ScoringMapVisualization } from "@/components/landing/ScoringMapVisualization";

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
        <ResolutionSourcesSection />
        <ScoringSection />
        <StatsSection />
        <FinalCTASection onSignedIn={onSignedIn} />
        <SeoSection />
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
    title: "Data decides — not a human",
    body:
      "Round closes on the wall clock. A cron then queries the source API for the question (Open-Meteo for weather, USGS for earthquakes, etc.) and posts the truth automatically. No admin picks coordinates.",
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

// Typewriter cycles through every question the game asks — live + planned.
// Single source of truth in @/lib/question-templates so /admin and / stay
// synced as new resolvers ship.
const EXAMPLE_QUESTIONS = ALL_QUESTIONS;

function HowItWorksSection() {
  return (
    <section className="relative w-full px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionEyebrow>How it works</SectionEyebrow>
        <h2 className="mb-6 max-w-3xl font-[family-name:var(--font-space-grotesk)] text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-tight">
          One question per day.{" "}
          <span style={{ color: "var(--color-cyan)" }}>One pin.</span>{" "}
          <span style={{ color: "var(--color-magenta)" }}>One chance.</span>
        </h2>

        {/* Typewriter — cycles through example questions so visitors get
            a tangible feel for what "one question per day" looks like. */}
        <div className="mb-12 max-w-3xl">
          <p className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            for example —
          </p>
          <div className="min-h-[3.5rem] sm:min-h-[3rem]">
            <p className="font-[family-name:var(--font-space-grotesk)] text-[clamp(1.1rem,2.4vw,1.5rem)] font-medium leading-snug text-[var(--color-text)]">
              <Typewriter phrases={EXAMPLE_QUESTIONS} />
            </p>
          </div>
        </div>

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

// -------------------- Resolution sources --------------------
//
// Trust section. Players need to know answers aren't picked by a human —
// they're fetched from public APIs by a cron at resolves_at. This is the
// single most important credibility signal for a prediction game.

// Group QUESTION_TEMPLATES by source name. One card per unique source —
// status is "live" if AT LEAST ONE of its templates is live, else "planned".
// Auto-folds when we ship new sources; no manual sync.
type SourceCard = {
  name: string;
  href: string;
  status: "live" | "planned";
  statusAccent: "green" | "cyan";
  examples: string[];
  liveCount: number;
  plannedCount: number;
};

const SOURCES: SourceCard[] = (() => {
  const grouped = new Map<string, SourceCard>();
  for (const t of QUESTION_TEMPLATES) {
    const card = grouped.get(t.source) ?? {
      name: t.source,
      href: t.sourceUrl,
      status: "planned",
      statusAccent: "cyan",
      examples: [],
      liveCount: 0,
      plannedCount: 0,
    };
    if (t.status === "live") {
      card.liveCount += 1;
      card.status = "live";
      card.statusAccent = "green";
    } else {
      card.plannedCount += 1;
    }
    if (card.examples.length < 3) {
      // Strip the leading "Where will" / "Which" for a tighter card bullet.
      card.examples.push(
        t.question.replace(/^Where will (the )?/i, "").replace(/\?$/, ""),
      );
    }
    grouped.set(t.source, card);
  }
  // Live sources first, then planned. Within each group, more live-templates
  // first.
  return Array.from(grouped.values()).sort((a, b) => {
    if (a.status !== b.status) return a.status === "live" ? -1 : 1;
    return b.liveCount - a.liveCount;
  });
})();

function ResolutionSourcesSection() {
  return (
    <section className="relative w-full px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionEyebrow>How answers are resolved</SectionEyebrow>
        <h2 className="mb-4 max-w-3xl font-[family-name:var(--font-space-grotesk)] text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-tight">
          <span style={{ color: "var(--color-amber)" }}>No one picks the winner.</span>
          <br />
          Public APIs do.
        </h2>
        <p className="mb-12 max-w-3xl text-base leading-relaxed text-[var(--color-text-muted)]">
          When a round closes, a Symfony cron queries the question's source API,
          finds the actual location of the answer, and posts the coordinates
          on-chain (or off-chain, for credit rounds) — all without any
          human choosing where the pin lands. The same data anyone can fetch
          from the public endpoint is the data that decides who wins.
        </p>

        {/* The pipeline */}
        <div className="mb-10">
          <GlassPanel className="p-6">
            <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
              Resolution pipeline
            </p>
            <ol className="grid gap-4 sm:grid-cols-4">
              <PipelineStep n="01" label="Round closes" detail="Cron flips status at closes_at" accent="amber" />
              <PipelineStep n="02" label="Resolver fires" detail="API call to Open-Meteo / USGS / etc." accent="cyan" />
              <PipelineStep n="03" label="Tie-break" detail="Hourly probe splits 0.1°C ties" accent="magenta" />
              <PipelineStep n="04" label="Payout" detail="Haversine rank → pool split → on-chain" accent="green" />
            </ol>
          </GlassPanel>
        </div>

        {/* Sources grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {SOURCES.map((s, i) => (
            <motion.a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="block transition-transform hover:-translate-y-0.5"
            >
              <GlassPanel className="h-full p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="font-[family-name:var(--font-space-grotesk)] text-base font-semibold">
                    {s.name}
                  </h3>
                  <StatusPill
                    status={s.status}
                    accent={s.statusAccent}
                    liveCount={s.liveCount}
                    plannedCount={s.plannedCount}
                  />
                </div>

                <p className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                  Example questions
                </p>
                <ul className="space-y-1">
                  {s.examples.map((ex) => (
                    <li key={ex} className="flex items-start gap-2 text-sm">
                      <span
                        className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full"
                        style={{ background: `var(--color-${s.statusAccent})` }}
                      />
                      <span className="text-[var(--color-text)]">{ex}</span>
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            </motion.a>
          ))}
        </div>

        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-[var(--color-text-muted)]">
          The resolver framework is{" "}
          <a
            href="https://github.com/kindrakevich-agency/GeoCast/tree/main/apps/api/src/Service/Questions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-cyan)] underline-offset-4 hover:underline"
          >
            open-source
          </a>
          {" "}— every question template is a single PHP class that implements{" "}
          <code className="rounded-sm border border-[var(--color-border)] bg-black/40 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--color-cyan)]">
            ResolverInterface
          </code>{" "}
          with a suggest() and a resolve() method. You can read exactly what
          query is being made, with what parameters, to which endpoint.
        </p>
      </div>
    </section>
  );
}

function PipelineStep({
  n,
  label,
  detail,
  accent,
}: {
  n: string;
  label: string;
  detail: string;
  accent: "cyan" | "magenta" | "amber" | "green";
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-bold"
        style={{
          background: `var(--color-${accent})`,
          color: "var(--color-bg)",
        }}
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
          {detail}
        </p>
      </div>
    </li>
  );
}

function StatusPill({
  status,
  accent,
  liveCount,
  plannedCount,
}: {
  status: "live" | "planned";
  accent: "cyan" | "magenta" | "amber" | "green";
  liveCount?: number;
  plannedCount?: number;
}) {
  // For source cards, optionally surface the live/planned breakdown as
  // a small count after the pill so visitors can see at-a-glance how
  // much of a source is already shipped vs. still queued.
  const detail =
    liveCount !== undefined && plannedCount !== undefined
      ? ` · ${liveCount} live / ${plannedCount} planned`
      : "";
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.22em]"
      style={{ borderColor: `var(--color-${accent})`, color: `var(--color-${accent})` }}
    >
      {status === "live" && (
        <>
          <span
            className="mr-1.5 inline-block h-1 w-1 animate-pulse rounded-full align-middle"
            style={{ background: `var(--color-${accent})`, boxShadow: `0 0 6px var(--color-${accent})` }}
          />
          live{detail}
        </>
      )}
      {status === "planned" && <>planned{detail}</>}
    </span>
  );
}

// -------------------- Scoring --------------------

function ScoringSection() {
  return (
    <section className="relative w-full px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionEyebrow>The math</SectionEyebrow>
        <h2 className="mb-6 max-w-3xl font-[family-name:var(--font-space-grotesk)] text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-tight">
          Scoring is{" "}
          <span style={{ color: "var(--color-amber)" }}>inverse distance</span>.
          Long-tail friendly.
        </h2>

        <p className="mb-10 max-w-3xl text-base leading-relaxed text-[var(--color-text-muted)]">
          For a pin at haversine distance{" "}
          <Tk>d</Tk> km from the truth, raw score ={" "}
          <span style={{ color: "var(--color-cyan)" }}>1 / (1 + d)</span>. Your
          payout is your share of the pool: <Tk>floor</Tk>(pool ×{" "}
          <span style={{ color: "var(--color-magenta)" }}>your_raw_score</span>{" "}
          / Σ all_raw_scores). The closest pin always takes the biggest share,
          but a pin 2,000 km off still earns a sliver — long-tail engagement,
          no zero-sum trap.
        </p>

        <ScoringMapVisualization />
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

// -------------------- SEO copy --------------------
//
// Long-form prose for search engines (and curious humans). Lives above the
// footer, visually muted so it doesn't compete with the cinematic top of the
// page. Each FAQ item is also serialised into the JSON-LD FAQPage schema at
// the bottom of the section — Google reads that and may render rich-result
// accordions in SERPs.

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is GeoCast?",
    a: "GeoCast is a continuous-round geo-prediction game. Every round we publish one question — \"Where will the next M5+ earthquake strike in the next 24 hours?\", \"Where will the hottest European capital be in the next 24 hours?\" — and every player drops a single pin on a world map. Each round runs for exactly 24 hours; the next one opens the second the previous one ends. After a round closes, the real location is fetched from a public API and players are ranked by haversine distance. The closest pin takes the biggest share of the pool, but even far-away guesses earn a sliver: scoring is inverse-distance, not winner-takes-all.",
  },
  {
    q: "Is GeoCast free to play?",
    a: "Yes. New accounts start with 100 in-game credits and each pin costs one credit. There are no top-ups, no purchases, and no subscriptions. The on-chain mode uses test USDC on Base Sepolia for portfolio demos; the production game is free.",
  },
  {
    q: "Do I need a crypto wallet?",
    a: "Yes — GeoCast uses Sign-In with Ethereum (SIWE, EIP-4361) for authentication. There is no email, no password, and no tracking. Your wallet address is your account. Any EVM-compatible wallet works: MetaMask, Rabby, Coinbase Wallet, Rainbow, or any WalletConnect-compatible wallet on desktop or mobile.",
  },
  {
    q: "How are pin distances calculated?",
    a: "Using the haversine formula on a sphere of radius 6,371 km — the standard great-circle distance between two latitude/longitude points. The math runs server-side in MariaDB via ST_Distance_Sphere on indexed SPATIAL POINT columns, so ranking thousands of pins on round resolution is sub-second.",
  },
  {
    q: "Who decides where the correct answer is?",
    a: "Nobody — a public API does. When a round closes, a cron job queries the question's source endpoint (Open-Meteo for weather, USGS for earthquakes, NASA FIRMS for wildfires, etc.) and posts the actual answer coordinates automatically. There is no admin button that places the pin. The same data anyone can fetch from the public endpoint is the data that decides the round, which makes outcomes verifiable and tamper-resistant. If a daily aggregate is tied (two cities at the same max temperature), a second hourly probe breaks it; if a true tie survives, the round resolves multi-winner and your distance scores against the closest of the tied locations.",
  },
  {
    q: "How is the prize pool split?",
    a: "Each prediction earns a raw score of 1 / (1 + distance_km). Your payout is your share of the round pool: floor(pool × your_raw_score ÷ sum_of_raw_scores). This long-tail curve guarantees that the closest pin always wins the biggest share, while still rewarding casual players who weren't quite right — no zero-sum trap.",
  },
  {
    q: "Is GeoCast a prediction market?",
    a: "No. GeoCast is a geo-prediction game, not a regulated prediction market. There are no derivatives, no shares, and no real-money speculation in the live product. The pool is split pro-rata by accuracy of a geographic guess, not by buying contracts against an outcome. The optional on-chain mode is testnet-only and exists to demonstrate the architecture for a senior full-stack portfolio.",
  },
  {
    q: "What does the leaderboard show?",
    a: "Three rankings — today, this week, and all-time — sourced from a Redis sorted set so reads stay sub-millisecond even with thousands of players. The all-time score is the cumulative sum of raw scores across every resolved round you've played: distance-weighted, so consistent close guesses beat one lucky hit.",
  },
  {
    q: "Who builds GeoCast?",
    a: "GeoCast is built solo by Vitalii Kindrakevych (kindrakevich-agency) as a senior full-stack portfolio piece. Stack: Next.js 16 + Tailwind 4 + MapLibre + wagmi on the front; Symfony 7.4 + API Platform + MariaDB SPATIAL + Predis on the back; Pusher Channels for real-time presence; Foundry + OpenZeppelin contracts for the optional on-chain pool on Base. Source is open at github.com/kindrakevich-agency/GeoCast.",
  },
];

function SeoSection() {
  // JSON-LD FAQPage schema — gives Google enough structure to render rich
  // accordion results. Same content as the visible FAQ; one source of truth.
  const ldFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const ldWebsite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "GeoCast",
    url: "https://geocast.games",
    description:
      "Daily geo-prediction game. Drop a pin on a world map; closest guess wins the round pool.",
    inLanguage: "en",
  };

  const ldOrg = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GeoCast",
    url: "https://geocast.games",
    sameAs: ["https://github.com/kindrakevich-agency/GeoCast"],
  };

  return (
    <section className="relative w-full px-6 py-16 sm:py-20" aria-label="About GeoCast">
      <div className="mx-auto max-w-4xl">
        <SectionEyebrow>About</SectionEyebrow>
        <h2 className="mb-6 max-w-3xl font-[family-name:var(--font-space-grotesk)] text-[clamp(1.5rem,3.4vw,2.1rem)] font-semibold leading-tight tracking-tight">
          The world's only{" "}
          <span style={{ color: "var(--color-cyan)" }}>daily geo-prediction game</span>.
        </h2>

        <div className="space-y-4 text-sm leading-relaxed text-[var(--color-text-muted)]">
          <p>
            GeoCast asks one question per day — about earthquakes, weather, headlines,
            elections, sport, anything that pins to a place on Earth — and gives every
            player exactly one pin on a world map to commit their answer. Twenty-four
            hours later the truth is revealed and a haversine-ranked leaderboard
            settles the round. The closest pin earns the biggest share of the pool,
            but even a 2,000 km miss still pays a sliver: scoring is inverse-distance,
            engagement-friendly, and never zero-sum.
          </p>
          <p>
            The whole canvas is a full-screen MapLibre vector map (Carto Dark Matter
            tiles, no API key required), with glassmorphic panels floating on top.
            Sign in with your Ethereum wallet (SIWE, EIP-4361) — no email, no
            password, no tracking — and your address is your account. Real-time
            presence dots show other players' cursors as they hover the map; pin
            placements broadcast over Pusher to every connected viewer. When the
            round closes a cron queries the question's source API and posts the
            answer pin automatically — a great-circle line draws from your pin
            to the truth and your distance badge pulses in.
          </p>
          <p>
            <strong className="text-[var(--color-text)]">Answers are not picked by a human.</strong>{" "}
            Every question is paired with a resolver — a small PHP class that
            knows how to fetch the truth from a public API at round-close time.
            Today the weather questions resolve through{" "}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-cyan)] underline-offset-4 hover:underline"
            >
              Open-Meteo
            </a>{" "}(forecast + observed archive across ~47 European capitals,
            with hourly tie-break on 0.1°C ties); earthquakes will route through
            the USGS FDSN feed, wildfires through NASA FIRMS, geo-tagged headlines
            through GDELT. No admin button places the pin; the data anyone can
            fetch from the public endpoint is the data that decides the round.
          </p>
          <p>
            Built solo as a portfolio piece for the senior full-stack surface:
            Next.js 16 App Router + Tailwind 4 + MapLibre + Framer Motion on the
            front; Symfony 7.4 + API Platform 4 + Doctrine ORM + MariaDB SPATIAL
            POINT + Predis on the back; Pusher Channels for real-time; Foundry +
            OpenZeppelin contracts on Base for the optional on-chain pool.
            Dockerised end-to-end, deployable to a single Hetzner box with one
            command. Source is open at{" "}
            <a
              href="https://github.com/kindrakevich-agency/GeoCast"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-cyan)] underline-offset-4 hover:underline"
            >
              github.com/kindrakevich-agency/GeoCast
            </a>
            .
          </p>
        </div>

        <h3 className="mt-12 mb-5 font-[family-name:var(--font-space-grotesk)] text-lg font-semibold tracking-tight text-[var(--color-text)]">
          Frequently asked questions
        </h3>

        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-md border border-[var(--color-border)] bg-black/20 px-5 py-4 backdrop-blur-md transition-colors hover:border-[var(--color-cyan)]"
            >
              <summary className="cursor-pointer list-none font-[family-name:var(--font-space-grotesk)] text-sm font-medium text-[var(--color-text)] [&::-webkit-details-marker]:hidden">
                <span className="mr-3 inline-block text-[var(--color-cyan)] transition-transform group-open:rotate-90">
                  ▸
                </span>
                {item.q}
              </summary>
              <p className="mt-3 pl-6 text-sm leading-relaxed text-[var(--color-text-muted)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-10 text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] opacity-50">
          keywords: geo prediction game · daily map game · pin-drop game ·
          haversine ranking · web3 prediction game · siwe game · MapLibre game
        </p>
      </div>

      {/* JSON-LD structured data — invisible to humans, valuable to Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldWebsite) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldOrg) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldFaq) }}
      />
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
