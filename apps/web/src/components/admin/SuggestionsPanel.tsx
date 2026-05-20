"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { apiFetch } from "@/lib/api/client";
import {
  useAdminSuggestions,
  type AdminSuggestion,
} from "@/hooks/useAdminSuggestions";

/**
 * Pending-suggestions list for the admin sidebar. Renders ONLY when there
 * are pending suggestions — silent when the queue is empty so it doesn't
 * pollute the dashboard.
 *
 * Calling onChange after accept/reject lets the parent layout refetch its
 * rounds list (accepting a suggestion creates a new round).
 */
export function SuggestionsPanel({ onChange }: { onChange: () => void }) {
  const { suggestions, isSettled, refetch } = useAdminSuggestions();

  if (!isSettled) return null;
  if (suggestions.length === 0) return null;

  const reload = () => {
    refetch();
    onChange();
  };

  return (
    <div className="border-b border-[var(--color-border)] bg-black/30 backdrop-blur-md">
      <div className="px-3 py-2">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.25em] text-[var(--color-amber)]">
          <span
            className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full align-middle"
            style={{
              background: "var(--color-amber)",
              boxShadow: "0 0 6px var(--color-amber)",
            }}
          />
          Suggestions · {suggestions.length} pending
        </p>
      </div>
      <ul className="max-h-[40vh] space-y-2 overflow-y-auto px-3 pb-3">
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} onChange={reload} />
        ))}
      </ul>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onChange,
}: {
  suggestion: AdminSuggestion;
  onChange: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "accepting" | "rejecting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const opensAt = new Date(suggestion.opensAt);
  const closesAt = new Date(suggestion.closesAt);
  const resolvesAt = new Date(suggestion.resolvesAt);

  const accept = async () => {
    setPhase("accepting");
    setError(null);
    try {
      await apiFetch(`/admin/suggestions/${suggestion.id}/accept`, { method: "POST" });
      onChange();
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  };

  const reject = async () => {
    setPhase("rejecting");
    setError(null);
    try {
      await apiFetch(`/admin/suggestions/${suggestion.id}/reject`, { method: "POST" });
      onChange();
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  };

  const disabled = phase !== "idle";

  return (
    <motion.li
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <GlassPanel className="p-3">
        <p className="mb-1 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          {suggestion.resolverCode}
        </p>
        <p className="mb-2 text-sm leading-snug">{suggestion.question}</p>
        <p className="mb-3 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
          opens {opensAt.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
          {" → closes "}
          {closesAt.toLocaleString(undefined, { timeStyle: "short" })}
          {" · resolves "}
          {resolvesAt.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
        </p>

        {suggestion.preview && Object.keys(suggestion.preview).length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mb-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] hover:text-[var(--color-cyan)]"
          >
            {expanded ? "− hide preview" : "+ show preview"}
          </button>
        )}
        <AnimatePresence>
          {expanded && suggestion.preview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <pre className="mb-3 max-h-40 overflow-y-auto rounded-md border border-[var(--color-border)] bg-black/40 p-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
                {JSON.stringify(suggestion.preview, null, 2)}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={accept}
            disabled={disabled}
            className="flex-1 rounded-full border border-[var(--color-green)] px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-green)] transition-colors hover:bg-[var(--color-green)] hover:text-[var(--color-bg)] disabled:opacity-40"
          >
            {phase === "accepting" ? "publishing…" : "publish round"}
          </button>
          <button
            type="button"
            onClick={reject}
            disabled={disabled}
            className="rounded-full border border-[var(--color-text-muted)] px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-magenta)] hover:text-[var(--color-magenta)] disabled:opacity-40"
          >
            {phase === "rejecting" ? "…" : "dismiss"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-[10px] text-[var(--color-magenta)]">{error}</p>
        )}
      </GlassPanel>
    </motion.li>
  );
}
