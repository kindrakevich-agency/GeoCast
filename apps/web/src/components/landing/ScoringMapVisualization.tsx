"use client";

import { useMemo } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
import { GlassPanel } from "@/components/ui/GlassPanel";

/**
 * Worked example of the scoring math, rendered on a real world map.
 *
 * - Magenta pin = the truth (round's answer).
 * - 12 player pins scattered globally, sized by their raw_score
 *   (smaller distance → bigger pin → brighter ring).
 * - Great-circle line from each player pin to the truth, opacity
 *   scaled by score so the winner's line is bright cyan and the
 *   long-tail pins fade into the background.
 * - Side panel ranks every player by distance + shows their raw_score
 *   and USDC payout from a 100-USDC pool (5% rake → 95 USDC distributed).
 *
 * The pins are fixed for visual stability across page loads. Realistic
 * spread: one player nailed it (Coimbra, ~150km from the Lisbon truth),
 * three more in the same continent (Madrid, Paris, Casablanca), the
 * rest scattered to Tokyo, Sydney, Cape Town, NYC etc. — perfect for
 * showing how a 14,000-km miss still earns a coin.
 */

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const TRUTH = { lat: 38.7223, lng: -9.1393, name: "Lisbon (truth)" };

// Real-money mode: every pin costs 1 USDC, so 100 players → 100 USDC pool.
// The contract takes a 5% rake to treasury; the remaining 95 USDC is
// distributed inverse-distance to winners. We use 12 representative pins
// in this visualisation but scale the pool to 100 USDC so the numbers
// read at the right magnitude.
const POOL_USDC = 100;
const RAKE_BPS = 500; // 5%
const DISTRIBUTABLE_USDC = (POOL_USDC * (10_000 - RAKE_BPS)) / 10_000; // = 95

type PlayerPin = { name: string; lat: number; lng: number };

const PLAYER_PINS: PlayerPin[] = [
  // Closest — winners.
  { name: "Coimbra",     lat: 40.2110, lng:  -8.4292 }, // ~165 km
  { name: "Madrid",      lat: 40.4168, lng:  -3.7038 }, // ~503 km
  { name: "Casablanca",  lat: 33.5731, lng:  -7.5898 }, // ~582 km
  { name: "Paris",       lat: 48.8566, lng:   2.3522 }, // ~1455 km
  { name: "London",      lat: 51.5074, lng:  -0.1278 }, // ~1582 km
  { name: "Rome",        lat: 41.9028, lng:  12.4964 }, // ~1865 km
  // Mid-range.
  { name: "Istanbul",    lat: 41.0082, lng:  28.9784 }, // ~3554 km
  { name: "Cairo",       lat: 30.0444, lng:  31.2357 }, // ~3793 km
  // Long tail — still earns a sliver.
  { name: "Lagos",       lat:  6.5244, lng:   3.3792 }, // ~4256 km
  { name: "New York",    lat: 40.7128, lng: -74.0060 }, // ~5402 km
  { name: "Cape Town",   lat:-33.9249, lng:  18.4241 }, // ~8367 km
  { name: "Tokyo",       lat: 35.6762, lng: 139.6503 }, // ~10,919 km
];

// Haversine on a 6371 km sphere — same formula MariaDB's ST_Distance_Sphere
// uses server-side.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type Ranked = {
  name: string;
  lat: number;
  lng: number;
  distance: number;
  rawScore: number;
  share: number;      // [0, 1] of distributable pool
  payoutUsdc: number; // 2-decimal USDC, floored to cent
  rank: number;
};

