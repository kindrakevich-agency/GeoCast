"use client";

import Pusher from "pusher-js";
import { getStoredToken } from "@/lib/api/client";

/**
 * Singleton Pusher client.
 *
 * Returns null (and stays null) when NEXT_PUBLIC_PUSHER_KEY isn't set —
 * the rest of the app treats that as "real-time not available" and falls
 * back to the synchronous response shape. This matches the backend's
 * PusherBroadcaster, which is also a silent no-op when its server-side
 * env vars are empty.
 *
 * To enable: sign up at https://pusher.com/channels (free tier), then add
 * NEXT_PUBLIC_PUSHER_KEY + NEXT_PUBLIC_PUSHER_CLUSTER to the build env.
 */

let cached: Pusher | null | undefined;

export function getPusher(): Pusher | null {
  if (cached !== undefined) return cached;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu";

  if (!key || typeof window === "undefined") {
    cached = null;
    return null;
  }

  cached = new Pusher(key, {
    cluster,
    // Presence channels need a signed payload from /api/pusher/auth. We
    // attach the user's JWT so the server-side authorizer can resolve the
    // current User and embed their wallet into the channel's presence data.
    authEndpoint: "/api/pusher/auth",
    auth: {
      headers: {
        get Authorization() {
          const token = getStoredToken();
          return token ? `Bearer ${token}` : "";
        },
      },
    },
  });

  return cached;
}

export function isPusherEnabled(): boolean {
  return getPusher() !== null;
}
