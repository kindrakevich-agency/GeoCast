import type { LngLat } from "./mock";

export type LandingPin = LngLat & {
  /** 0–1, controls pulse animation delay phase */
  phase: number;
  /** 0–1, slight size variation */
  scale: number;
};

// 50 well-distributed locations across all 6 inhabited continents.
// Coordinates are deterministic — no Math.random() at module load so
// SSR + client renders are byte-identical (no hydration mismatch).
const RAW: Array<[number, number]> = [
  // Europe
  [-3.7, 40.4], [2.35, 48.85], [-0.13, 51.5], [13.4, 52.5], [12.5, 41.9],
  [16.37, 48.2], [4.9, 52.37], [18.07, 59.33], [37.6, 55.7], [21.0, 52.23],
  [14.43, 50.08], [24.94, 60.17], [10.75, 59.91], [-9.13, 38.72], [23.73, 37.98],
  // Asia
  [139.6, 35.6], [121.5, 31.2], [127.0, 37.57], [114.17, 22.3], [103.85, 1.35],
  [100.5, 13.75], [77.2, 28.6], [73.07, 33.68], [55.27, 25.2], [51.42, 35.69],
  [44.36, 33.31], [35.21, 31.77], [29.0, 41.0], [107.6, -6.91], [120.98, 14.6],
  // Africa
  [31.2, 30.0], [34.6, 29.95], [3.38, 6.52], [-17.45, 14.69], [28.04, -26.2],
  [18.42, -33.92], [36.82, -1.29],
  // North America
  [-74.0, 40.7], [-87.65, 41.85], [-118.24, 34.05], [-122.42, 37.77], [-79.38, 43.65],
  [-99.13, 19.43], [-123.12, 49.28],
  // South America
  [-46.63, -23.55], [-58.38, -34.61], [-77.04, -12.05], [-70.65, -33.45],
  // Oceania
  [151.2, -33.87], [174.76, -36.85],
];

// Stable deterministic phase + scale based on the index — pseudo-random but
// reproducible. Mulberry-style integer hash, all numeric ops are deterministic.
function hash01(seed: number): number {
  let x = (seed * 1664525 + 1013904223) | 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return (x % 10000) / 10000;
}

export const landingPins: LandingPin[] = RAW.map(([lng, lat], i) => ({
  lng,
  lat,
  phase: hash01(i + 1),
  scale: 0.8 + hash01(i * 7 + 13) * 0.5, // 0.8–1.3
}));

// Anonymised "last winner" + weekly stats for the footer strip.
export const landingStats = {
  pinsThisWeek: 1247,
  lastWinner: {
    wallet: "0x7f4c…a3b1",
    kmOff: 8.3,
    payout: 47,
  },
  activeRounds: 1,
  totalPlayers: 3812,
};
