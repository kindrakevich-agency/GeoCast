"use client";

import { useMemo } from "react";
import Map, { Layer, Marker, Source } from "react-map-gl/maplibre";
import type { CareerPin } from "@/lib/profile-mock";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export function CareerHeatmap({ pins }: { pins: CareerPin[] }) {
  const data = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: pins.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: { intensity: 1 / (1 + p.distanceKm / 200) },
      })),
    }),
    [pins],
  );

  // Best pin (smallest distance) gets a magenta crown
  const best = useMemo(
    () => pins.reduce((acc, p) => (p.distanceKm < acc.distanceKm ? p : acc), pins[0]),
    [pins],
  );

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <Map
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: 15, latitude: 25, zoom: 1.2, bearing: 0, pitch: 0 }}
        attributionControl={false}
        interactive={false}
        dragPan={false}
        scrollZoom={false}
        doubleClickZoom={false}
        keyboard={false}
        touchZoomRotate={false}
      >
        <Source id="career" type="geojson" data={data}>
          <Layer
            id="career-heat"
            type="heatmap"
            paint={{
              "heatmap-weight": ["get", "intensity"],
              "heatmap-intensity": 1,
              "heatmap-radius": 28,
              "heatmap-opacity": 0.8,
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0, "rgba(0, 212, 255, 0)",
                0.3, "rgba(0, 212, 255, 0.45)",
                0.6, "rgba(0, 255, 136, 0.6)",
                1, "rgba(255, 184, 0, 0.85)",
              ],
            }}
          />
        </Source>

        {pins.map((p, i) => (
          <Marker key={i} longitude={p.lng} latitude={p.lat} anchor="center">
            <span
              className="block h-1 w-1 rounded-full opacity-80"
              style={{
                background: "rgba(255, 255, 255, 0.9)",
                boxShadow: "0 0 6px rgba(0, 212, 255, 0.7)",
              }}
            />
          </Marker>
        ))}

        <Marker longitude={best.lng} latitude={best.lat} anchor="center">
          <span className="relative grid place-items-center">
            <span
              className="absolute h-5 w-5 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(255, 0, 110, 0.6) 0%, rgba(255, 0, 110, 0) 70%)",
              }}
            />
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--color-magenta)", boxShadow: "0 0 12px var(--color-magenta)" }}
            />
          </span>
        </Marker>
      </Map>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(10, 14, 26, 0) 30%, rgba(10, 14, 26, 0.4) 100%)",
        }}
      />

      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] backdrop-blur-md">
        Career heatmap · {pins.length} pins
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/40 px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)] backdrop-blur-md">
        <span style={{ color: "var(--color-magenta)" }}>●</span> best:{" "}
        <span style={{ color: "var(--color-text)" }}>{best.distanceKm.toFixed(1)} km</span>
      </div>
    </div>
  );
}
