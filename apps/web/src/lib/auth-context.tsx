"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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

export type AuthValue = {
  user: ApiUser | null;
  isAuthed: boolean;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  /** Merge a partial update into the user state — e.g. fresh creditsBalance
   *  after a successful pin placement. Used to keep TopBar in sync without
   *  forcing an /api/me refetch. */
  updateUser: (partial: Partial<ApiUser>) => void;
  error: Error | null;
};

const defaultValue: AuthValue = {
  user: null,
  isAuthed: false,
  isSigningIn: false,
  signIn: async () => {
    throw new Error("AuthProvider not mounted");
  },
  signOut: () => {},
  updateUser: () => {},
  error: null,
};

const AuthContext = createContext<AuthValue>(defaultValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [user, setUser] = useState<ApiUser | null>(loadSessionUser);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Hydrate user from /api/me if we have a JWT but no session-cached user.
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
      const { nonce } = await apiFetch<ApiNonceResponse>("/auth/nonce", {
        method: "POST",
        body: { address },
        anonymous: true,
      });

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

      const signature = await signMessageAsync({ message });

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

  const updateUser = useCallback((partial: Partial<ApiUser>) => {
    setUser((prev) => {
      if (prev === null) return prev;
      const next = { ...prev, ...partial };
      storeSessionUser(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      isAuthed: user !== null,
      isSigningIn,
      signIn,
      signOut,
      updateUser,
      error,
    }),
    [user, isSigningIn, signIn, signOut, updateUser, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
