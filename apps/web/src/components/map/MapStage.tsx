"use client";

import { greatCircle, point } from "@turf/turf";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type GreatCircleFeature = ReturnType<typeof greatCircle>;
import Map, {
  AttributionControl,
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type { LngLat, MockPlayer, MockPresence } from "@/lib/mock";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export type MapStageProps = {
  placed: boolean;
  resolved: boolean;
  myPin: LngLat | null;
  answer: LngLat | null;
  presence: MockPresence[];
  players: MockPlayer[];
  onMapClick: (coords: LngLat) => void;
  /** Fires on every mousemove over the map with the cursor lng/lat. Used to
   *  feed the presence-cursor broadcaster — kept as a prop so MapStage owns
   *  the maplibre event and the page owns the throttled outbound channel. */
  onCursorMove?: (coords: LngLat | null) => void;
  overlay?: ReactNode;
};

export function MapStage({
  placed,
  resolved,
  myPin,
  answer,
  presence,
  players,
  onMapClick,
  onCursorMove,
  overlay,
}: MapStageProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [cursor, setCursor] = useState<LngLat | null>(null);
  const [lineProgress, setLineProgress] = useState(0);

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

  // Great-circle line from user pin → answer
  const lineFeature = useMemo<GreatCircleFeature | null>(() => {
    if (!myPin || !answer) return null;
    return greatCircle(point([myPin.lng, myPin.lat]), point([answer.lng, answer.lat]), {
      npoints: 64,
    });
  }, [myPin, answer]);

  // Progressive line reveal (slice the LineString as progress grows 0→1)
  const revealedLine = useMemo<GreatCircleFeature | null>(() => {
    if (!lineFeature || lineFeature.geometry.type !== "LineString") return null;
    const coords = lineFeature.geometry.coordinates;
    const slice = Math.max(2, Math.floor(coords.length * lineProgress));
    return {
      ...lineFeature,
      geometry: {
        type: "LineString",
        coordinates: coords.slice(0, slice),
      },
    };
  }, [lineFeature, lineProgress]);

  // After pin placed: zoom in on user pin.
  useEffect(() => {
    if (!placed || resolved || !myPin || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [myPin.lng, myPin.lat],
      zoom: 4,
      duration: 1600,
      essential: true,
    });
  }, [placed, resolved, myPin]);

  // On resolution: fit bounds to encompass user pin + answer, then animate the line.
  useEffect(() => {
    if (!resolved || !myPin || !answer || !mapRef.current) return;
    const map = mapRef.current.getMap();
    const pad = 140;

    // Dramatic flyTo to the answer first
    map.flyTo({
      center: [answer.lng, answer.lat],
      zoom: 5,
      duration: 1800,
      essential: true,
    });

    // After camera, fit both
    const fitT = window.setTimeout(() => {
      map.fitBounds(
        [
          [Math.min(myPin.lng, answer.lng), Math.min(myPin.lat, answer.lat)],
          [Math.max(myPin.lng, answer.lng), Math.max(myPin.lat, answer.lat)],
        ],
        { padding: pad, duration: 1400 },
      );
    }, 1900);

    // Animate line draw-in (0 → 1 across 1400ms, starting after fitBounds begins)
    const lineDelay = window.setTimeout(() => {
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / 1400);
        setLineProgress(t);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 2400);

    return () => {
      window.clearTimeout(fitT);
      window.clearTimeout(lineDelay);
    };
  }, [resolved, myPin, answer]);

  const handleClick = (e: MapLayerMouseEvent) => {
    if (placed) return;
    onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
  };

  const handleMove = (e: MapLayerMouseEvent) => {
    if (placed) {
      if (cursor !== null) setCursor(null);
      onCursorMove?.(null);
      return;
    }
    const c = { lng: e.lngLat.lng, lat: e.lngLat.lat };
    setCursor(c);
    onCursorMove?.(c);
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
        onMouseOut={() => {
          setCursor(null);
          onCursorMove?.(null);
        }}
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
                "heatmap-opacity": resolved ? 0.35 : 0.85,
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

        {/* Great-circle distance line */}
        {revealedLine && (
          <Source id="distance-line" type="geojson" data={revealedLine}>
            <Layer
              id="distance-line-glow"
              type="line"
              paint={{
                "line-color": "#ff006e",
                "line-width": 5,
                "line-opacity": 0.35,
                "line-blur": 6,
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            <Layer
              id="distance-line-core"
              type="line"
              paint={{
                "line-color": "#ff5cae",
                "line-width": 1.5,
                "line-opacity": 0.95,
                "line-dasharray": [2, 2],
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
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

        {!resolved &&
          presence.map((u) => (
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

        {resolved && answer && (
          <Marker longitude={answer.lng} latitude={answer.lat} anchor="bottom">
            <AnswerPin />
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
    <div className="group relative">
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

function AnswerPin() {
  return (
    <div className="relative grid place-items-center">
      <motion.div
        initial={{ y: -240, scale: 0.4, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.1 }}
        className="relative"
      >
        <svg width="30" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M15 1.5C7.544 1.5 1.5 7.544 1.5 15c0 10.5 13.5 25.5 13.5 25.5s13.5-15 13.5-25.5C28.5 7.544 22.456 1.5 15 1.5z"
            fill="var(--color-magenta)"
            stroke="white"
            strokeOpacity="0.85"
            strokeWidth="1.5"
          />
          <circle cx="15" cy="15" r="5" fill="white" />
          <circle cx="15" cy="15" r="2.4" fill="var(--color-magenta)" />
        </svg>
        <div
          className="absolute -inset-5 -z-10 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255, 0, 110, 0.55) 0%, rgba(255, 0, 110, 0) 70%)",
          }}
        />
      </motion.div>

      <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            initial={{ scale: 0, opacity: 0.75 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 1.6, delay: 0.18 + 0.18 * i, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 block h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              border: "1.5px solid var(--color-magenta)",
              boxShadow: "0 0 20px rgba(255, 0, 110, 0.5)",
            }}
          />
        ))}
      </span>

      <motion.span
        initial={{ scale: 1, opacity: 0 }}
        animate={{ scale: 1.2, opacity: 0.6 }}
        transition={{ duration: 1.8, repeat: Infinity, repeatType: "reverse", delay: 1 }}
        className="pointer-events-absolute pointer-events-none absolute -bottom-1 left-1/2 h-2 w-8 -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse, rgba(255, 0, 110, 0.6) 0%, rgba(255, 0, 110, 0) 70%)",
        }}
      />
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
