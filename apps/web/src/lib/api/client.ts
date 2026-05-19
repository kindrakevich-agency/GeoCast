// Tiny fetch wrapper. Reads the JWT from localStorage (browser-only) and
// sets Authorization: Bearer when present. Throws ApiError on non-2xx so
// hooks can switch on `instanceof ApiError`.

const TOKEN_STORAGE_KEY = "geocast.jwt";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Decode a JWT's `exp` claim without verifying the signature (cheap,
 * client-side sanity check). Returns true if the token has expired by
 * wall-clock time. Returns false if exp is missing/unparseable — let the
 * server be the authority in that case.
 *
 * 30-second skew tolerance avoids edge-case 401s when the client clock
 * lags the server by a few seconds right at expiry.
 */
function isTokenExpired(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return Date.now() / 1000 > payload.exp + 30;
  } catch {
    return false;
  }
}

/**
 * Like getStoredToken but pre-emptively clears + returns null for an
 * already-expired JWT. Saves us a guaranteed 401 round-trip when the
 * client knows the token can't possibly work.
 */
export function getValidToken(): string | null {
  const t = getStoredToken();
  if (!t) return null;
  if (isTokenExpired(t)) {
    clearToken();
    broadcastAuthCleared();
    return null;
  }
  return t;
}

export function storeToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Custom event fired when a stale token is auto-cleared on 401. The
 * AuthProvider listens for this and resets user → null + isAuthed → false,
 * so the UI re-renders as anonymous without a full page reload.
 */
export const AUTH_CLEARED_EVENT = "geocast:auth-cleared";

function broadcastAuthCleared(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CLEARED_EVENT));
}

export type ApiFetchOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;          // pre-stringified or any value (will be JSON.stringified)
  headers?: HeadersInit;
  signal?: AbortSignal;
  /** Force-skip the Authorization header even if a token is stored. */
  anonymous?: boolean;
};

const BASE = "/api";

export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  // getValidToken() peeks the exp claim and pre-clears stale tokens, so a
  // browser that's been idle past expiry doesn't burn a guaranteed 401 on
  // every request before the auto-clear can react.
  const token = opts.anonymous ? null : getValidToken();

  const headers = new Headers(opts.headers);
  headers.set("Accept", "application/json");
  if (opts.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const init: RequestInit = {
    ...opts,
    headers,
    body:
      opts.body === undefined
        ? undefined
        : typeof opts.body === "string"
        ? opts.body
        : JSON.stringify(opts.body),
  };

  const response = await fetch(url, init);
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    // Auto-clear a stale token on 401. Lexik's JWT firewall rejects expired
    // tokens before access_control runs, so even read-only public endpoints
    // (e.g. /leaderboard) return 401 when a stale Bearer is attached. The
    // user shouldn't have to hard-refresh to escape that state — clearing
    // the token here puts subsequent requests back into anonymous mode.
    if (response.status === 401 && token) {
      clearToken();
      broadcastAuthCleared();
    }
    throw new ApiError(response.status, url, parsed, `${response.status} ${response.statusText} on ${path}`);
  }

  return parsed as T;
}
