"use client";

import { useEffect, useMemo, useRef } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import type { LngLat } from "@/lib/mock";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/**
 * Map backdrop for the leaderboard page. When a row is hovered, that
 * player's recent pins flyTo into focus and render as ghost markers.
 */
export function LeaderboardMap({ hoverPins }: { hoverPins: LngLat[] | null }) {
  const mapRef = useRef<MapRef | null>(null);

  const center: LngLat = useMemo(() => {
    if (!hoverPins || hoverPins.length === 0) return { lng: 10, lat: 25 };
    const lng = hoverPins.reduce((acc, p) => acc + p.lng, 0) / hoverPins.length;
    const lat = hoverPins.reduce((acc, p) => acc + p.lat, 0) / hoverPins.length;
    return { lng, lat };
  }, [hoverPins]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (hoverPins && hoverPins.length > 0) {
      map.flyTo({ center: [center.lng, center.lat], zoom: 2.6, duration: 700, essential: true });
    } else {
      map.flyTo({ center: [10, 25], zoom: 1.6, duration: 700, essential: true });
    }
  }, [hoverPins, center]);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 h-full w-full">
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{ longitude: 10, latitude: 25, zoom: 1.6, bearing: 0, pitch: 0 }}
        attributionControl={false}
        interactive={false}
        dragPan={false}
        scrollZoom={false}
        doubleClickZoom={false}
        keyboard={false}
        touchZoomRotate={false}
      >
        {hoverPins?.map((p, i) => (
          <Marker key={i} longitude={p.lng} latitude={p.lat} anchor="center">
            <span className="relative grid place-items-center">
              <span
                className="absolute h-7 w-7 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(0, 212, 255, 0.45) 0%, rgba(0, 212, 255, 0) 70%)",
                }}
              />
              <span
                className="block h-2 w-2 rounded-full"
                style={{ background: "var(--color-cyan)", boxShadow: "0 0 12px var(--color-cyan)" }}
              />
            </span>
          </Marker>
        ))}
      </Map>

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at right center, rgba(10, 14, 26, 0.2) 0%, rgba(10, 14, 26, 0.7) 70%)",
        }}
      />
    </div>
  );
}
