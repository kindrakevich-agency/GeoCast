"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Map, {
  AttributionControl,
  Layer,
  Marker,
  Source,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import type { LngLat, MockPlayer, MockPresence } from "@/lib/mock";
import { AnimatePresence, motion } from "framer-motion";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export type MapStageProps = {
  placed: boolean;
  myPin: LngLat | null;
  presence: MockPresence[];
  players: MockPlayer[];
  onMapClick: (coords: LngLat) => void;
  overlay?: ReactNode;
};

export function MapStage({
  placed,
  myPin,
  presence,
  players,
  onMapClick,
  overlay,
}: MapStageProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [cursor, setCursor] = useState<LngLat | null>(null);

  const heatmapData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: players.map((p) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [p.pinLocation.lng, p.pinLocation.lat],
        },
        properties: { id: p.id, intensity: 1 },
      })),
    }),
    [players],
  );

  useEffect(() => {
    if (!placed || !myPin || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [myPin.lng, myPin.lat],
      zoom: 4,
      duration: 1600,
      essential: true,
    });
  }, [placed, myPin]);

  const handleClick = (e: MapLayerMouseEvent) => {
    if (placed) return;
    onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
  };

  const handleMove = (e: MapLayerMouseEvent) => {
    if (placed) {
      if (cursor !== null) setCursor(null);
      return;
    }
    setCursor({ lng: e.lngLat.lng, lat: e.lngLat.lat });
  };

  return (
    <div
      className="absolute inset-0 z-0 h-full w-full"
      style={{ cursor: placed ? "grab" : "crosshair" }}
    >
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{
          longitude: 12,
          latitude: 24,
          zoom: 1.7,
          bearing: 0,
          pitch: 0,
        }}
        attributionControl={false}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseOut={() => setCursor(null)}
        dragRotate={false}
        touchPitch={false}
        cursor={placed ? "grab" : "crosshair"}
      >
        <AttributionControl compact position="bottom-right" />
        {placed && (
          <Source id="heatmap" type="geojson" data={heatmapData}>
            <Layer
              id="heat-glow"
              type="heatmap"
              paint={{
                "heatmap-weight": 0.7,
                "heatmap-intensity": 1.2,
                "heatmap-radius": 40,
                "heatmap-opacity": 0.85,
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0,
                  "rgba(0, 212, 255, 0)",
                  0.25,
                  "rgba(0, 212, 255, 0.35)",
                  0.5,
                  "rgba(112, 0, 255, 0.6)",
                  0.75,
                  "rgba(255, 0, 110, 0.75)",
                  1,
                  "rgba(255, 0, 110, 0.95)",
                ],
              }}
            />
          </Source>
        )}

        {placed &&
          players.map((p) => (
            <Marker
              key={p.id}
              longitude={p.pinLocation.lng}
              latitude={p.pinLocation.lat}
              anchor="center"
            >
              <span
                className="block h-1.5 w-1.5 rounded-full opacity-80"
                style={{
                  background: "rgba(255, 255, 255, 0.9)",
                  boxShadow: "0 0 8px rgba(0, 212, 255, 0.8)",
                }}
              />
            </Marker>
          ))}

        {presence.map((u) => (
          <Marker
            key={u.id}
            longitude={u.cursor.lng}
            latitude={u.cursor.lat}
            anchor="center"
          >
            <PresenceDot label={u.handle} />
          </Marker>
        ))}

        {myPin && (
          <Marker longitude={myPin.lng} latitude={myPin.lat} anchor="bottom">
            <MyPin />
          </Marker>
        )}

        {!placed && cursor && <CrosshairOverlay coords={cursor} />}
      </Map>

      {overlay}
    </div>
  );
}

function PresenceDot({ label }: { label: string }) {
  return (
    <div className="relative">
      <span
        className="absolute -inset-2 rounded-full"
        style={{ background: "rgba(0, 212, 255, 0.18)" }}
      />
      <span
        className="block h-2 w-2 rounded-full"
        style={{ background: "var(--color-cyan)", boxShadow: "0 0 10px var(--color-cyan)" }}
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black/60 px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}

function MyPin() {
  return (
    <div className="relative grid place-items-center">
      {/* Drop animation */}
      <motion.div
        initial={{ y: -120, scale: 0.5, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        className="relative"
      >
        <svg width="22" height="30" viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M11 1C5.477 1 1 5.477 1 11c0 7.5 10 18 10 18s10-10.5 10-18C21 5.477 16.523 1 11 1z"
            fill="var(--color-cyan)"
            stroke="white"
            strokeOpacity="0.7"
            strokeWidth="1.2"
          />
          <circle cx="11" cy="11" r="3.5" fill="white" />
        </svg>
        <div
          className="absolute -inset-3 -z-10 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(0, 212, 255, 0.45) 0%, rgba(0, 212, 255, 0) 70%)",
          }}
        />
      </motion.div>

      {/* Ripples */}
      <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            initial={{ scale: 0, opacity: 0.7 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 1.4, delay: 0.15 * i, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 block h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              border: "1.5px solid var(--color-cyan)",
              boxShadow: "0 0 16px rgba(0, 212, 255, 0.4)",
            }}
          />
        ))}
      </span>
    </div>
  );
}

function CrosshairOverlay({ coords }: { coords: LngLat }) {
  return (
    <AnimatePresence>
      <motion.div
        key="crosshair-hud"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="pointer-events-none absolute right-4 top-24 z-30 hidden md:block"
      >
        <div className="glass rounded-[var(--radius)] px-3 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px]">
          <span className="text-[var(--color-text-muted)]">lat</span>{" "}
          <span style={{ color: "var(--color-cyan)" }}>{coords.lat.toFixed(3)}</span>
          <span className="ml-3 text-[var(--color-text-muted)]">lng</span>{" "}
          <span style={{ color: "var(--color-cyan)" }}>{coords.lng.toFixed(3)}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
