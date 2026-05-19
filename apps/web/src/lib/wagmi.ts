"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";

/**
 * Wagmi + RainbowKit config.
 *
 * Chains list mirrors SIWE_ALLOWED_CHAIN_IDS on the server (1, 8453, 137,
 * 10, 42161). Adding a chain here AND on the server lets users sign in
 * from that network.
 *
 * WalletConnect support: optional. Sign up at https://cloud.walletconnect.com
 * for a free projectId and set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID. Without
 * it the connector still loads but its analytics endpoint rejects requests
 * (harmless 400s in the console). Injected (browser-extension) wallets
 * work either way.
 *
 * RPC transports: the wagmi default for mainnet (eth.merkle.io) is heavily
 * rate-limited AND has no CORS headers — browser calls fail with 429 + CORS
 * errors. We pin every chain to publicnode.com endpoints which are free,
 * keyless, and CORS-friendly.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "GeoCast",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "geocast-dev",
  chains: [mainnet, base, polygon, optimism, arbitrum],
  transports: {
    [mainnet.id]:   http("https://ethereum-rpc.publicnode.com"),
    [base.id]:      http("https://base-rpc.publicnode.com"),
    [polygon.id]:   http("https://polygon-bor-rpc.publicnode.com"),
    [optimism.id]:  http("https://optimism-rpc.publicnode.com"),
    [arbitrum.id]:  http("https://arbitrum-one-rpc.publicnode.com"),
  },
  ssr: true,
});
