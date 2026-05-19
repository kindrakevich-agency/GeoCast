import Link from "next/link";

export default function Home() {
  return (
    <main className="relative grid h-screen w-screen place-items-center bg-[var(--color-bg)] px-6 text-center">
      <div className="glass max-w-xl rounded-[var(--radius-xl)] p-10">
        <p className="mb-3 text-xs uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          Portfolio prototype · 2026
        </p>
        <h1
          className="mb-2 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold tracking-tight text-glow-cyan"
          style={{ color: "var(--color-cyan)" }}
        >
          GeoCast
        </h1>
        <p className="mb-8 text-lg text-[var(--color-text-muted)]">
          Drop a pin. Predict the world.
        </p>
        <Link
          href="/rounds/demo"
          className="inline-flex items-center justify-center rounded-[var(--radius)] px-6 py-3 font-medium text-[var(--color-bg)] ring-glow-cyan transition-transform hover:scale-[1.02]"
          style={{ background: "var(--color-cyan)" }}
        >
          Enter Active Round →
        </Link>
        <p className="mt-6 text-xs text-[var(--color-text-muted)]">
          Landing + auth coming next. For now, the active round is the
          showcase.
        </p>
      </div>
    </main>
  );
}
