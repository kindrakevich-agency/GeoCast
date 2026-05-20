"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

/**
 * Wagmi + RainbowKit config.
 *
 * Chains list is intentionally narrow: only the chains the app actually
 * uses (Base for v2 mainnet, Base Sepolia for the current testnet pool).
 * RainbowKit + TanStack Query background-poll EVERY configured chain's
 * RPC for ENS resolution, balance, and chain-ID detection regardless of
 * which chain the user is on — listing mainnet/Polygon/Optimism/Arbitrum
 * here triggered a 429 retry-storm on the free Ethereum publicnode and
 * filled the console with backoff loops.
 *
 * The server's SIWE allowlist is wider (mainnet, Polygon, etc.) so wallets
 * already connected to those chains can still sign in; wagmi just shows
 * a "wrong network" prompt that switches them to Base Sepolia before they
 * place a pin. ENS handles aren't shown in the UI anyway — the wallet
 * address is rendered as `0x7f…a3b` everywhere, so dropping mainnet from
 * here costs nothing.
 *
 * WalletConnect support: optional. Sign up at https://cloud.walletconnect.com
 * for a free projectId and set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Without
 * it the connector still loads but its analytics endpoint rejects requests
 * (harmless 400s in the console). Injected (browser-extension) wallets
 * work either way.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "GeoCast",
  // WalletConnect projectIds are PUBLIC by design — every dApp ships them
  // in their client bundle. So baking the real id in as the default fallback
  // is fine. The env var still takes precedence so future rotation is one
  // GitHub secret update away (no code change needed).
  //
  // Using || instead of ?? so an empty-string env (which can happen when
  // a CI secret is unset but the env passing pipeline still sets it to "")
  // also falls back, instead of crashing RainbowKit's getDefaultConfig with
  // "No projectId found".
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    "ffa1660488cb0559fb49febf31a368ff",
  chains: [base, baseSepolia],
  transports: {
    [base.id]:        http("https://base-rpc.publicnode.com"),
    // Base Sepolia (v2 testnet) — Coinbase's public RPC.
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
  ssr: true,
});
