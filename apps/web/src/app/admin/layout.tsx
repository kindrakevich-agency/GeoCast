"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { SuggestionsPanel } from "@/components/admin/SuggestionsPanel";
import { useAdminRounds } from "@/hooks/useAdminRounds";
import { useAuth } from "@/hooks/useAuth";
import { useOnchainRound } from "@/hooks/useOnchainRound";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { ApiAdminRound, RoundStatus } from "@/lib/api/types";
import { isOnchainEnabled } from "@/lib/onchain/config";
import { AdminProvider } from "./AdminContext";

/**
 * /admin shell — top bar + sidebar (search + filterable rounds list).
 * Children fill the right pane. Routing:
 *
 *   /admin                  → placeholder ("select a round")
 *   /admin/round/{ulid}     → RoundDetail (the actual workflow)
 *
 * Layout persists across child navigation, so the sidebar's search input
 * + scroll position stay put as the admin clicks between rounds.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { user, isAuthed } = useAuth();
  const { rounds, isLoading, isSettled, error, refetch } = useAdminRounds();
  const [search, setSearch] = useState("");

  // Redirect non-admins after auth settles.
  useEffect(() => {
    if (!isAuthed) return;
    if (!user) return;
    if (!user.isAdmin) router.replace("/");
  }, [isAuthed, user, router]);

  // Selected round is driven by the URL — sidebar highlight reflects it.
  const selectedId = pathname.startsWith("/admin/round/")
    ? pathname.slice("/admin/round/".length)
    : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rounds;
    return rounds.filter((r) =>
      r.question.toLowerCase().includes(q) ||
      String(r.number).includes(q) ||
      r.id.toLowerCase().includes(q),
    );
  }, [rounds, search]);

  if (!isAuthed) {
    return <Gate body="Sign in with an admin wallet to use the dashboard." />;
  }
  if (user && !user.isAdmin) {
    return <Gate body="This wallet isn't an admin. Redirecting…" />;
  }

  return (
    <AdminProvider value={{ rounds, refetch, isLoading, isSettled }}>
      <main className="relative min-h-screen w-screen overflow-hidden bg-[var(--color-bg)] scanlines">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-black/30 px-6 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] hover:text-white"
            >
              ← back
            </Link>
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-base font-semibold tracking-wide">
              Admin · Rounds
            </h1>
          </div>
          <CreateRoundButton onCreated={refetch} />
        </div>

        <div className="grid h-[calc(100vh-49px)] grid-cols-[320px_1fr]">
          {/* Sidebar */}
          <aside className="flex flex-col overflow-hidden border-r border-[var(--color-border)] bg-black/20">
            <SuggestionsPanel onChange={refetch} />
            <div className="border-b border-[var(--color-border)] bg-black/40 p-3 backdrop-blur-md">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rounds…"
                className="w-full rounded-md border border-[var(--color-border)] bg-black/30 px-3 py-1.5 text-sm focus:border-[var(--color-cyan)] focus:outline-none"
              />
              {search && (
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  {filtered.length} of {rounds.length} match
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {!isSettled && (
                <p className="px-4 py-3 text-xs text-[var(--color-text-muted)]">Loading…</p>
              )}
              {error && (
                <p className="px-4 py-3 text-xs text-[var(--color-magenta)]">
                  {(error as ApiError).status === 403
                    ? "Forbidden (non-admin?)"
                    : (error as Error).message}
                </p>
              )}
              {isSettled && rounds.length === 0 && (
                <p className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                  No rounds yet. Create one above.
                </p>
              )}
              {isSettled && filtered.length === 0 && rounds.length > 0 && (
                <p className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                  No matches.
                </p>
              )}
              <ul>
                {filtered.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/round/${r.id}`}
                      className={`flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3 transition-colors ${
                        r.id === selectedId
                          ? "bg-white/[0.04]"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="mb-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                          Round {r.number}
                        </p>
                        <p className="truncate text-sm">{r.question}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={r.status} />
                        {isOnchainEnabled() && <OnchainBadge roundNumber={r.number} />}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Main pane — children = either placeholder page or round detail */}
          <section className="overflow-y-auto p-8">{children}</section>
        </div>
      </main>
    </AdminProvider>
  );
}

// ---------- Layout-local primitives ----------

function Gate({ body }: { body: string }) {
  return (
    <main className="grid min-h-screen w-screen place-items-center bg-[var(--color-bg)]">
      <GlassPanel variant="strong" className="px-8 py-6 text-center">
        <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Admin</p>
        <p className="text-sm">{body}</p>
      </GlassPanel>
    </main>
  );
}

export function StatusBadge({ status }: { status: RoundStatus }) {
  const color = {
    scheduled: "var(--color-text-muted)",
    open: "var(--color-cyan)",
    closed: "var(--color-amber)",
    resolved: "var(--color-green)",
  }[status];
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.18em]"
      style={{ borderColor: color, color }}
    >
      {status}
    </span>
  );
}

function OnchainBadge({ roundNumber }: { roundNumber: number }) {
  const onchain = useOnchainRound(roundNumber);
  if (!onchain.exists) return null;
  return (
    <span
      className="rounded-full border px-1.5 py-0 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.2em]"
      style={{ borderColor: "var(--color-magenta)", color: "var(--color-magenta)" }}
    >
      on-chain
    </span>
  );
}

// ---------- Create-round modal ----------
//
// Lives in the layout so it's reachable from any /admin/* page. Portaled
// into document.body so MapLibre's stacking context can't cover it.

function CreateRoundButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [opensAt, setOpensAt] = useState(() => isoLocal(new Date(Date.now() + 5 * 60 * 1000)));
  const [closesAt, setClosesAt] = useState(() => isoLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));

  useEffect(() => setMounted(true), []);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/admin/rounds", {
        method: "POST",
        body: {
          question,
          opensAt: new Date(opensAt).toISOString(),
          closesAt: new Date(closesAt).toISOString(),
        },
      });
      setOpen(false);
      setQuestion("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const modal = open && mounted ? createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/70 backdrop-blur-md"
      style={{ zIndex: 1000 }}
      onClick={() => setOpen(false)}
    >
      <GlassPanel
        variant="strong"
        className="w-[min(560px,calc(100%-2rem))] space-y-4 p-6"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <h3 className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold">
          Create round
        </h3>
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
            Question (≤ 280 chars)
          </span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-[var(--color-border)] bg-black/30 px-3 py-2 text-sm focus:border-[var(--color-cyan)] focus:outline-none"
            placeholder="Where will today's largest wildfire start?"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
              Opens at
            </span>
            <input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-black/30 px-2 py-1.5 text-xs focus:border-[var(--color-cyan)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
              Closes at
            </span>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-black/30 px-2 py-1.5 text-xs focus:border-[var(--color-cyan)] focus:outline-none"
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-full border border-[var(--color-border)] px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] hover:text-white"
          >
            cancel
          </button>
          <button
            onClick={submit}
            disabled={!question.trim() || submitting}
            className="rounded-full border border-[var(--color-cyan)] px-5 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-cyan)] hover:bg-[var(--color-cyan)] hover:text-[var(--color-bg)] disabled:opacity-50"
          >
            {submitting ? "creating…" : "create"}
          </button>
        </div>
        {error && <p className="text-xs text-[var(--color-magenta)]">{error}</p>}
      </GlassPanel>
    </motion.div>,
    document.body,
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--color-cyan)] px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-cyan)] hover:bg-[var(--color-cyan)] hover:text-[var(--color-bg)]"
      >
        + new round
      </button>
      {modal}
    </>
  );
}

function isoLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
