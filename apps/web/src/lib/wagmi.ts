"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";

/**
 * Wagmi + RainbowKit config.
 *
 * Chains list mirrors SIWE_ALLOWED_CHAIN_IDS on the server (1, 8453, 137,
 * 10, 42161). Adding a chain here AND on the server lets users sign in
 * from that network.
 *
 * `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` enables WalletConnect (mobile,
 * Trust, Rainbow, etc). Without it, RainbowKit still exposes the injected
 * connector (browser-extension wallets like MetaMask) which is enough
 * for desktop testing.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "GeoCast",
  // Use a placeholder when not set — RainbowKit needs *some* string but
  // falls back gracefully if WalletConnect can't reach its relay.
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "geocast-dev",
  chains: [mainnet, base, polygon, optimism, arbitrum],
  ssr: true,
});
