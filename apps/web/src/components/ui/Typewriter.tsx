"use client";

import { useEffect, useState } from "react";

/**
 * Typewriter — cycles through `phrases`, typing each one character by
 * character, holding briefly, then deleting and moving to the next.
 *
 * Stops the animation (renders the full first phrase, statically) for users
 * who have `prefers-reduced-motion: reduce` set, so motion-sensitive folks
 * still see the example. Otherwise nothing on the page actually depends
 * on this animation — it's pure flavor.
 */
export function Typewriter({
  phrases,
  typeMs = 45,
  deleteMs = 22,
  holdMs = 2200,
  emptyMs = 400,
  className = "",
  caretColor = "var(--color-cyan)",
}: {
  phrases: string[];
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  emptyMs?: number;
  className?: string;
  caretColor?: string;
}) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting" | "empty">("typing");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(m.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      // Render the first phrase statically; no animation.
      setText(phrases[0] ?? "");
      return;
    }
    if (phrases.length === 0) return;

    const current = phrases[index % phrases.length];

    let id: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (text.length < current.length) {
        id = setTimeout(() => setText(current.slice(0, text.length + 1)), typeMs);
      } else {
        id = setTimeout(() => setPhase("holding"), 0);
      }
    } else if (phase === "holding") {
      id = setTimeout(() => setPhase("deleting"), holdMs);
    } else if (phase === "deleting") {
      if (text.length > 0) {
        id = setTimeout(() => setText(text.slice(0, -1)), deleteMs);
      } else {
        id = setTimeout(() => setPhase("empty"), 0);
      }
    } else {
      id = setTimeout(() => {
        setIndex((i) => (i + 1) % phrases.length);
        setPhase("typing");
      }, emptyMs);
    }
    return () => clearTimeout(id);
  }, [text, phase, index, phrases, typeMs, deleteMs, holdMs, emptyMs, reduceMotion]);

  return (
    <span className={className}>
      <span>{text}</span>
      {!reduceMotion && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block w-[2px] animate-pulse align-middle"
          style={{
            height: "0.9em",
            background: caretColor,
            transform: "translateY(2px)",
            boxShadow: `0 0 6px ${caretColor}`,
          }}
        />
      )}
    </span>
  );
}
