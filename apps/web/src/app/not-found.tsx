import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative grid h-screen w-screen place-items-center bg-[var(--color-bg)] px-6 text-center">
      <div className="glass max-w-md rounded-[var(--radius-xl)] p-10">
        <p className="mb-3 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
          404 · pin not found
        </p>
        <h1
          className="mb-2 font-[family-name:var(--font-space-grotesk)] text-5xl font-bold tracking-tight text-glow-magenta"
          style={{ color: "var(--color-magenta)" }}
        >
          Off the map
        </h1>
        <p className="mb-8 text-sm text-[var(--color-text-muted)]">
          The coordinates you dropped landed somewhere that doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-[var(--radius)] px-5 py-2.5 text-sm font-medium text-[var(--color-bg)] ring-glow-cyan transition-transform hover:scale-[1.02]"
          style={{ background: "var(--color-cyan)" }}
        >
          Back to the world
        </Link>
      </div>
    </main>
  );
}
