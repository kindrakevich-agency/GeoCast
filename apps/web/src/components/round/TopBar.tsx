"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "@/components/auth/ConnectWalletButton";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAuth } from "@/hooks/useAuth";

export type TopBarProps = {
  /** Used as a fallback when no JWT'd user is present. */
  wallet: string;
  /** Fallback balance. Real balance comes from useAuth().user. */
  balance: number;
};

type NavItem = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  /** When true, only render this entry if useAuth().user.isAdmin === true. */
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  // /play is a server-side redirect to /rounds/{currentRoundId} — keeps the
  // nav URL stable while the visible URL always reflects the real round.
  { href: "/play", label: "Game", match: (p) => p.startsWith("/rounds") || p === "/play" },
  { href: "/leaderboard", label: "Leaderboard", match: (p) => p === "/leaderboard" },
  { href: "/me", label: "Profile", match: (p) => p === "/me" },
  { href: "/admin", label: "Admin", match: (p) => p.startsWith("/admin"), adminOnly: true },
];

export function TopBar({ wallet, balance }: TopBarProps) {
  const pathname = usePathname() ?? "/";
  const { user, isAuthed } = useAuth();

  return (
    <GlassPanel
      variant="strong"
      className="pointer-events-auto absolute left-1/2 top-4 z-40 flex w-[min(960px,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-6 rounded-full px-5 py-2.5"
    >
      <Link href="/" className="flex items-center gap-2.5">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[var(--color-cyan)] to-[var(--color-magenta)] text-[10px] font-bold text-[var(--color-bg)]">
          GC
        </div>
        <span className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold tracking-wide">
          GeoCast
        </span>
      </Link>

      <nav className="hidden gap-6 text-xs uppercase tracking-[0.18em] md:flex">
        {NAV.filter((item) => !item.adminOnly || user?.isAdmin).map((item) => {
          const active = item.match(pathname);
          const isAdmin = item.adminOnly === true;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isAdmin
                  ? `${active ? "text-[var(--color-magenta)]" : "text-[var(--color-magenta)]/70"} hover:text-[var(--color-magenta)]`
                  : active
                  ? "text-white"
                  : "text-[var(--color-text-muted)] hover:text-white"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        {isAuthed && user ? (
          <>
            <div className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs sm:flex">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--color-cyan)", boxShadow: "0 0 8px var(--color-cyan)" }}
              />
              {user.creditsBalance} cr
            </div>
            <ConnectWalletButton variant="compact" />
          </>
        ) : (
          // Unauthenticated — show the demo balance/wallet placeholder + a
          // compact Connect button so the user can sign in from any screen.
          <>
            <div className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-[var(--color-text-muted)] sm:flex">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
              {balance} cr · demo
            </div>
            <ConnectWalletButton variant="compact" />
            <span className="hidden font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-[var(--color-text-muted)] lg:inline">
              {wallet}
            </span>
          </>
        )}
      </div>
    </GlassPanel>
  );
}
