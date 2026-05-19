"use client";

import { useEffect, useRef } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import { landingPins } from "@/lib/landing-pins";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/**
 * Non-interactive ambient world map used as the landing-page backdrop.
 * Slow camera drift gives it life without distracting from the foreground card.
 */
export function AmbientMap() {
  const mapRef = useRef<MapRef | null>(null);

  // Gentle continuous drift — east, slow, looping. Pure visual ambience.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const c = map.getCenter();
      map.setCenter([c.lng + dt * 1.2, c.lat]); // 1.2°/s eastward
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 h-full w-full">
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: 10, latitude: 20, zoom: 1.4, bearing: 0, pitch: 0 }}
        attributionControl={false}
        interactive={false}
        dragPan={false}
        dragRotate={false}
        scrollZoom={false}
        doubleClickZoom={false}
        keyboard={false}
        touchZoomRotate={false}
        touchPitch={false}
      >
        {landingPins.map((p, i) => (
          <Marker key={i} longitude={p.lng} latitude={p.lat} anchor="center">
            <AmbientPin phase={p.phase} scale={p.scale} />
          </Marker>
        ))}
      </Map>

      {/* Vignette + base tint to keep the card readable above the busy map */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(10, 14, 26, 0.55) 0%, rgba(10, 14, 26, 0.85) 80%)",
        }}
      />
    </div>
  );
}

function AmbientPin({ phase, scale }: { phase: number; scale: number }) {
  // phase 0–1 → negative animation-delay so each pin enters its loop at a
  // different point. (Negative delay skips into the animation immediately.)
  const delay = `-${(phase * 3.6).toFixed(2)}s`;

  return (
    <div
      className="relative"
      style={{ transform: `scale(${scale.toFixed(3)})` }}
    >
      <span
        className="pin-pulse-ring absolute left-1/2 top-1/2 block h-6 w-6 rounded-full"
        style={{
          border: "1.5px solid var(--color-cyan)",
          boxShadow: "0 0 14px rgba(0, 212, 255, 0.55)",
          animationDelay: delay,
        }}
      />
      <span
        className="pin-pulse-core relative block h-1.5 w-1.5 rounded-full"
        style={{
          background: "var(--color-cyan)",
          boxShadow: "0 0 8px rgba(0, 212, 255, 0.95)",
          animationDelay: delay,
        }}
      />
    </div>
  );
}
