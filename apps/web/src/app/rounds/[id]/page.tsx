"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BottomHint } from "@/components/round/BottomHint";
import { ClaimBar } from "@/components/round/ClaimBar";
import { Confetti } from "@/components/round/Confetti";
import { ConfirmModal } from "@/components/round/ConfirmModal";
import { DistanceBadge } from "@/components/round/DistanceBadge";
import { Leaderboard } from "@/components/round/Leaderboard";
import { MapStage } from "@/components/map/MapStage";
import { QuestionCard } from "@/components/round/QuestionCard";
import { SidePanel } from "@/components/round/SidePanel";
import { TopBar } from "@/components/round/TopBar";
import { useCurrentRound } from "@/hooks/useCurrentRound";
import { useAuth } from "@/hooks/useAuth";
import { useCommitBet } from "@/hooks/useCommitBet";
import { useMintTestUsdc } from "@/hooks/useMintTestUsdc";
import { useOnchainRound } from "@/hooks/useOnchainRound";
import { usePresenceCursors } from "@/hooks/usePresenceCursors";
import { usePusherChannel } from "@/hooks/usePusherChannel";
import { useRoundPins } from "@/hooks/useRoundPins";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import { ApiError, apiFetch, getValidToken } from "@/lib/api/client";
import type { ApiPlacePredictionResponse, ApiPrediction } from "@/lib/api/types";
import { demoPresence, demoRound, shortWallet, type LngLat, type MockPresence } from "@/lib/mock";
import { isOnchainEnabled, getOnchainConfig } from "@/lib/onchain/config";
import { baseSepolia } from "viem/chains";

/**
 * Active round screen.
 *
 * Reads the round from /api/rounds/current (falls back to demoRound mock).
 *
 * Pin placement:
 *   - Authenticated + round is from API → POST /api/rounds/{id}/predictions,
 *     update local + auth-context state from the response.
 *   - Otherwise → local-only mock placement so the demo loop still works.
 */
