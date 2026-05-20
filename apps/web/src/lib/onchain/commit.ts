// Commit-hash helpers that match the on-chain
// `keccak256(abi.encodePacked(player, lat, lng, salt))` exactly.
//
// Coordinates are int32 fixed-point (degrees × 1e6), so we serialise them
// as 4-byte signed big-endian to match Solidity's `abi.encodePacked(int32)`.

import { keccak256, encodePacked, type Address, type Hex } from "viem";

export type CommitInput = {
  player: Address;
  /** Degrees, e.g. 38.72. Will be scaled to int32. */
  lat: number;
  /** Degrees, e.g. -9.14. */
  lng: number;
  /** 32-byte hex string (0x-prefixed, 64 hex chars). */
  salt: Hex;
};

export const COORD_SCALE = 1_000_000;

export function toScaledInt32(deg: number): number {
  const scaled = Math.round(deg * COORD_SCALE);
  if (scaled < -2_147_483_648 || scaled > 2_147_483_647) {
    throw new RangeError(`Coord ${deg} out of int32 range after scaling`);
  }
  return scaled;
}

/** Generate a cryptographically-random 32-byte salt. Stored in localStorage
 *  alongside the coords so reveal can recover it.  */
export function makeSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")) as Hex;
}

export function computeCommit(input: CommitInput): Hex {
  const lat = toScaledInt32(input.lat);
  const lng = toScaledInt32(input.lng);
  return keccak256(
    encodePacked(
      ["address", "int32", "int32", "bytes32"],
      [input.player, lat, lng, input.salt],
    ),
  );
}

// ---------- Salt + coords persistence ----------
//
// The salt + coords are needed at reveal time. We stash them per-round in
// localStorage so users who close the tab can still reveal later. Key shape:
//
//   geocast.commit.<chainId>.<roundId>
//
// Value: { lat, lng, salt, commit, txHash, createdAt }

export type StashedCommit = {
  lat: number;
  lng: number;
  salt: Hex;
  commit: Hex;
  txHash?: Hex;
  createdAt: number;
};

export function commitStorageKey(chainId: number, roundId: number): string {
  return `geocast.commit.${chainId}.${roundId}`;
}

export function stashCommit(chainId: number, roundId: number, payload: StashedCommit): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(commitStorageKey(chainId, roundId), JSON.stringify(payload));
}

export function loadStashedCommit(chainId: number, roundId: number): StashedCommit | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(commitStorageKey(chainId, roundId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StashedCommit;
  } catch {
    return null;
  }
}

export function clearStashedCommit(chainId: number, roundId: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(commitStorageKey(chainId, roundId));
}
