"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";

export type TopBarProps = {
  wallet: string;
  balance: number;
};

export function TopBar({ wallet, balance }: TopBarProps) {
  return (
    <GlassPanel
      variant="strong"
      className="pointer-events-auto absolute left-1/2 top-4 z-40 flex w-[min(960px,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-6 rounded-full px-5 py-2.5"
    >
      <div className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[var(--color-cyan)] to-[var(--color-magenta)] text-[10px] font-bold text-[var(--color-bg)]">
          GC
        </div>
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold tracking-wide">
          GeoCast
        </span>
      </div>

      <nav className="hidden gap-6 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)] md:flex">
        <a className="text-white" href="#">Game</a>
        <a className="hover:text-white" href="#">Leaderboard</a>
        <a className="hover:text-white" href="#">Profile</a>
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs sm:flex">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--color-cyan)", boxShadow: "0 0 8px var(--color-cyan)" }}
          />
          {balance} cr
        </div>
        <div className="rounded-full bg-white/5 px-3 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--color-text-muted)]">
          {wallet}
        </div>
      </div>
    </GlassPanel>
  );
}
