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
import {
  AUTH_CLEARED_EVENT,
  apiFetch,
  clearToken,
  getValidToken,
  storeToken,
} from "@/lib/api/client";

/**
 * Build a canonical EIP-4361 (SIWE) message string. We compose it by hand
 * rather than going through the `siwe` library — siwe v3 broke its
 * builder API (constructor now expects a string to parse, not an object
 * to construct from), and we have a strict server-side parser in PHP
 * that wants this exact wire shape.
 *
 * Format matches the regexes in apps/api/src/Service/Siwe/SiweMessageParser.php.
 */
function buildSiweMessage(opts: {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt?: string;
}): string {
  const issued = opts.issuedAt ?? new Date().toISOString();
  return [
    `${opts.domain} wants you to sign in with your Ethereum account:`,
    opts.address,
    "",
    opts.statement,
    "",
    `URI: ${opts.uri}`,
    `Version: ${opts.version}`,
    `Chain ID: ${opts.chainId}`,
    `Nonce: ${opts.nonce}`,
    `Issued At: ${issued}`,
  ].join("\n");
}
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

  // Start NULL on both server and client to keep the initial render byte-for-byte
  // identical (React error #418 = hydration mismatch). The cached sessionStorage
  // user is loaded after mount so it doesn't affect the SSR'd HTML.
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Post-mount hydration: first try the sessionStorage cache (cheap, instant).
  // If empty and a JWT is present, fetch /api/me. Either path sets `user` once,
  // which triggers a re-render with real data — never during initial hydration.
  useEffect(() => {
    const cached = loadSessionUser();
    if (cached) {
      setUser(cached);
      return;
    }
    if (!getValidToken()) return;

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
  }, []);

  // When apiFetch auto-clears a stale token on 401, snap our own state to
  // "anonymous" so consumers re-render against the right view. Wallet stays
  // connected — the user can hit Connect to re-sign-in without re-connecting.
  useEffect(() => {
    const onCleared = () => {
      clearSessionUser();
      setUser(null);
      setError(new Error("Session expired — please sign in again."));
    };
    window.addEventListener(AUTH_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, onCleared);
  }, []);

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

      const message = buildSiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to GeoCast — daily geo-prediction game.",
        uri: window.location.origin,
        version: "1",
        chainId: chainId ?? 1,
        nonce,
      });

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
