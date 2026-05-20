// On-chain configuration. Reads at build time from NEXT_PUBLIC_* env vars.
//
// When GEOCAST_POOL_ADDRESS is empty/zero, `isOnchainEnabled()` returns
// false and the round page silently keeps the existing credit-based flow.
// This lets v2 ship safely before the contract is deployed.

import type { Address } from "viem";
import { base, baseSepolia } from "viem/chains";

export const BASE_USDC_MAINNET: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// Base Sepolia USDC — our deployed MockUSDC (matches what GeoCastPool's
// `usdc()` returns on the live contract). NOT Circle's native testnet USDC
// (0x036CbD…F7e) — that one looks attractive but requires minter
// authorization, so the in-app "mint test USDC" button would revert.
// MockUSDC has a public `mint(to, amount)` anyone can call.
export const BASE_USDC_SEPOLIA: Address = "0x9ce0617d43b9222f06056ea613e0cc9bc11d3b2d";

export type OnchainConfig = {
  chainId: number;
  poolAddress: Address;
  usdcAddress: Address;
  betMicros: bigint;     // 1e6 = 1 USDC
  rakeBps: number;       // 500 = 5%
};

const rawChainId = process.env.NEXT_PUBLIC_GEOCAST_CHAIN_ID;
const rawPool = process.env.NEXT_PUBLIC_GEOCAST_POOL_ADDRESS;
const rawUsdc = process.env.NEXT_PUBLIC_GEOCAST_USDC_ADDRESS;

const ZERO_ADDR: Address = "0x0000000000000000000000000000000000000000";

function inferUsdc(chainId: number): Address {
  if (chainId === base.id) return BASE_USDC_MAINNET;
  if (chainId === baseSepolia.id) return BASE_USDC_SEPOLIA;
  return ZERO_ADDR;
}

export function getOnchainConfig(): OnchainConfig {
  const chainId = rawChainId ? Number(rawChainId) : baseSepolia.id;
  const poolAddress = (rawPool && /^0x[0-9a-fA-F]{40}$/.test(rawPool) ? rawPool : ZERO_ADDR) as Address;
  const usdcAddress = (rawUsdc && /^0x[0-9a-fA-F]{40}$/.test(rawUsdc) ? rawUsdc : inferUsdc(chainId)) as Address;
  return {
    chainId,
    poolAddress,
    usdcAddress,
    betMicros: 1_000_000n,
    rakeBps: 500,
  };
}

export function isOnchainEnabled(): boolean {
  const c = getOnchainConfig();
  return c.poolAddress !== ZERO_ADDR && c.usdcAddress !== ZERO_ADDR;
}
