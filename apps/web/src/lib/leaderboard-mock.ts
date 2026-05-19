import type { LngLat } from "./mock";

export type LeaderboardPeriod = "today" | "week" | "all";

export type LeaderboardRow = {
  rank: number;
  wallet: string;
  handle: string;
  country: string;
  gamesPlayed: number;
  avgDistanceKm: number;
  totalCredits: number;
  totalScore: number;
  isMe?: boolean;
  // Last 5 pin locations for the hover overlay
  recentPins: LngLat[];
};

// Deterministic seeded RNG (mulberry32) so SSR + client produce identical data
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HANDLES = [
  "Reyes", "Akira", "Marisol", "Sasha", "Lex", "Yara", "Onur", "Priya", "Noa",
  "Mio", "Zane", "Indira", "Bilal", "Owen", "Pelin", "Aiyana", "Romi", "Tia",
  "Kalle", "Saber", "Iva", "Tomás", "Ámbar", "Mei", "Joon", "Anya", "Helmi",
  "Tariq", "Liang", "Eitan", "Hana", "Mateo", "Yusra", "Petar", "Sigrid",
  "Cyrus", "Imani", "Tova", "Rashid", "Linnea", "Dario", "Aiko", "Nour",
  "Solène", "Vukan", "Esra", "Beni", "Kasia",
];

const COUNTRIES = [
  "Madrid", "Tokyo", "São Paulo", "Moscow", "NYC", "Cairo", "Istanbul", "Delhi",
  "Tel Aviv", "Shanghai", "LA", "Jakarta", "Karachi", "London", "Berlin", "CDMX",
  "Sydney", "Joburg", "Rome", "Stockholm", "Riyadh", "Lisbon", "Buenos Aires",
  "Singapore", "Seoul", "Warsaw", "Helsinki", "Dubai", "HK", "Lima", "Oslo",
  "Sofia", "Beirut", "Doha", "Hanoi", "Athens", "Belgrade",
];

// Spread of LngLats roughly matching the country list — pick by index modulo
const ANCHORS: LngLat[] = [
  { lng: -3.7, lat: 40.4 },     // Madrid
  { lng: 139.6, lat: 35.6 },    // Tokyo
  { lng: -46.6, lat: -23.5 },   // São Paulo
  { lng: 37.6, lat: 55.7 },     // Moscow
  { lng: -74.0, lat: 40.7 },    // NYC
  { lng: 31.2, lat: 30.0 },     // Cairo
  { lng: 29.0, lat: 41.0 },     // Istanbul
  { lng: 77.2, lat: 28.6 },     // Delhi
  { lng: 34.7, lat: 32.1 },     // Tel Aviv
  { lng: 121.5, lat: 31.2 },    // Shanghai
  { lng: -118.2, lat: 34.1 },   // LA
  { lng: 106.8, lat: -6.2 },    // Jakarta
  { lng: 67.0, lat: 24.9 },     // Karachi
  { lng: -0.13, lat: 51.5 },    // London
  { lng: 13.4, lat: 52.5 },     // Berlin
  { lng: -99.1, lat: 19.4 },    // CDMX
  { lng: 151.2, lat: -33.9 },   // Sydney
  { lng: 28.0, lat: -26.2 },    // Joburg
  { lng: 12.5, lat: 41.9 },     // Rome
  { lng: 18.0, lat: 59.3 },     // Stockholm
];

function buildRows(seed: number, count: number, myRank: number): LeaderboardRow[] {
  const rng = mulberry32(seed);

  const rows: LeaderboardRow[] = [];
  for (let i = 0; i < count; i++) {
    const rank = i + 1;
    const baseDistance = Math.pow(rank, 0.85) * 8 + rng() * 40;
    const anchor = ANCHORS[i % ANCHORS.length];

    // 5 recent pins clustered around the anchor with a bit of scatter
    const recentPins: LngLat[] = [];
    for (let k = 0; k < 5; k++) {
      recentPins.push({
        lng: anchor.lng + (rng() - 0.5) * 25,
        lat: anchor.lat + (rng() - 0.5) * 15,
      });
    }

    const handle = HANDLES[(i * 7 + 3) % HANDLES.length];
    const country = COUNTRIES[(i * 11 + 5) % COUNTRIES.length];
    const walletHex = (i * 1664525 + 0xc3def8a1).toString(16).padStart(40, "0");
    const wallet = `0x${walletHex.slice(0, 6)}…${walletHex.slice(-4)}`;

    rows.push({
      rank,
      wallet,
      handle: rank === myRank ? "you" : handle,
      country,
      gamesPlayed: Math.round(8 + rng() * 120),
      avgDistanceKm: baseDistance,
      totalCredits: Math.round((1000 / rank) * (1 + rng() * 0.6)),
      totalScore: 200 / Math.pow(rank, 0.6) + rng() * 4,
      isMe: rank === myRank,
      recentPins,
    });
  }
  return rows;
}

export const leaderboardData: Record<LeaderboardPeriod, LeaderboardRow[]> = {
  today: buildRows(42, 100, 14),
  week:  buildRows(73, 100, 22),
  all:   buildRows(108, 100, 47),
};
