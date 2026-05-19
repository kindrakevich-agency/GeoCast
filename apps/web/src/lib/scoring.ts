import { distance, point } from "@turf/turf";
import type { LngLat, MockPlayer } from "./mock";

export type RankedEntry = {
  id: string;
  handle: string;
  wallet: string;
  countryHint: string;
  distanceKm: number;
  rawScore: number;
  rank: number;
  payout: number;
  isMe?: boolean;
};

export function kmBetween(a: LngLat, b: LngLat): number {
  return distance(point([a.lng, a.lat]), point([b.lng, b.lat]), { units: "kilometers" });
}

/**
 * Spec-faithful scoring (see CLAUDE.md):
 *   raw_score_i = 1 / (1 + d_i)
 *   payout_i    = floor(pool * raw_i / sum(raw_j))
 */
export function rank(
  players: { id: string; handle: string; wallet: string; countryHint: string; pinLocation: LngLat; isMe?: boolean }[],
  answer: LngLat,
  pool: number,
): RankedEntry[] {
  const withDist = players.map((p) => {
    const d = kmBetween(p.pinLocation, answer);
    return {
      id: p.id,
      handle: p.handle,
      wallet: p.wallet,
      countryHint: p.countryHint,
      distanceKm: d,
      rawScore: 1 / (1 + d),
      isMe: p.isMe,
    };
  });

  const sumRaw = withDist.reduce((acc, e) => acc + e.rawScore, 0);

  return withDist
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      payout: Math.floor((pool * e.rawScore) / sumRaw),
    }));
}

export function withUserPin(
  players: MockPlayer[],
  userPin: LngLat,
  userHandle = "you",
  userWallet = "0xYou…me",
): { id: string; handle: string; wallet: string; countryHint: string; pinLocation: LngLat; isMe?: boolean }[] {
  return [
    ...players,
    {
      id: "me",
      handle: userHandle,
      wallet: userWallet,
      countryHint: "your pin",
      pinLocation: userPin,
      isMe: true,
    },
  ];
}