export default function ActiveRoundPage() {
  const { round: liveRound, isLoading } = useCurrentRound();
  const { isAuthed, updateUser } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  // The page ignores the URL slug and always renders /api/rounds/current.
  // To keep the URL honest (so shares + deep links reflect the real round),
  // rewrite the URL once we know the actual ULID. /play redirects here, so
  // this is the canonicalization step for the "Game" nav link too.
  useEffect(() => {
    if (!liveRound) return;
    if (params?.id !== liveRound.id) {
      router.replace(`/rounds/${liveRound.id}`);
    }
  }, [liveRound, params?.id, router]);

  const [pending, setPending] = useState<LngLat | null>(null);
  const [myPin, setMyPin] = useState<LngLat | null>(null);
  const [resolved, setResolved] = useState(false);
  const placed = myPin !== null;

  // Rehydrate the user's pin across reloads by hitting
  // /api/rounds/{id}/my-prediction directly. Inlined here (rather than as a
  // separate hook) because Next.js 16 + Turbopack was code-splitting the
  // hook into an orphan chunk that the SSR'd HTML never script-tagged,
  // so the hook never ran. Inlining keeps it in the page's own chunk.
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionFetchBump, setPredictionFetchBump] = useState(0);
  const [persistedPrediction, setPersistedPrediction] = useState<ApiPrediction | null>(null);
  const refetchMyPrediction = () => setPredictionFetchBump((n) => n + 1);

  useEffect(() => {
    const roundId = liveRound?.id;
    if (!roundId) return;
    if (!getValidToken()) return;

    setPredictionLoading(true);
    const ctrl = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetch<ApiPrediction | null>(
          `/rounds/${roundId}/my-prediction`,
          { signal: ctrl.signal },
        );
        if (cancelled || !data) return;
        // Persist the full prediction (lat/lng plus distanceKm/rank/payout
        // once the round has resolved) so post-resolution UI can render
        // the user's actual result.
        setPersistedPrediction(data);
        // Only hydrate myPin if we don't already have a local one — avoids
        // clobbering a just-placed pin.
        setMyPin((prev) => prev ?? { lat: data.lat, lng: data.lng });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        // Silent — page falls through to anonymous mode.
      } finally {
        if (!cancelled) setPredictionLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [liveRound?.id, predictionFetchBump]);

  // Local pool/participants override populated from /predictions response.
  // (Live round state could lag — we got the authoritative numbers back from
  // the POST.)
  const [livePool, setLivePool] = useState<number | null>(null);
  const [liveParticipants, setLiveParticipants] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const usingLive = liveRound !== null;
  const round = liveRound ?? {
    id: demoRound.id,
    number: demoRound.number,
    question: demoRound.question,
    description: demoRound.description,
    opensAt: demoRound.opensAt,
    closesAt: demoRound.closesAt,
    poolCredits: demoRound.poolCredits,
    totalParticipants: demoRound.totalParticipants,
    status: demoRound.status,
    answer: demoRound.answer ?? null,
  };

  const answer = round.answer ?? null;

  // ---------- Real-time (Pusher) ----------
  // Two channels: the public `round-{id}` for server-broadcast events
  // (pin-placed, round-resolved) and the auth'd `presence-round-{id}` for
  // peer cursor positions (client-cursor-move) plus the live watcher count.
  // Both no-op silently when Pusher isn't configured.
  const pusherChannel = usingLive ? `round-${round.id}` : null;
  const presenceRoundId = usingLive && isAuthed && !resolved ? round.id : null;

  const localCursorRef = useRef<LngLat | null>(null);
  const { memberCount, cursors, peers } = usePresenceCursors(presenceRoundId, localCursorRef);

  // Anonymized pin coordinates for the round — drives the heatmap + dot
  // markers on the map. Server returns [] for open rounds where the
  // caller hasn't placed yet, so visiting before commitment shows a clean
  // map. `pinFetchKey` bumps after our own placement so the heatmap
  // includes our pin (and everyone else's that arrived during the page life).
  const [pinFetchKey, setPinFetchKey] = useState(0);
  const { pins: roundPins } = useRoundPins(
    usingLive ? round.id : null,
    pinFetchKey,
  );

  const displayPool = livePool ?? (round.poolCredits || demoRound.poolCredits);
  const predictionCount =
    liveParticipants ?? (round.totalParticipants || demoRound.totalParticipants);
  // The "explorers playing now" badge shows live watcher count from Pusher
  // presence — never less than how many have actually placed pins.
  const displayParticipants = Math.max(predictionCount, memberCount);

  // Map peer cursors → the MockPresence shape MapStage already renders.
  // Falls back to demoPresence on the demo round / when Pusher's off so the
  // landing-style "live cursors" feel survives in mock mode.
  const livePresence = useMemo<MockPresence[]>(() => {
    const peers = Object.values(cursors);
    if (peers.length === 0 && !usingLive) return demoPresence;
    return peers.map((p) => ({
      id: p.userId,
      handle: shortWallet(p.wallet),
      cursor: { lng: p.lng, lat: p.lat },
    }));
  }, [cursors, usingLive]);

  usePusherChannel(pusherChannel, {
    "pin-placed": (data) => {
      const d = data as { count?: number; pool?: number };
      if (typeof d.count === "number") setLiveParticipants(d.count);
      if (typeof d.pool === "number") setLivePool(d.pool);
      // A new pin landed — refetch the anonymized aggregate so our
      // heatmap stays in sync with what other tabs are seeing.
      setPinFetchKey((n) => n + 1);
    },
    "round-resolved": (data) => {
      const d = data as { answer?: { lat: number; lng: number } };
      if (d.answer) {
        // The local `answer` variable is derived from `round` — we can't
        // mutate the API response here, so we trigger the resolution
        // choreography via local state. The user's own pin (myPin) and
        // demoPlayers seed the leaderboard until /api/rounds/{id}/results
        // lands. For now: just flip into the resolved view.
        setResolved(true);
      }
    },
  });

  // Post-resolution metrics come from the user's persisted prediction
  // record (distanceKm, rank, payout are set during ResolveRoundService).
  // Until /api/rounds/{id}/results lands as a full ranked endpoint, the
  // Leaderboard slide-in renders just the user's own row.
  const myDistance = persistedPrediction?.distanceKm ?? 0;
  const myRank = persistedPrediction?.rank ?? null;
  const myPayout = persistedPrediction?.payout ?? 0;
  const top10 = myRank !== null && myRank <= 10;
  const ranked = useMemo(() => {
    if (!resolved || !myPin || myRank === null) return null;
    return [
      {
        id: "me",
        handle: "you",
        wallet: "you",
        countryHint: "",
        pinLocation: myPin,
        distanceKm: myDistance,
        rank: myRank,
        payout: myPayout,
        rawScore: 1 / (1 + myDistance),
        isMe: true as const,
      },
    ];
  }, [resolved, myPin, myRank, myDistance, myPayout]);

  const onMapClick = (coords: LngLat) => {
    if (placed || submitting) return;
    // Block clicks while we're still hydrating the user's prior placement —
    // otherwise a fast click between page-load and the /my-prediction
    // response races straight into a guaranteed-409 POST.
    if (isAuthed && usingLive && predictionLoading) return;
    setSubmitError(null);
    setPending(coords);
  };

  // The full POST happy path is gated by: authenticated + live round.
  // Anonymous users / demo round → local-only mock placement.
  const shouldHitApi = isAuthed && usingLive;

  // ---------- On-chain commit (v2) ----------
  //
  // When isOnchainEnabled() AND the round has been mirrored to GeoCastPool
  // via admin createRound(), the click-to-place flow swaps from POST
  // /predictions → wagmi commitBet. Falls back transparently to the credit
  // POST when any precondition isn't met, so this code is safe to ship
  // before all rounds are mirrored.
  const onchainCfg = getOnchainConfig();
  const onchain = useOnchainRound(usingLive ? round.number : null);
  const { balance: usdcBalance, refetch: refetchUsdc } = useUsdcBalance();
  const { status: commitStatus, commit: onchainCommit } = useCommitBet(round.number);
  const { status: mintStatus, mint: onchainMint } = useMintTestUsdc();
  const shouldUseOnchain =
    isOnchainEnabled() && isAuthed && usingLive && onchain.exists;
  const usdcShortfall = shouldUseOnchain && usdcBalance < onchainCfg.betMicros;
  const isTestnet = onchainCfg.chainId === baseSepolia.id;

  // Reflect the wagmi commit phase back into the page's submit-status UI.
  useEffect(() => {
    if (commitStatus.phase === "approving") setSubmitError("approving USDC…");
    else if (commitStatus.phase === "committing") setSubmitError("waiting for on-chain commit…");
    else if (commitStatus.phase === "done") {
      // setMyPin was already set optimistically in onConfirm — confirm tx hash.
      setSubmitError(null);
      setPending(null);
    } else if (commitStatus.phase === "error") {
      setSubmitError(commitStatus.message);
    }
  }, [commitStatus]);

  const onConfirm = async () => {
    if (!pending) return;
    const coords = pending;

    if (!shouldHitApi) {
      setMyPin(coords);
      setPending(null);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    if (shouldUseOnchain) {
      // Branch A — on-chain. Pin is shown optimistically; if the tx
      // ultimately reverts the useEffect on commitStatus.error surfaces
      // the wallet's error message and we keep the pin (user can
      // discard or retry — UX TBD).
      setMyPin(coords);
      try {
        await onchainCommit(coords);
        // Optimistically bump the pool count — backend cron will reconcile
        // on the next onchain:sync tick.
        setLiveParticipants((n) => (n ?? 0) + 1);
      } catch {
        // Errors surface via commitStatus.error → useEffect → submitError.
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Branch B — existing credit flow.
    try {
      const result = await apiFetch<ApiPlacePredictionResponse>(
        `/rounds/${round.id}/predictions`,
        { method: "POST", body: { lat: coords.lat, lng: coords.lng } },
      );

      setMyPin({ lat: result.prediction.lat, lng: result.prediction.lng });
      setLivePool(result.pool);
      setLiveParticipants(result.participants);
      updateUser({ creditsBalance: result.balance });
      setPending(null);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? humanizeApiError(e)
          : (e as Error).message || "Failed to place pin.";
      setSubmitError(msg);
      // 409 means the server has a prediction for this user/round already.
      // Refetch /my-prediction so the page picks it up and the pin renders.
      if (e instanceof ApiError && e.status === 409) {
        refetchMyPrediction();
        setPending(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)] scanlines">
      <MapStage
        placed={placed}
        resolved={resolved}
        myPin={myPin}
        answer={resolved ? answer : null}
        presence={livePresence}
        pins={roundPins}
        onMapClick={onMapClick}
        onCursorMove={(c) => {
          localCursorRef.current = c;
        }}
      />

      <TopBar wallet="0x7f4c…a3b1" balance={100} />

      <QuestionCard
        question={round.question}
        closesAt={round.closesAt}
        participants={displayParticipants}
        pool={displayPool}
        roundNumber={round.number}
        status={resolved ? "resolved" : "open"}
      />

      {!resolved && (
        <SidePanel
          open={placed}
          myPin={myPin}
          participants={predictionCount}
          watching={memberCount}
          peers={peers}
        />
      )}

      {!resolved && <BottomHint placed={placed} coords={myPin} />}

      <ConfirmModal
        open={pending !== null}
        coords={pending}
        onConfirm={onConfirm}
        onCancel={() => {
          setPending(null);
          setSubmitError(null);
        }}
      />

      {/* Submit error toast — sits above the BottomHint */}
      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            className="pointer-events-auto absolute bottom-24 left-1/2 z-40 -translate-x-1/2"
          >
            <div
              className="glass-strong flex items-center gap-3 rounded-full px-5 py-3 text-sm"
              style={{
                boxShadow: "0 0 0 1px rgba(255, 0, 110, 0.4), 0 8px 32px rgba(255, 0, 110, 0.25)",
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-magenta)", boxShadow: "0 0 10px var(--color-magenta)" }}
              />
              <span className="text-[var(--color-text)]">{submitError}</span>
              <button
                onClick={() => setSubmitError(null)}
                className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-white"
              >
                dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DistanceBadge distanceKm={myDistance} visible={resolved} />

      <Leaderboard
        open={resolved}
        entries={ranked ?? []}
        myRank={myRank}
        myPayout={myPayout}
      />

      <Confetti fire={resolved && top10} />

      {resolved && <ClaimBar payout={myPayout} />}

      {/* Source-of-truth indicator */}
      <div className="pointer-events-none fixed bottom-2 left-2 z-50 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] opacity-60">
        {isLoading
          ? "loading…"
          : usingLive
          ? `round #${round.number} · ${shouldUseOnchain ? "on-chain · $1 USDC" : shouldHitApi ? "signed in · 1 credit" : "demo mode (sign in to play)"}`
          : "mock data"}
      </div>

      {/* Test-USDC mint affordance — visible when on-chain is enabled, the user is
          signed in, doesn't have enough USDC, and we're on a testnet chain. */}
      {usdcShortfall && isTestnet && !placed && (
        <button
          onClick={async () => {
            await onchainMint(100_000_000n); // 100 USDC of test funds
            refetchUsdc();
          }}
          disabled={mintStatus.phase === "minting"}
          className="pointer-events-auto fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-[var(--color-amber)] bg-black/60 px-5 py-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.22em] text-[var(--color-amber)] backdrop-blur-md transition-colors hover:bg-[var(--color-amber)] hover:text-[var(--color-bg)] disabled:opacity-50"
        >
          {mintStatus.phase === "minting"
            ? "minting…"
            : `low USDC · mint 100 test USDC →`}
        </button>
      )}

      {/* "Round not yet on-chain" warning — when the global config has a pool
          address but THIS round hasn't been mirrored via createRound yet. */}
      {isOnchainEnabled() && isAuthed && usingLive && !onchain.exists && !onchain.isLoading && !placed && (
        <div className="pointer-events-none fixed bottom-12 left-1/2 z-40 -translate-x-1/2 rounded-full border border-[var(--color-border)] bg-black/60 px-4 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)] backdrop-blur-md">
          round #{round.number} not yet mirrored on-chain · falling back to credits
        </div>
      )}

    </main>
  );
}

function humanizeApiError(e: ApiError): string {
  // The API serializes errors as either { detail } (Symfony) or { error }
  // (custom). Pull whichever's there; fall back to status text.
  const body = e.body;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === "string") return b.detail;
    if (typeof b.error === "string") return b.error;
    if (typeof b.message === "string") return b.message;
  }
  if (e.status === 401) return "Please sign in to place a pin.";
  if (e.status === 409) return "Round closed or you've already placed a pin here.";
  if (e.status === 400) return "Coordinates rejected by the server.";
  return e.message || "Failed to place pin.";
}
