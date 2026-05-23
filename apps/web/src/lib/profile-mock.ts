import type { LngLat } from "./mock";

export type CareerStats = {
  wallet: string;
  handle: string;
  joinedRound: number;
  gamesPlayed: number;
  avgDistanceKm: number;
  bestDistanceKm: number;
  bestRank: number;
  allTimeRank: number;
  totalScore: number;
  pinsPerWeek: number;
};

export type CareerPin = LngLat & { roundNumber: number; distanceKm: number | null };

export type PastRound = {
  number: number;
  question: string;
  date: string;          // YYYY-MM-DD
  /** Mirrors the API's round.status: "open" | "closed" | "resolved" | "scheduled".
   *  Drives the timeline card's status pill (open vs closed-awaiting-reveal). */
  status?: "open" | "closed" | "resolved" | "scheduled";
  myPin: LngLat;
  totalPlayers: number;
  /** Null on rounds that haven't been resolved yet — caller renders an
   *  "in progress" pill instead of distance / rank / earned. */
  answerLabel: string | null;
  answer: LngLat | null;
  distanceKm: number | null;
  rank: number | null;
  payout: number;
};

export const myStats: CareerStats = {
  wallet: "0x7f4c2b8e9a3d1f6c0b2e1a4d5c6b7a8e9f0a3b1",
  handle: "you",
  joinedRound: 412,
  gamesPlayed: 28,
  avgDistanceKm: 487.3,
  bestDistanceKm: 12.4,
  bestRank: 2,
  allTimeRank: 47,
  totalScore: 142.86,
  pinsPerWeek: 5.4,
};

// 30 career pin locations — spread across continents to make the
// career-heatmap thumbnail feel like a lived-in history.
const CAREER_COORDS: Array<[number, number, number, number]> = [
  // [lng, lat, roundNumber, distanceKm]
  [-3.7, 40.4,   412, 824],
  [12.5, 41.9,   414, 412],
  [2.35, 48.85,  416, 198],
  [-9.13, 38.72, 418, 12.4],   // best — Lisbon, near actual answer
  [139.6, 35.6,  419, 1402],
  [121.5, 31.2,  421, 678],
  [-46.6, -23.5, 423, 304],
  [-74.0, 40.7,  425, 1856],
  [37.6, 55.7,   427, 491],
  [29.0, 41.0,   429, 233],
  [31.2, 30.0,   431, 142],
  [55.27, 25.2,  434, 1042],
  [77.2, 28.6,   436, 614],
  [103.85, 1.35, 438, 2103],
  [151.2, -33.87, 440, 988],
  [-99.13, 19.43, 442, 1721],
  [18.07, 59.33, 444, 308],
  [13.4, 52.5,   446, 252],
  [-3.7, 51.5,   448, 67],
  [16.37, 48.2,  450, 421],
  [21.0, 52.23,  452, 198],
  [10.75, 59.91, 454, 502],
  [120.98, 14.6, 456, 1604],
  [4.9, 52.37,   458, 89],
  [34.6, 29.95,  460, 488],
  [114.17, 22.3, 462, 1198],
  [-118.24, 34.05, 464, 1932],
  [-77.04, -12.05, 466, 845],
  [173.76, -41.0, 478, 1054],
  [-9.0, 38.5,   482, 71],     // current — Lisbon-ish, close
];

export const careerPins: CareerPin[] = CAREER_COORDS.map(
  ([lng, lat, roundNumber, distanceKm]) => ({ lng, lat, roundNumber, distanceKm }),
);

export const recentRounds: PastRound[] = [
  {
    number: 481,
    question: "Where will the highest barometric pressure spike appear in the next 24 hours?",
    date: "2026-05-18",
    answerLabel: "Reykjavík, IS",
    myPin: { lng: 10.75, lat: 59.91 },
    answer: { lng: -21.94, lat: 64.13 },
    distanceKm: 1820,
    rank: 71,
    totalPlayers: 312,
    payout: 1,
  },
  {
    number: 480,
    question: "Where will a magnitude 4+ aftershock occur in the next 24 hours?",
    date: "2026-05-17",
    answerLabel: "Catania, IT",
    myPin: { lng: 14.27, lat: 38.10 },
    answer: { lng: 15.08, lat: 37.50 },
    distanceKm: 99,
    rank: 7,
    totalPlayers: 287,
    payout: 18,
  },
  {
    number: 478,
    question: "Where will the largest snowstorm hit in the next 24 hours?",
    date: "2026-05-15",
    answerLabel: "Christchurch, NZ",
    myPin: { lng: 173.76, lat: -41.0 },
    answer: { lng: 172.64, lat: -43.53 },
    distanceKm: 290,
    rank: 14,
    totalPlayers: 264,
    payout: 9,
  },
  {
    number: 476,
    question: "Where will the next major volcanic tremor be detected in the next 24 hours?",
    date: "2026-05-13",
    answerLabel: "Bárðarbunga, IS",
    myPin: { lng: -18.5, lat: 65.0 },
    answer: { lng: -17.53, lat: 64.64 },
    distanceKm: 70,
    rank: 4,
    totalPlayers: 301,
    payout: 26,
  },
  {
    number: 472,
    question: "Where will the densest aurora be visible in the next 24 hours?",
    date: "2026-05-09",
    answerLabel: "Tromsø, NO",
    myPin: { lng: 18.95, lat: 69.65 },
    answer: { lng: 19.0, lat: 69.65 },
    distanceKm: 2.1,
    rank: 2,
    totalPlayers: 318,
    payout: 84,
  },
  {
    number: 470,
    question: "Where will the strongest solar panel output be recorded in the next 24 hours?",
    date: "2026-05-07",
    answerLabel: "Atacama, CL",
    myPin: { lng: -69.5, lat: -22.0 },
    answer: { lng: -68.16, lat: -23.65 },
    distanceKm: 220,
    rank: 12,
    totalPlayers: 273,
    payout: 11,
  },
  {
    number: 468,
    question: "Where will the hottest European capital be in the next 24 hours?",
    date: "2026-05-05",
    answerLabel: "Athens, GR",
    myPin: { lng: 25.1, lat: 38.5 },
    answer: { lng: 23.73, lat: 37.98 },
    distanceKm: 135,
    rank: 19,
    totalPlayers: 299,
    payout: 7,
  },
  {
    number: 465,
    question: "Where will the next M5+ earthquake strike in the next 24 hours?",
    date: "2026-05-02",
    answerLabel: "Antofagasta, CL",
    myPin: { lng: -70.6, lat: -33.45 },
    answer: { lng: -70.4, lat: -23.65 },
    distanceKm: 1092,
    rank: 124,
    totalPlayers: 304,
    payout: 0,
  },
];
