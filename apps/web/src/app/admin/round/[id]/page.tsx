"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Map, { Marker, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useCreateRound } from "@/hooks/useCreateRound";
import { useOnchainRound } from "@/hooks/useOnchainRound";
import { useResolveOnchain } from "@/hooks/useResolveOnchain";
import { apiFetch } from "@/lib/api/client";
import type { ApiAdminRound, ApiResolveResponse } from "@/lib/api/types";
import type { LngLat } from "@/lib/mock";
import { isOnchainEnabled } from "@/lib/onchain/config";
import { useAdminContext } from "../../AdminContext";
import { StatusBadge } from "../../layout";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/**
 * /admin/round/{ulid} — round-detail pane. Reads the round from
 * AdminContext (populated by the layout's useAdminRounds), so direct-link
 * navigation works after the rounds list lands.
 */
export default function AdminRoundPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { rounds, refetch, isSettled } = useAdminContext();
  const round = rounds.find((r) => r.id === id) ?? null;

  if (!isSettled) {
    return <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>;
  }
  if (!round) {
    return (
      <GlassPanel className="p-6">
        <p className="text-sm">Round not found.</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          The id <code>{id}</code> isn't in the rounds list. Maybe it was
          created on another device — try refreshing.
        </p>
      </GlassPanel>
    );
  }
  return <RoundDetail key={round.id} round={round} onChanged={refetch} />;
}

// ---------- Detail body + per-status panels ----------

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
      {round.status === "resolved" && round.answer && <ResolvedSummary round={round} />}
    </div>
  );
}

function OnchainMirrorPanel({ round }: { round: ApiAdminRound }) {
  const onchain = useOnchainRound(round.number);
  const { status, create } = useCreateRound();

  if (onchain.isLoading) return null;

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
          const opensAt = Math.floor(new Date(round.opensAt).getTime() / 1000);
          const closesAt = Math.floor(new Date(round.closesAt).getTime() / 1000);
          const revealsAt = closesAt + 6 * 3600;
          await create({
            roundNumber: round.number,
            opensAt,
            closesAt,
            revealsAt,
          });
          // create() now waits for the tx receipt before resolving, so
          // refetching here surfaces the new state immediately.
          onchain.refetch();
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

// ---------- Resolve form ----------

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
          { headers: { "Accept-Language": "en" }, signal: ctrl.signal },
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
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

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
