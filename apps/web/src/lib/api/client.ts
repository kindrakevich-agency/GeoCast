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
  const token = opts.anonymous ? null : getStoredToken();

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
