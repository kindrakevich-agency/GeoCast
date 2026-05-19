"use client";

import { useEffect, useRef } from "react";
import { getPusher } from "@/lib/pusher";

type EventHandlers = Record<string, (data: unknown) => void>;

/**
 * Subscribes to a Pusher channel for the lifetime of the component, binding
 * each provided handler to its event. Unbinds + unsubscribes cleanly on
 * unmount or channel change.
 *
 *   usePusherChannel(`round-${roundId}`, {
 *     "pin-placed":     (data) => { ... },
 *     "round-resolved": (data) => { ... },
 *   });
 *
 * When `channelName` is null or empty the hook is a no-op. Same when
 * pusher-js isn't configured (NEXT_PUBLIC_PUSHER_KEY unset) — the rest
 * of the app keeps working off the synchronous API responses.
 *
 * Handlers are held in a ref so closure changes don't tear down + rebuild
 * the subscription on every parent re-render.
 */
export function usePusherChannel(
  channelName: string | null | undefined,
  handlers: EventHandlers,
): void {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!channelName) return;
    const pusher = getPusher();
    if (!pusher) return;

    const channel = pusher.subscribe(channelName);
    const eventNames = Object.keys(handlersRef.current);

    const wrapped: Record<string, (data: unknown) => void> = {};
    for (const event of eventNames) {
      wrapped[event] = (data) => {
        // Always call the latest handler (ref-based) so updating handlers
        // from props/state doesn't require a resubscribe.
        const fn = handlersRef.current[event];
        if (fn) fn(data);
      };
      channel.bind(event, wrapped[event]);
    }

    return () => {
      for (const event of eventNames) {
        channel.unbind(event, wrapped[event]);
      }
      pusher.unsubscribe(channelName);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName]);
}
