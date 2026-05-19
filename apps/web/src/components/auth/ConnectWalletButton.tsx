"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/hooks/useAuth";

// Module-level latch — survives component remounts so accidental
// double-mounts (StrictMode dev, RainbowKit modal animations, etc.)
// don't double-fire the SIWE handshake.
const attemptedAddresses = new Set<string>();

/**
 * Single-button SIWE flow built on RainbowKit's ConnectButton.Custom.
 *
 *   1. Wallet not connected     → "Connect Wallet"  (opens RainbowKit modal)
 *   2. Wrong chain               → "Wrong network"   (opens chain picker)
 *   3. Connected, not signed-in  → "Sign in"        (triggers SIWE handshake)
 *   4. Signed in                 → "<wallet> · disconnect"
 *
 * Auto-fires signIn() once after a successful wallet connection so the
 * user doesn't see the "Sign in" intermediate state on the happy path —
 * but the explicit button stays as a fallback if the auto-sign is
 * dismissed in the wallet popup.
 */
export function ConnectWalletButton({
  variant = "primary",
  onSignedIn,
}: {
  variant?: "primary" | "compact";
  onSignedIn?: () => void;
}) {
  const { isAuthed, isSigningIn, signIn, signOut, error } = useAuth();
  const { isConnected, address } = useAccount();

  // Stable ref to the latest signIn so the effect deps don't include it
  // (its useCallback identity changes whenever wagmi's signMessageAsync
  // ref changes, which it does often). Including signIn in deps would
  // re-fire the effect on every render → many concurrent nonce requests.
  const signInRef = useRef(signIn);
  useEffect(() => {
    signInRef.current = signIn;
  }, [signIn]);

  // Auto-fire SIWE exactly once per (wallet address) per session. If the
  // user dismisses the wallet popup or the backend rejects, they have to
  // click "Sign in to play" manually to retry — no automatic retry, no
  // loop. The attempted-addresses set is module-level so React StrictMode
  // double-mounts can't bypass it.
  useEffect(() => {
    if (!isConnected || !address || isAuthed || isSigningIn) return;
    if (attemptedAddresses.has(address)) return;
    attemptedAddresses.add(address);

    void signInRef
      .current()
      .then(() => onSignedIn?.())
      .catch(() => {
        // Intentionally not removing from attemptedAddresses — that would
        // re-trigger the effect immediately and create a retry loop. The
        // user must click "Sign in to play" manually to retry.
      });
  }, [isConnected, address, isAuthed, isSigningIn, onSignedIn]);

  // Clear the latch on disconnect so the NEXT connection (possibly with a
  // different address) attempts SIWE fresh.
  useEffect(() => {
    if (!isConnected) attemptedAddresses.clear();
  }, [isConnected]);

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, mounted: rkMounted }) => {
        const mounted = rkMounted;
        const connected = mounted && !!account && !!chain;

        // Not connected — show big Connect button
        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              type="button"
              className={primaryClass(variant)}
            >
              <WalletIcon />
              <span>Connect Wallet</span>
            </button>
          );
        }

        // Wrong chain
        if (chain.unsupported) {
          return (
            <button onClick={openChainModal} type="button" className={primaryClass(variant)} style={wrongNetworkStyle}>
              Wrong network
            </button>
          );
        }

        // Connected but not signed in
        if (!isAuthed) {
          return (
            <button
              onClick={() => void signIn().then(() => onSignedIn?.())}
              type="button"
              disabled={isSigningIn}
              className={primaryClass(variant)}
            >
              {isSigningIn ? "Signing in…" : "Sign in to play"}
              {error && (
                <span className="ml-2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] opacity-70">
                  retry?
                </span>
              )}
            </button>
          );
        }

        // Signed in — show address + disconnect
        return (
          <div className={compactWrapper(variant)}>
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs">
              {account.displayName}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] transition-colors hover:bg-white/10 hover:text-white"
            >
              disconnect
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

function primaryClass(variant: "primary" | "compact") {
  if (variant === "compact") {
    return "inline-flex items-center gap-2 rounded-full bg-[var(--color-cyan)] px-4 py-1.5 text-xs font-medium text-[var(--color-bg)] ring-glow-cyan transition-transform hover:scale-[1.02]";
  }
  return "group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius)] bg-[var(--color-cyan)] px-6 py-3.5 font-medium text-[var(--color-bg)] ring-glow-cyan transition-transform hover:scale-[1.015]";
}

function compactWrapper(variant: "primary" | "compact") {
  if (variant === "compact") {
    return "flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-black/40 px-3 py-1 backdrop-blur-md";
  }
  return "flex items-center justify-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-black/30 px-6 py-3";
}

const wrongNetworkStyle: React.CSSProperties = {
  background: "var(--color-amber)",
  boxShadow: "0 0 0 1px rgba(255, 184, 0, 0.5), 0 0 32px rgba(255, 184, 0, 0.35)",
};

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 7.5C3 6.12 4.12 5 5.5 5h13A2.5 2.5 0 0 1 21 7.5V9h-2V8a1 1 0 0 0-1-1H6a1 1 0 0 0 0 2h14v2H6a3 3 0 0 1-3-3V7.5z"
        fill="currentColor"
      />
      <path
        d="M3 10h17a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7zm14 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
        fill="currentColor"
      />
    </svg>
  );
}
