"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Map, { Marker, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAdminRounds } from "@/hooks/useAdminRounds";
import { useAuth } from "@/hooks/useAuth";
import { useCreateRound } from "@/hooks/useCreateRound";
import { useOnchainRound } from "@/hooks/useOnchainRound";
import { useResolveOnchain } from "@/hooks/useResolveOnchain";
import { ApiError, apiFetch } from "@/lib/api/client";
import type {
  ApiAdminRound,
  ApiResolveResponse,
  RoundStatus,
} from "@/lib/api/types";
import type { LngLat } from "@/lib/mock";
import { isOnchainEnabled } from "@/lib/onchain/config";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/**
 * Admin dashboard — rounds list + resolve / open / create.
 *
 * Auth gating happens client-side (user.isAdmin redirect) AND server-side
 * (security.yaml `^/admin → ROLE_ADMIN`). The frontend gate is for UX —
 * non-admins get bounced to `/` rather than seeing 403s in the network tab.
 */
export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthed } = useAuth();
  const { rounds, isLoading, isSettled, error, refetch } = useAdminRounds();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Redirect non-admins. Wait until auth settles before deciding.
  useEffect(() => {
    if (!isAuthed) return;
    if (!user) return;
    if (!user.isAdmin) router.replace("/");
  }, [isAuthed, user, router]);

  // Auto-select the newest round.
  useEffect(() => {
    if (selectedId !== null) return;
    if (rounds.length > 0) setSelectedId(rounds[0].id);
  }, [rounds, selectedId]);

  const selected = useMemo(
    () => rounds.find((r) => r.id === selectedId) ?? null,
    [rounds, selectedId],
  );

  if (!isAuthed) {
    return (
      <Gate body="Sign in with an admin wallet to use the dashboard." />
    );
  }
  if (user && !user.isAdmin) {
    return <Gate body="This wallet isn't an admin. Redirecting…" />;
  }

  return (
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

      <div className="grid h-[calc(100vh-48px)] grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="overflow-y-auto border-r border-[var(--color-border)] bg-black/20">
          {!isSettled && <p className="px-4 py-3 text-xs text-[var(--color-text-muted)]">Loading…</p>}
          {error && (
            <p className="px-4 py-3 text-xs text-[var(--color-magenta)]">
              {(error as ApiError).status === 403 ? "Forbidden (non-admin?)" : (error as Error).message}
            </p>
          )}
          {isSettled && rounds.length === 0 && (
            <p className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
              No rounds yet. Create one above.
            </p>
          )}
          <ul>
            {rounds.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={`flex w-full items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors ${
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
                  <StatusBadge status={r.status} />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main pane */}
        <section className="overflow-y-auto p-8">
          {selected ? (
            <RoundDetail key={selected.id} round={selected} onChanged={refetch} />
          ) : isLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              Select a round from the left.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

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

function StatusBadge({ status }: { status: RoundStatus }) {
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

// ---------- Round detail (per-status workflow) ----------

function RoundDetail({
  round,
  onChanged,
}: {
  round: ApiAdminRound;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-6">
      <header>
        <div className="mb-1 flex items-baseline justify-between">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            Round {round.number} · {round.status}
          </p>
          <StatusBadge status={round.status} />
        </div>
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold">
          {round.question}
        </h2>
        {round.description && (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{round.description}</p>
        )}
        <p className="mt-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
          opens {round.opensAt} · closes {round.closesAt} · pool {round.poolCredits} cr · {round.totalParticipants} pins
        </p>
      </header>

      {isOnchainEnabled() && <OnchainMirrorPanel round={round} />}

      {round.status === "scheduled" && <OpenNowAction round={round} onDone={onChanged} />}
      {round.status === "open" && (
        <GlassPanel className="p-6">
          <p className="text-sm text-[var(--color-text-muted)]">
            Round is open until {round.closesAt}. The cron will flip it to <em>closed</em> automatically.
          </p>
        </GlassPanel>
      )}
      {round.status === "closed" && <ResolveForm round={round} onDone={onChanged} />}
      {round.status === "resolved" && round.answer && (
        <ResolvedSummary round={round} />
      )}
    </div>
  );
}

// ---------- On-chain mirror panel ----------

function OnchainMirrorPanel({ round }: { round: ApiAdminRound }) {
  const onchain = useOnchainRound(round.number);
  const { status, create } = useCreateRound();

  if (onchain.isLoading) {
    return null;
  }

  if (onchain.exists) {
    return (
      <GlassPanel className="space-y-2 p-5">
        <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--color-green)" }}>
          ✓ Mirrored on-chain
        </p>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--color-text-muted)]">
          opens @ {new Date(onchain.opensAt * 1000).toLocaleString()} · closes @{" "}
          {new Date(onchain.closesAt * 1000).toLocaleString()} · reveals by{" "}
          {new Date(onchain.revealsAt * 1000).toLocaleString()}
        </p>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--color-text-muted)]">
          pool: {(Number(onchain.poolMicros) / 1_000_000).toFixed(2)} USDC
          {onchain.resolvedAt > 0 && ` · resolved @ ${new Date(onchain.resolvedAt * 1000).toLocaleString()}`}
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="flex items-center justify-between gap-6 p-5">
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
          Not yet on-chain
        </p>
        <p className="mt-1 text-sm">
          Mirror this round to GeoCastPool so players can commit with USDC.
        </p>
      </div>
      <button
        onClick={async () => {
          // Reveal window: 6h after close (matches docs/game.md §4).
          const opensAt = Math.floor(new Date(round.opensAt).getTime() / 1000);
          const closesAt = Math.floor(new Date(round.closesAt).getTime() / 1000);
          const revealsAt = closesAt + 6 * 3600;
          await create({
            roundNumber: round.number,
            opensAt,
            closesAt,
            revealsAt,
          });
        }}
        disabled={status.phase === "creating"}
        className="rounded-full border border-[var(--color-magenta)] px-5 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--color-magenta)] transition-colors hover:bg-[var(--color-magenta)] hover:text-[var(--color-bg)] disabled:opacity-50"
      >
        {status.phase === "creating" ? "creating…" : "create on-chain →"}
      </button>
      {status.phase === "error" && (
        <p className="text-xs text-[var(--color-magenta)]">{status.message}</p>
      )}
    </GlassPanel>
  );
}

function OpenNowAction({ round, onDone }: { round: ApiAdminRound; onDone: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <GlassPanel className="flex items-center justify-between gap-6 p-6">
      <p className="text-sm text-[var(--color-text-muted)]">
        Promote this round to <em>open</em> now (bypasses the cron's wall-clock check).
      </p>
      <button
        onClick={async () => {
          setSubmitting(true);
          setError(null);
          try {
            await apiFetch(`/admin/rounds/${round.id}/open`, { method: "POST" });
            onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSubmitting(false);
          }
        }}
        disabled={submitting}
        className="rounded-full border border-[var(--color-cyan)] px-5 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--color-cyan)] transition-colors hover:bg-[var(--color-cyan)] hover:text-[var(--color-bg)] disabled:opacity-50"
      >
        {submitting ? "opening…" : "open now →"}
      </button>
      {error && <p className="text-xs text-[var(--color-magenta)]">{error}</p>}
    </GlassPanel>
  );
}

function ResolvedSummary({ round }: { round: ApiAdminRound }) {
  return (
    <GlassPanel className="space-y-2 p-6">
      <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">Answer</p>
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm">
        {round.answer?.lat.toFixed(4)}, {round.answer?.lng.toFixed(4)}
      </p>
      <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
        Resolved {round.resolvedAt}
      </p>
    </GlassPanel>
  );
}

// ---------- Resolve form (geocoder + map click + confirm) ----------

type GeocodeHit = { display_name: string; lat: string; lon: string };

function ResolveForm({ round, onDone }: { round: ApiAdminRound; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [answer, setAnswer] = useState<LngLat | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResolveResponse | null>(null);
  const [onchainTxHash, setOnchainTxHash] = useState<string | null>(null);
  const mapRef = useRef<MapRef | null>(null);

  // When the round has been mirrored on-chain, the resolve flow goes via
  // GeoCastPool.resolve(merkleRoot) signed by the admin wallet, NOT the
  // off-chain DB resolver. The off-chain branch is kept for legacy rounds
  // that exist only in the DB (e.g. pre-deploy).
  const onchain = useOnchainRound(round.number);
  const { status: resolveOnchainStatus, resolve: resolveOnchain } = useResolveOnchain();
  const useOnchainPath = onchain.exists;

  // Debounced Nominatim search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
          {
            headers: { "Accept-Language": "en" },
            signal: ctrl.signal,
          },
        );
        const data: GeocodeHit[] = await res.json();
        setHits(data);
      } catch {
        // Silent — user can keep typing.
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const onMapClick = (e: MapLayerMouseEvent) => {
    setAnswer({ lat: e.lngLat.lat, lng: e.lngLat.lng });
  };

  const flyTo = (lat: number, lng: number) => {
    setAnswer({ lat, lng });
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 8, duration: 1200 });
  };

  const submit = async () => {
    if (!answer) return;
    setSubmitting(true);
    setError(null);

    if (useOnchainPath) {
      // On-chain path: compute Merkle root server-side from the Revealed
      // events, then sign GeoCastPool.resolve via the admin's wallet.
      try {
        const settle = await apiFetch<{
          merkleRoot: `0x${string}`;
          rakeMicros: number;
          totalPayoutMicros: number;
          leafCount: number;
          dustMicros: number;
          roundNumber: number;
        }>(`/admin/rounds/${round.id}/settle`, {
          method: "POST",
          body: { answerLat: answer.lat, answerLng: answer.lng },
        });

        await resolveOnchain({
          roundNumber: settle.roundNumber,
          answerLat: answer.lat,
          answerLng: answer.lng,
          merkleRoot: settle.merkleRoot,
        });
        // The success state surfaces via resolveOnchainStatus.phase === 'done'
        // useEffect below pumps the txHash into local state for the summary.
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Off-chain legacy path — credits.
    try {
      const data = await apiFetch<ApiResolveResponse>(`/admin/rounds/${round.id}/resolve`, {
        method: "POST",
        body: { answerLat: answer.lat, answerLng: answer.lng },
      });
      setResult(data);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Pump the on-chain tx hash into local state once it lands. The summary
  // panel below renders when result OR onchainTxHash is set.
  useEffect(() => {
    if (resolveOnchainStatus.phase === "done") {
      setOnchainTxHash(resolveOnchainStatus.txHash);
      onDone();
    }
    if (resolveOnchainStatus.phase === "error") {
      setError(resolveOnchainStatus.message);
    }
  }, [resolveOnchainStatus, onDone]);

  if (onchainTxHash) {
    return (
      <GlassPanel className="space-y-3 p-6">
        <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--color-green)" }}>
          ✓ Resolved on-chain
        </p>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm">
          answer: {answer?.lat.toFixed(4)}, {answer?.lng.toFixed(4)}
        </p>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-[var(--color-text-muted)]">
          tx: {onchainTxHash.slice(0, 10)}…{onchainTxHash.slice(-8)}
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Players can now claim their USDC payouts on /me.
        </p>
      </GlassPanel>
    );
  }

  if (result) {
    return (
      <GlassPanel className="space-y-3 p-6">
        <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--color-green)" }}>
          ✓ Resolved · {result.rankings.length} predictions ranked
        </p>
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm">
          answer: {result.round.answer?.lat.toFixed(4)}, {result.round.answer?.lng.toFixed(4)}
        </p>
        <ul className="space-y-1 font-[family-name:var(--font-jetbrains-mono)] text-xs">
          {result.rankings.slice(0, 10).map((r) => (
            <li key={r.predictionId} className="flex items-baseline gap-4">
              <span className="w-6 text-right text-[var(--color-text-muted)]">#{r.rank}</span>
              <span className="flex-1 truncate" style={{ color: "var(--color-text-muted)" }}>
                user {r.userId.slice(0, 12)}…
              </span>
              <span style={{ color: "var(--color-magenta)" }}>
                {r.distanceKm < 100 ? r.distanceKm.toFixed(1) : Math.round(r.distanceKm)} km
              </span>
              <span style={{ color: r.payout > 0 ? "var(--color-green)" : "var(--color-text-muted)" }}>
                +{r.payout} cr
              </span>
            </li>
          ))}
        </ul>
      </GlassPanel>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_360px]">
      {/* Map */}
      <GlassPanel className="relative h-[500px] overflow-hidden p-0">
        <Map
          ref={mapRef}
          mapStyle={MAP_STYLE}
          initialViewState={{ longitude: 12, latitude: 24, zoom: 1.5 }}
          attributionControl={false}
          onClick={onMapClick}
          cursor="crosshair"
        >
          {answer && (
            <Marker longitude={answer.lng} latitude={answer.lat} anchor="bottom">
              <span
                className="block h-3 w-3 rounded-full"
                style={{
                  background: "var(--color-magenta)",
                  boxShadow: "0 0 16px var(--color-magenta), 0 0 0 2px white",
                }}
              />
            </Marker>
          )}
        </Map>
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)] backdrop-blur-md">
          click the map to drop the truth pin
        </div>
      </GlassPanel>

      {/* Sidebar: geocoder + confirm */}
      <div className="space-y-3">
        <GlassPanel className="space-y-3 p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
            Search for the answer
          </p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Lisbon, Portugal"
            className="w-full rounded-md border border-[var(--color-border)] bg-black/30 px-3 py-2 text-sm focus:border-[var(--color-cyan)] focus:outline-none"
          />
          {searching && (
            <p className="text-[10px] text-[var(--color-text-muted)]">searching…</p>
          )}
          <ul className="space-y-1">
            {hits.map((h, i) => (
              <li key={i}>
                <button
                  onClick={() => flyTo(parseFloat(h.lat), parseFloat(h.lon))}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5"
                >
                  {h.display_name}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[9px] text-[var(--color-text-muted)] opacity-60">
            geocoding via OpenStreetMap Nominatim
          </p>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
            Selected answer
          </p>
          {answer ? (
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-sm">
              {answer.lat.toFixed(4)}, {answer.lng.toFixed(4)}
            </p>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              none yet — click the map or pick from search
            </p>
          )}
          <button
            onClick={submit}
            disabled={!answer || submitting || resolveOnchainStatus.phase === "resolving"}
            className="w-full rounded-full border border-[var(--color-magenta)] px-4 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--color-magenta)] transition-colors hover:bg-[var(--color-magenta)] hover:text-[var(--color-bg)] disabled:opacity-30"
          >
            {resolveOnchainStatus.phase === "resolving"
              ? "signing on-chain resolve…"
              : submitting
              ? useOnchainPath
                ? "computing merkle root…"
                : "resolving…"
              : useOnchainPath
              ? "resolve on-chain (USDC)"
              : "resolve round (credits)"}
          </button>
          {useOnchainPath && (
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Two-step: server computes the payout Merkle root → you sign
              GeoCastPool.resolve via your wallet → players can claim.
            </p>
          )}
          {error && <p className="text-xs text-[var(--color-magenta)]">{error}</p>}
        </GlassPanel>
      </div>
    </div>
  );
}

// ---------- Create-round mini-form ----------

function CreateRoundButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default window: opens now+5min, closes in 24h.
  const [opensAt, setOpensAt] = useState(() => isoLocal(new Date(Date.now() + 5 * 60 * 1000)));
  const [closesAt, setClosesAt] = useState(() => isoLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));

  // createPortal needs document.body — available only client-side. Toggling
  // a mount flag after first render gates the portal until then.
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

  // Portaled into document.body so the modal escapes any stacking context
  // created by the MapLibre canvas (which is the entire reason the popup
  // was rendering BEHIND the map before).
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

// HTML datetime-local wants 'YYYY-MM-DDTHH:mm' in local time.
function isoLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
