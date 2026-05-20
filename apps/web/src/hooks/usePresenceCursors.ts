"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel, Members, PresenceChannel } from "pusher-js";
import { getPusher } from "@/lib/pusher";

export type PeerCursor = {
  userId: string;
  wallet: string;
  isAdmin: boolean;
  lng: number;
  lat: number;
  /** epoch ms of the last broadcast we received from this peer */
  updatedAt: number;
};

export type PresencePeer = {
  userId: string;
  wallet: string;
  isAdmin: boolean;
};

export type PresenceState = {
  /** True once pusher:subscription_succeeded has fired. */
  ready: boolean;
  /** Total members on the channel — drives the "247 explorers playing" badge. */
  memberCount: number;
  /** Other users' cursors, keyed by user_id. Excludes the local user. */
  cursors: Record<string, PeerCursor>;
  /** All peers currently subscribed to the channel (excluding local user).
   *  Drives the SidePanel's "watching now" list — real wallets, no mocks. */
  peers: PresencePeer[];
};

/** Throttle window for cursor broadcasts. Pusher's free tier caps client
 *  events at ~10/sec/client; 5/sec is comfortable and matches the spec. */
const CURSOR_BROADCAST_MS = 200;

/**
 * Subscribes to `presence-round-{id}`, tracks the live roster, and
 * broadcasts the local user's cursor at 5/sec via the `client-cursor-move`
 * client event. Returns peer cursors (excluding self) plus the member count.
 *
 * Usage:
 *   const { ready, memberCount, cursors } = usePresenceCursors(roundId, localCursorRef);
 *
 * `localCursorRef` is a ref to the latest local cursor; the hook reads it
 * on a timer rather than re-subscribing on every mousemove. Pass `null` to
 * disable broadcasts (e.g. after the user has placed their pin).
 *
 * No-ops cleanly when Pusher isn't configured.
 */
export function usePresenceCursors(
  roundId: string | null | undefined,
  localCursorRef: React.MutableRefObject<{ lng: number; lat: number } | null>,
): PresenceState {
  const [state, setState] = useState<PresenceState>({
    ready: false,
    memberCount: 0,
    cursors: {},
    peers: [],
  });

  useEffect(() => {
    if (!roundId) return;
    const pusher = getPusher();
    if (!pusher) return;

    const channelName = `presence-round-${roundId}`;
    const channel = pusher.subscribe(channelName) as PresenceChannel;

    let myUserId: string | null = null;
    let lastSent = 0;
    let lastSentLng = NaN;
    let lastSentLat = NaN;

    type MemberInfo = { wallet?: string; isAdmin?: boolean };

    const buildPeers = (members: Members, mineId: string | null): PresencePeer[] => {
      const list: PresencePeer[] = [];
      members.each((m: { id: string; info: MemberInfo }) => {
        if (m.id === mineId) return;
        list.push({
          userId: m.id,
          wallet: m.info?.wallet ?? "0x…",
          isAdmin: m.info?.isAdmin === true,
        });
      });
      return list;
    };

    const onSubscribed = (members: Members) => {
      myUserId = members.myID;
      setState((s) => ({
        ...s,
        ready: true,
        memberCount: members.count,
        peers: buildPeers(members, myUserId),
      }));
    };

    const onMemberAdded = (member: { id: string; info?: MemberInfo }) => {
      setState((s) => ({
        ...s,
        memberCount: s.memberCount + 1,
        peers:
          member.id === myUserId
            ? s.peers
            : [
                ...s.peers,
                {
                  userId: member.id,
                  wallet: member.info?.wallet ?? "0x…",
                  isAdmin: member.info?.isAdmin === true,
                },
              ],
      }));
    };

    const onMemberRemoved = (member: { id: string }) => {
      setState((s) => {
        const nextCursors = { ...s.cursors };
        delete nextCursors[member.id];
        return {
          ...s,
          memberCount: Math.max(0, s.memberCount - 1),
          cursors: nextCursors,
          peers: s.peers.filter((p) => p.userId !== member.id),
        };
      });
    };

    type CursorPayload = { lng: number; lat: number };
    const onCursorMove = (data: CursorPayload, metadata?: { user_id?: string }) => {
      const userId = metadata?.user_id;
      if (!userId || userId === myUserId) return;
      if (typeof data?.lng !== "number" || typeof data?.lat !== "number") return;

      const member = (channel.members.get(userId) as
        | { info?: { wallet?: string; isAdmin?: boolean } }
        | null) ?? null;

      setState((s) => ({
        ...s,
        cursors: {
          ...s.cursors,
          [userId]: {
            userId,
            wallet: member?.info?.wallet ?? "0x…",
            isAdmin: member?.info?.isAdmin === true,
            lng: data.lng,
            lat: data.lat,
            updatedAt: Date.now(),
          },
        },
      }));
    };

    channel.bind("pusher:subscription_succeeded", onSubscribed);
    channel.bind("pusher:member_added", onMemberAdded);
    channel.bind("pusher:member_removed", onMemberRemoved);
    channel.bind("client-cursor-move", onCursorMove);

    // Broadcast our own cursor on a 200ms tick. We read from the ref so the
    // calling component doesn't have to remount this hook on every mouseover.
    const broadcastTimer = window.setInterval(() => {
      const c = localCursorRef.current;
      if (!c) return;
      const now = performance.now();
      if (now - lastSent < CURSOR_BROADCAST_MS) return;
      // Drop redundant ticks when the cursor hasn't actually moved.
      if (c.lng === lastSentLng && c.lat === lastSentLat) return;

      const sent = (channel as Channel).trigger("client-cursor-move", {
        lng: c.lng,
        lat: c.lat,
      });
      if (sent) {
        lastSent = now;
        lastSentLng = c.lng;
        lastSentLat = c.lat;
      }
    }, CURSOR_BROADCAST_MS);

    return () => {
      window.clearInterval(broadcastTimer);
      channel.unbind("pusher:subscription_succeeded", onSubscribed);
      channel.unbind("pusher:member_added", onMemberAdded);
      channel.unbind("pusher:member_removed", onMemberRemoved);
      channel.unbind("client-cursor-move", onCursorMove);
      pusher.unsubscribe(channelName);
      setState({ ready: false, memberCount: 0, cursors: {}, peers: [] });
    };
  }, [roundId, localCursorRef]);

  return state;
}
