"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { AuthProvider } from "@/lib/auth-context";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();

const geocastDarkTheme = darkTheme({
  accentColor: "#00d4ff",
  accentColorForeground: "#0a0e1a",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={geocastDarkTheme} modalSize="compact">
          <AuthProvider>{children}</AuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
