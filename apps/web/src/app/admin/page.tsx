"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAdminContext } from "./AdminContext";
import type { ApiAdminRound, RoundStatus } from "@/lib/api/types";
import {
  QUESTION_TEMPLATES,
  type QuestionTemplate,
  type TemplateStatus,
} from "@/lib/question-templates";

/**
 * /admin — resolver-roadmap dashboard. Each card is a "question template":
 *
 *   • LIVE      — a registered PHP resolver class. The cron auto-publishes
 *                 rounds from it. Card shows recent rounds + next scheduled.
 *   • PLANNED   — described in docs, no PHP class yet. Card shows the
 *                 data source + an "implement me" stub.
 *
 * The roadmap is the source of truth for "what's done, what's next". When
 * you ship a new resolver class on the server, add it here with status="live".
 *
 * Why no manual round-create button: the cron creates every round.
 * app:questions:suggest --continuous --ensure-queued runs every 5 min and
 * keeps exactly one round queued. Manual creation is a relic from before
 * auto-mirror landed.
 */

// TEMPLATES + types live in @/lib/question-templates so the landing page,
// admin dashboard, and (future) any API endpoint can share one source of
// truth. To add a new planned template: append to QUESTION_TEMPLATES there.

export default function AdminRoadmapPage() {
  const { rounds, isSettled } = useAdminContext();

  // Group rounds by their auto_resolver_code so each template card can
  // surface its own history.
  const roundsByCode = useMemo(() => {
    const m = new Map<string, ApiAdminRound[]>();
    for (const r of rounds) {
      const code = r.autoResolverCode;
      if (!code) continue;
      const arr = m.get(code) ?? [];
      arr.push(r);
      m.set(code, arr);
    }
    return m;
  }, [rounds]);

  const live = QUESTION_TEMPLATES.filter((t) => t.status === "live");
  const planned = QUESTION_TEMPLATES.filter((t) => t.status === "planned");

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* Hero */}
      <header>
        <p className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          Question templates · roadmap
        </p>
        <h1 className="mb-3 font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold leading-tight tracking-tight">
          {live.length} live · {planned.length} planned
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">
          Every round is created automatically by{" "}
          <code className="rounded border border-[var(--color-border)] bg-black/40 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--color-cyan)]">
            app:questions:suggest --continuous --ensure-queued
          </code>{" "}
          on a 5-minute cron — no manual creation needed. Each card below is
          one resolver class. Implement one, mark it{" "}
          <span className="text-[var(--color-green)]">live</span>, and the next
          cron tick will start producing rounds from it.
        </p>
      </header>

      {/* LIVE section */}
      <section>
        <SectionHeader accent="green" label={`Live · ${live.length}`} />
        <div className="grid gap-4 lg:grid-cols-2">
          {live.map((t, i) => (
            <TemplateCard
              key={t.code}
              template={t}
              rounds={roundsByCode.get(t.code) ?? []}
              isSettled={isSettled}
              index={i}
            />
          ))}
        </div>
      </section>

      {/* PLANNED section */}
      <section>
        <SectionHeader accent="amber" label={`Planned · ${planned.length}`} />
        <div className="grid gap-3 lg:grid-cols-2">
          {planned.map((t, i) => (
            <TemplateCard
              key={t.code}
              template={t}
              rounds={[]}
              isSettled={isSettled}
              index={i}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  accent,
  label,
}: {
  accent: "green" | "amber";
  label: string;
}) {
  return (
    <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-black/30 px-3 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: `var(--color-${accent})`,
          boxShadow: `0 0 6px var(--color-${accent})`,
        }}
      />
      {label}
    </p>
  );
}

function TemplateCard({
  template,
  rounds,
  isSettled,
  index,
}: {
  template: QuestionTemplate;
  rounds: ApiAdminRound[];
  isSettled: boolean;
  index: number;
}) {
  const live = template.status === "live";
  const sorted = [...rounds].sort((a, b) => b.number - a.number);
  const scheduled = sorted.find((r) => r.status === "scheduled");
  const open = sorted.find((r) => r.status === "open");
  const recent = sorted.filter((r) => r.status === "resolved").slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <GlassPanel className={`h-full p-5 ${live ? "" : "opacity-65"}`}>
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              {template.code}
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <a
                href={template.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--color-cyan)]"
              >
                {template.source}
              </a>
            </p>
          </div>
          <StatusPill status={template.status} />
        </div>

        <p className="mb-3 font-[family-name:var(--font-space-grotesk)] text-base font-medium leading-snug">
          {template.question}
        </p>

        <p className="mb-4 text-xs leading-relaxed text-[var(--color-text-muted)]">
          {template.blurb}
        </p>

        {live && (
          <>
            {(open || scheduled) && (
              <div className="mb-3 grid gap-2">
                {open && <ActiveRoundRow round={open} label="OPEN" />}
                {scheduled && <ActiveRoundRow round={scheduled} label="QUEUED" />}
              </div>
            )}

            {recent.length > 0 && (
              <div>
                <p className="mb-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                  Recent ({rounds.filter((r) => r.status === "resolved").length} total)
                </p>
                <ul className="space-y-1">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/admin/round/${r.id}`}
                        className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-xs hover:border-[var(--color-border)] hover:bg-white/5"
                      >
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
                          #{r.number}
                        </span>
                        <span className="flex-1 truncate text-[var(--color-text-muted)]">
                          {r.answer
                            ? `${r.answer.lat.toFixed(2)}, ${r.answer.lng.toFixed(2)}`
                            : "—"}
                        </span>
                        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-[var(--color-green)]">
                          ✓ resolved
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isSettled && !open && !scheduled && recent.length === 0 && (
              <p className="text-[10px] italic text-[var(--color-text-muted)]">
                Resolver registered but no rounds yet — first one will appear at
                the next cron tick.
              </p>
            )}
          </>
        )}

        {!live && (
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            implement: <span className="text-[var(--color-amber)]">apps/api/src/Service/Questions/Resolver/</span>
          </p>
        )}
      </GlassPanel>
    </motion.div>
  );
}

function StatusPill({ status }: { status: TemplateStatus }) {
  const accent = status === "live" ? "green" : "amber";
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.22em]"
      style={{ borderColor: `var(--color-${accent})`, color: `var(--color-${accent})` }}
    >
      {status === "live" && (
        <span
          className="mr-1.5 inline-block h-1 w-1 animate-pulse rounded-full align-middle"
          style={{ background: `var(--color-${accent})`, boxShadow: `0 0 4px var(--color-${accent})` }}
        />
      )}
      {status}
    </span>
  );
}

function ActiveRoundRow({
  round,
  label,
}: {
  round: ApiAdminRound;
  label: string;
}) {
  const accent = round.status === "open" ? "cyan" : "magenta";
  const closesAt = new Date(round.closesAt);
  return (
    <Link
      href={`/admin/round/${round.id}`}
      className="block rounded-md border border-[var(--color-border)] bg-black/20 px-3 py-2 hover:bg-white/5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.22em]"
          style={{ color: `var(--color-${accent})` }}
        >
          #{round.number} · {label}
        </span>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
          closes {closesAt.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
        </span>
      </div>
    </Link>
  );
}
