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
  resolvedAt?: string | null;
  poolCredits: number;
  totalParticipants: number;
  status: RoundStatus;
  answer: LngLat | null;
};

export type ApiUser = {
  id: string;
  walletAddress: string;
  creditsBalance: number;
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
  creditsStaked: number;
  placedAt: string;
};

export type ApiPlacePredictionResponse = {
  prediction: ApiPrediction;
  balance: number;
  pool: number;
  participants: number;
};

export type ApiLeaderboardRow = {
  rank: number;
  userId: string;
  wallet: string;
  gamesPlayed: number;
  totalCredits: number;
  totalScore: number;
  isMe: boolean;
};

export type ApiLeaderboardMe = {
  userId: string;
  wallet: string;
  gamesPlayed: number;
  totalCredits: number;
  totalScore: number;
  rank?: number;       // present when caller is outside top 100
};

export type ApiLeaderboardResponse = {
  period: "today" | "week" | "all";
  rows: ApiLeaderboardRow[];
  me: ApiLeaderboardMe | null;
};