function rankPins(): Ranked[] {
  const scored = PLAYER_PINS.map((p) => {
    const d = haversineKm(p.lat, p.lng, TRUTH.lat, TRUTH.lng);
    return { ...p, distance: d, rawScore: 1 / (1 + d) };
  });
  const sumRaw = scored.reduce((s, r) => s + r.rawScore, 0);
  return scored
    .map((r) => {
      const share = r.rawScore / sumRaw;
      // Floor to the cent — matches the contract's per-leaf payout floor
      // (mirrors the 6-decimal USDC, displayed to 2dp for human reading).
      const payoutUsdc = Math.floor(DISTRIBUTABLE_USDC * share * 100) / 100;
      return { ...r, share, payoutUsdc };
    })
    .sort((a, b) => a.distance - b.distance)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function ScoringMapVisualization() {
  const ranked = useMemo(() => rankPins(), []);
  const winner = ranked[0];

  // Pin visual size scales by raw_score, normalised against the winner.
  // Winner = 22px, long-tail pins = ~6px.
  const winnerScore = winner.rawScore;
  const pinSize = (r: Ranked): number => 6 + 16 * (r.rawScore / winnerScore);

  // GeoJSON for the great-circle lines, opacity scaled per row.
  const linesGeo = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: ranked.map((r) => ({
        type: "Feature" as const,
        properties: {
          rank: r.rank,
          opacity: 0.15 + 0.7 * (r.rawScore / winnerScore),
        },
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [r.lng, r.lat],
            [TRUTH.lng, TRUTH.lat],
          ],
        },
      })),
    }),
    [ranked, winnerScore],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      {/* Map */}
      <GlassPanel className="overflow-hidden p-0">
        <div className="h-[460px] w-full">
          <Map
            mapStyle={MAP_STYLE}
            initialViewState={{ longitude: 12, latitude: 24, zoom: 1.4 }}
            attributionControl={false}
            interactive={true}
          >
            <Source id="scoring-lines" type="geojson" data={linesGeo}>
              <Layer
                id="scoring-lines-layer"
                type="line"
                paint={{
                  "line-color": "#00d4ff",
                  "line-width": 1.5,
                  "line-opacity": ["get", "opacity"],
                }}
              />
            </Source>

            {/* Player pins, sized by score */}
            {ranked.map((r) => {
              const sz = pinSize(r);
              const isWinner = r.rank === 1;
              return (
                <Marker key={r.name} longitude={r.lng} latitude={r.lat} anchor="center">
                  <div
                    className="rounded-full"
                    style={{
                      width: `${sz}px`,
                      height: `${sz}px`,
                      background: isWinner
                        ? "var(--color-green)"
                        : "var(--color-cyan)",
                      boxShadow: isWinner
                        ? "0 0 18px var(--color-green), 0 0 0 2px white"
                        : `0 0 ${Math.round(sz / 2)}px var(--color-cyan)`,
                      opacity: 0.4 + 0.6 * (r.rawScore / winnerScore),
                    }}
                  />
                </Marker>
              );
            })}

            {/* Truth pin */}
            <Marker longitude={TRUTH.lng} latitude={TRUTH.lat} anchor="center">
              <div
                className="rounded-full"
                style={{
                  width: "20px",
                  height: "20px",
                  background: "var(--color-magenta)",
                  boxShadow:
                    "0 0 24px var(--color-magenta), 0 0 0 2px white, 0 0 0 3px var(--color-magenta)",
                }}
              />
            </Marker>
          </Map>
        </div>

        {/* Map legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--color-border)] bg-black/30 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          <LegendDot color="magenta" label="Truth (answer)" />
          <LegendDot color="green" label="Winner" />
          <LegendDot color="cyan" label="Other players · brighter = closer = bigger share" />
        </div>
      </GlassPanel>

      {/* Ranked list */}
      <GlassPanel className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)] bg-black/30 px-5 py-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
            {POOL_USDC} USDC pool · {ranked.length} players · 5% rake → treasury
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)]">
            truth: {TRUTH.lat.toFixed(2)}, {TRUTH.lng.toFixed(2)} — {TRUTH.name}
          </p>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full font-[family-name:var(--font-jetbrains-mono)] text-xs">
            <thead className="bg-black/20 text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <tr>
                <th className="w-10 px-3 py-2 text-right">#</th>
                <th className="px-2 py-2 text-left">player</th>
                <th className="w-20 px-2 py-2 text-right">km off</th>
                <th className="w-20 px-2 py-2 text-right">raw_score</th>
                <th className="w-20 px-3 py-2 text-right">payout</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const isWinner = r.rank === 1;
                const longTail = r.rank > ranked.length - 3;
                const rowAccent = isWinner
                  ? "var(--color-green)"
                  : longTail
                  ? "var(--color-text-muted)"
                  : "var(--color-cyan)";
                return (
                  <tr
                    key={r.name}
                    className="border-t border-[var(--color-border)] hover:bg-white/5"
                  >
                    <td
                      className="px-3 py-2 text-right"
                      style={{ color: rowAccent }}
                    >
                      {r.rank}
                    </td>
                    <td className="truncate px-2 py-2 text-[var(--color-text)]">
                      {r.name}
                    </td>
                    <td className="px-2 py-2 text-right text-[var(--color-text-muted)]">
                      {r.distance < 1000
                        ? Math.round(r.distance).toString()
                        : Math.round(r.distance).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-right text-[var(--color-text-muted)]">
                      {r.rawScore.toFixed(5)}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-semibold"
                      style={{ color: rowAccent }}
                    >
                      +{r.payoutUsdc.toFixed(2)}{" "}
                      <span className="text-[8px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                        USDC
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-black/20 text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <tr className="border-t border-[var(--color-border)]">
                <td colSpan={4} className="px-2 py-2 text-right">
                  Treasury rake (5%)
                </td>
                <td className="px-3 py-2 text-right text-[var(--color-magenta)]">
                  {(POOL_USDC - DISTRIBUTABLE_USDC).toFixed(2)} USDC
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="px-2 py-2 text-right">
                  Paid to players
                </td>
                <td className="px-3 py-2 text-right text-[var(--color-text)]">
                  {ranked.reduce((s, r) => s + r.payoutUsdc, 0).toFixed(2)} USDC
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="px-2 py-2 text-right">
                  Rounding → protocol bucket
                </td>
                <td className="px-3 py-2 text-right text-[var(--color-text-muted)]">
                  {(
                    DISTRIBUTABLE_USDC -
                    ranked.reduce((s, r) => s + r.payoutUsdc, 0)
                  ).toFixed(2)}{" "}
                  USDC
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}

function LegendDot({
  color,
  label,
}: {
  color: "magenta" | "green" | "cyan";
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: `var(--color-${color})`,
          boxShadow: `0 0 8px var(--color-${color})`,
        }}
      />
      <span>{label}</span>
    </span>
  );
}
