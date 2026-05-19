"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import {
  apiFetch,
  clearToken,
  getStoredToken,
  storeToken,
} from "@/lib/api/client";
import type {
  ApiNonceResponse,
  ApiUser,
  ApiVerifyResponse,
} from "@/lib/api/types";

export type UseAuthResult = {
  user: ApiUser | null;
  isAuthed: boolean;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  error: Error | null;
};

const SESSION_USER_KEY = "geocast.user";

function loadSessionUser(): ApiUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SESSION_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}

function storeSessionUser(user: ApiUser): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
}

function clearSessionUser(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_USER_KEY);
}

/**
 * Drives the SIWE handshake against /api/auth/{nonce,verify} using wagmi
 * for the actual wallet signing. Token + user are persisted: JWT in
 * localStorage (survives reload), user JSON in sessionStorage.
 */
export function useAuth(): UseAuthResult {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [user, setUser] = useState<ApiUser | null>(loadSessionUser);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // If a JWT exists in storage but no session user, hydrate from /api/me.
  useEffect(() => {
    if (user !== null) return;
    if (!getStoredToken()) return;

    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<ApiUser>("/me");
        if (!cancelled) {
          setUser(me);
          storeSessionUser(me);
        }
      } catch {
        // Stale token — clear it. Next sign-in attempt will mint fresh.
        clearToken();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const signIn = useCallback(async () => {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected.");
    }
    setError(null);
    setIsSigningIn(true);
    try {
      // 1. Ask the server for a one-shot nonce scoped to this address.
      const { nonce } = await apiFetch<ApiNonceResponse>("/auth/nonce", {
        method: "POST",
        body: { address },
        anonymous: true,
      });

      // 2. Build the EIP-4361 SIWE message the wallet will sign.
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to GeoCast — daily geo-prediction game.",
        uri: window.location.origin,
        version: "1",
        chainId: chainId ?? 1,
        nonce,
        issuedAt: new Date().toISOString(),
      }).prepareMessage();

      // 3. Have the connected wallet sign it.
      const signature = await signMessageAsync({ message });

      // 4. Submit message + signature to /api/auth/verify and receive JWT.
      const { token, user: verifiedUser } = await apiFetch<ApiVerifyResponse>(
        "/auth/verify",
        {
          method: "POST",
          body: { message, signature },
          anonymous: true,
        },
      );

      storeToken(token);
      storeSessionUser(verifiedUser);
      setUser(verifiedUser);
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setIsSigningIn(false);
    }
  }, [address, chainId, isConnected, signMessageAsync]);

  const signOut = useCallback(() => {
    clearToken();
    clearSessionUser();
    setUser(null);
    setError(null);
    disconnect();
  }, [disconnect]);

  return {
    user,
    isAuthed: user !== null,
    isSigningIn,
    signIn,
    signOut,
    error,
  };
}
