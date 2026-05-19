export type LngLat = { lng: number; lat: number };

export type MockPlayer = {
  id: string;
  handle: string;
  wallet: string;
  pinLocation: LngLat;
  countryHint: string;
};

export type MockPresence = {
  id: string;
  handle: string;
  cursor: LngLat;
};

export type MockRound = {
  id: string;
  question: string;
  description: string;
  opensAt: string;
  closesAt: string;
  poolCredits: number;
  totalParticipants: number;
  status: "open" | "closed" | "resolved";
  answer?: LngLat;
};

const isoIn = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

export const demoRound: MockRound = {
  id: "demo",
  question: "Where will today's largest wildfire start?",
  description:
    "Largest wildfire by area burned in the next 24 hours, per NASA FIRMS daily summary.",
  opensAt: isoIn(-60 * 6),
  closesAt: isoIn(107),
  poolCredits: 247,
  totalParticipants: 247,
  status: "open",
};

const PIN_SEED: Array<Omit<MockPlayer, "id">> = [
  { handle: "Reyes", wallet: "0x7f4c…a3b1", pinLocation: { lng: -3.7, lat: 40.4 }, countryHint: "Madrid" },
  { handle: "Akira", wallet: "0xe2a1…d018", pinLocation: { lng: 139.6, lat: 35.6 }, countryHint: "Tokyo" },
  { handle: "Marisol", wallet: "0xc011…ff8e", pinLocation: { lng: -46.6, lat: -23.5 }, countryHint: "São Paulo" },
  { handle: "Sasha", wallet: "0x9bcd…7401", pinLocation: { lng: 37.6, lat: 55.7 }, countryHint: "Moscow" },
  { handle: "Lex", wallet: "0xb7e3…4a92", pinLocation: { lng: -73.9, lat: 40.7 }, countryHint: "NYC" },
  { handle: "Yara", wallet: "0x5fa1…b03d", pinLocation: { lng: 31.2, lat: 30.0 }, countryHint: "Cairo" },
  { handle: "Onur", wallet: "0x2d11…cc04", pinLocation: { lng: 29.0, lat: 41.0 }, countryHint: "Istanbul" },
  { handle: "Priya", wallet: "0xa14d…0b71", pinLocation: { lng: 77.2, lat: 28.6 }, countryHint: "Delhi" },
  { handle: "Noa", wallet: "0xf093…1ce8", pinLocation: { lng: 34.7, lat: 32.1 }, countryHint: "Tel Aviv" },
  { handle: "Mio", wallet: "0x4488…aaa1", pinLocation: { lng: 121.5, lat: 31.2 }, countryHint: "Shanghai" },
  { handle: "Zane", wallet: "0x1f72…d2c0", pinLocation: { lng: -118.2, lat: 34.1 }, countryHint: "LA" },
  { handle: "Indira", wallet: "0x88a0…5e44", pinLocation: { lng: 106.8, lat: -6.2 }, countryHint: "Jakarta" },
  { handle: "Bilal", wallet: "0xddca…b9f7", pinLocation: { lng: 67.0, lat: 24.9 }, countryHint: "Karachi" },
  { handle: "Owen", wallet: "0x3211…9090", pinLocation: { lng: -0.13, lat: 51.5 }, countryHint: "London" },
  { handle: "Pelin", wallet: "0xcaab…20de", pinLocation: { lng: 13.4, lat: 52.5 }, countryHint: "Berlin" },
  { handle: "Aiyana", wallet: "0x77bb…1131", pinLocation: { lng: -99.1, lat: 19.4 }, countryHint: "CDMX" },
  { handle: "Sasha2", wallet: "0xab21…ffe0", pinLocation: { lng: 18.0, lat: 59.3 }, countryHint: "Stockholm" },
  { handle: "Romi", wallet: "0xfc00…0211", pinLocation: { lng: 151.2, lat: -33.9 }, countryHint: "Sydney" },
  { handle: "Tia", wallet: "0x4bbd…0ab1", pinLocation: { lng: 28.0, lat: -26.2 }, countryHint: "Johannesburg" },
  { handle: "Kalle", wallet: "0x9d23…aa10", pinLocation: { lng: 12.5, lat: 41.9 }, countryHint: "Rome" },
];

export const demoPlayers: MockPlayer[] = PIN_SEED.map((p, i) => ({
  ...p,
  id: `pl_${i}`,
}));

export const demoPresence: MockPresence[] = [
  { id: "u1", handle: "Reyes",   cursor: { lng: -3.6, lat: 40.5 } },
  { id: "u2", handle: "Akira",   cursor: { lng: 139.5, lat: 35.5 } },
  { id: "u3", handle: "Marisol", cursor: { lng: -45.9, lat: -23.0 } },
  { id: "u4", handle: "Sasha",   cursor: { lng: 38.2, lat: 55.9 } },
  { id: "u5", handle: "Owen",    cursor: { lng: 0.05, lat: 51.4 } },
];

export const shortWallet = (w: string) =>
  w.length > 10 ? `${w.slice(0, 6)}…${w.slice(-4)}` : w;
