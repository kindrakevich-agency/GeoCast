"use client";

import Map, { Marker } from "react-map-gl/maplibre";
import { useParams } from "next/navigation";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useOnchainRound } from "@/hooks/useOnchainRound";
import type { ApiAdminRound } from "@/lib/api/types";
import { isOnchainEnabled } from "@/lib/onchain/config";
import { useAdminContext } from "../../AdminContext";
import { StatusBadge } from "../../layout";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/**
 * /admin/round/{ulid} — read-only round-detail pane.
 *
 * Every lifecycle transition is automated:
 *   • app:questions:suggest   creates + auto-publishes the next round
 *   • app:rounds:open         flips scheduled → open at opensAt
 *   • app:rounds:close        flips open → closed at closesAt
 *   • app:rounds:auto-resolve fetches the truth + settles on-chain
 *
 * The admin pane shows the state that the cron has reached. Manual open/
 * close/resolve buttons were removed because each one created a window
 * where the admin could fork off the automated path. See OnchainMirror-
 * Panel for the on-chain status read-out.
 */
export default function AdminRoundPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { rounds, isSettled } = useAdminContext();
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
  return <RoundDetail key={round.id} round={round} />;
}

// ---------- Detail body + per-status panels ----------

function RoundDetail({ round }: { round: ApiAdminRound }) {
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
          opens {round.opensAt} · closes {round.closesAt} · {round.totalParticipants} pins
        </p>
      </header>

      {isOnchainEnabled() && <OnchainMirrorPanel round={round} />}

      {round.status === "scheduled" && (
        <LifecycleNote body={`Queued. Cron flips to open at ${round.opensAt}.`} />
      )}
      {round.status === "open" && (
        <LifecycleNote body={`Open until ${round.closesAt}. Cron flips to closed automatically.`} />
      )}
      {round.status === "closed" && (
        <LifecycleNote
          accent="amber"
          body="Closed. Auto-resolver fetches the truth + settles on-chain on the next cron tick."
        />
      )}
      {round.status === "resolved" && round.answer && <ResolvedSummary round={round} />}
    </div>
  );
}

function LifecycleNote({ body, accent }: { body: string; accent?: "amber" }) {
  return (
    <GlassPanel className="p-6">
      <p
        className="text-sm"
        style={{ color: accent === "amber" ? "var(--color-amber)" : "var(--color-text-muted)" }}
      >
        {body}
      </p>
    </GlassPanel>
  );
}

function OnchainMirrorPanel({ round }: { round: ApiAdminRound }) {
  const onchain = useOnchainRound(round.number);

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

  // The cron's broadcaster mirrors every new round on creation; if this
  // panel is showing it means the mirror tx hasn't landed yet. Resolves
  // within ~30s on the next onchain:sync tick.
  return (
    <GlassPanel className="p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
        Mirroring on-chain…
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Round #{round.number} was created off-chain. The server-side
        broadcaster will fire <code>GeoCastPool.createRound()</code> on the
        next cron tick.
      </p>
    </GlassPanel>
  );
}

function ResolvedSummary({ round }: { round: ApiAdminRound }) {
  // Multi-winner: render every answer pin. answer_points carries the full
  // list (set when the auto-resolver hit a true tie); when null, fall back
  // to the single legacy answer_lat/answer_lng pair.
  const points =
    round.answerPoints && round.answerPoints.length > 0
      ? round.answerPoints
      : round.answer
      ? [{ lat: round.answer.lat, lng: round.answer.lng, name: "" }]
      : [];
  if (points.length === 0) return null;

  const primary = points[0];

  return (
    <GlassPanel className="overflow-hidden p-0">
      <div className="h-72 w-full">
        <Map
          mapStyle={MAP_STYLE}
          initialViewState={{ longitude: primary.lng, latitude: primary.lat, zoom: 4 }}
          attributionControl={false}
          interactive={true}
        >
          {points.map((p, i) => (
            <Marker key={i} longitude={p.lng} latitude={p.lat} anchor="bottom">
              <span
                className="block h-4 w-4 rounded-full"
                style={{
                  background: "var(--color-magenta)",
                  boxShadow:
                    "0 0 18px var(--color-magenta), 0 0 0 2px white, 0 0 0 3px var(--color-magenta)",
                }}
              />
            </Marker>
          ))}
        </Map>
      </div>
      <div className="space-y-2 p-5">
        <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
          Answer{points.length > 1 ? ` · ${points.length} winners (tie)` : ""}
        </p>
        <ul className="space-y-0.5">
          {points.map((p, i) => (
            <li
              key={i}
              className="flex items-baseline gap-3 font-[family-name:var(--font-jetbrains-mono)] text-sm"
            >
              <span style={{ color: "var(--color-cyan)" }}>
                {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
              </span>
              {p.name && (
                <span className="text-[var(--color-text-muted)]">{p.name}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
          Resolved{" "}
          {round.resolvedAt
            ? new Date(round.resolvedAt).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "—"}
        </p>
      </div>
    </GlassPanel>
  );
}
