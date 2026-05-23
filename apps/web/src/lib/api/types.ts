// Response types mirroring the Symfony API. Field names match the JSON
// the controllers emit exactly — keep these in sync when an endpoint
// shape changes server-side.

import type { LngLat } from "@/lib/mock";

export type RoundStatus = "scheduled" | "open" | "closed" | "resolved";

export type ApiRound = {
  id: string;
  number: number;
  question: string;
  description: string | null;
  opensAt: string;        // ISO 8601
  closesAt: string;       // ISO 8601
  resolvesAt?: string | null;
  resolvedAt?: string | null;
  /**
   * Legacy field — still present in the JSON for historical rounds but no
   * longer consumed by the frontend. The on-chain pool (queried via
   * useOnchainRound) is the canonical pool size in USDC.
   */
  poolCredits?: number;
  totalParticipants: number;
  status: RoundStatus;
  answer: LngLat | null;
  /**
   * Set on resolved rounds that had multiple winners (ties). When non-null,
   * `answer` mirrors the first entry; multi-winner rendering should iterate
   * over this list instead.
   */
  answerPoints?: Array<{ lat: number; lng: number; name: string }> | null;
  /** Auto-resolver fields — populated when a round was published from a Suggestion. */
  autoResolverCode?: string | null;
  autoResolverParams?: Record<string, unknown> | null;
};

export type ApiUser = {
  id: string;
  walletAddress: string;
  /** Legacy — server still emits it for backwards compatibility, frontend ignores. */
  creditsBalance?: number;
  gamesPlayed: number;
  totalScore: number;
  isAdmin: boolean;
  createdAt: string;
};

export type ApiNonceResponse = {
  nonce: string;
  address: string;
  expiresIn: number;
};

export type ApiVerifyResponse = {
  token: string;
  user: ApiUser;
};

export type ApiPrediction = {
  id: string;
  roundId: string;
  lat: number;
  lng: number;
  /** Legacy — server still emits it; the on-chain commit stakes 1 USDC. */
  creditsStaked?: number;
  placedAt: string;
  /** Null until the round is resolved. */
  distanceKm?: number | null;
  rank?: number | null;
  payout?: number;
};

export type ApiLeaderboardRow = {
  rank: number;
  userId: string;
  wallet: string;
  gamesPlayed: number;
  /** Legacy — server still emits it for backwards compatibility, frontend ignores. */
  totalCredits?: number;
  totalScore: number;
  isMe: boolean;
};

export type ApiLeaderboardMe = {
  userId: string;
  wallet: string;
  gamesPlayed: number;
  /** Legacy — see ApiLeaderboardRow.totalCredits. */
  totalCredits?: number;
  totalScore: number;
  rank?: number;       // present when caller is outside top 100
};

export type ApiLeaderboardResponse = {
  period: "today" | "week" | "all";
  rows: ApiLeaderboardRow[];
  me: ApiLeaderboardMe | null;
};

export type ApiStats = {
  pinsThisWeek: number;
  activeRounds: number;
  totalExplorers: number;
  lastWinner: {
    wallet: string;       // shortened (0x7f4c…a3b1)
    kmOff: number;
    payout: number;
  } | null;
};

export type ApiAdminRound = ApiRound;

export type ApiResolveResponse = {
  round: ApiRound;
  rankings: Array<{
    predictionId: string;
    userId: string;
    distanceKm: number;
    rank: number;
    payout: number;
    rawScore: number;
  }>;
};

export type ApiCareerPin = {
  lng: number;
  lat: number;
  roundNumber: number;
  /** Null for pins on rounds that haven't been resolved yet. */
  distanceKm: number | null;
};

export type ApiPredictionHistoryItem = {
  id: string;
  placedAt: string;
  myPin: LngLat;
  distanceKm: number | null;
  rank: number | null;
  payout: number;
  /** Legacy — see ApiPrediction.creditsStaked. */
  creditsStaked?: number;
  round: {
    id: string;
    number: number;
    question: string;
    status: RoundStatus;
    closesAt: string;
    resolvedAt: string | null;
    answer: LngLat | null;
    totalParticipants: number;
    /** Legacy — see ApiRound.poolCredits. */
    poolCredits?: number;
  };
};

export type ApiPredictionHistoryResponse = {
  items: ApiPredictionHistoryItem[];
  total: number;
  page: number;
  perPage: number;
};
