import { GlassPanel } from "@/components/ui/GlassPanel";

export type StatCardProps = {
  label: string;
  value: React.ReactNode;
  unit?: string;
  accent?: "cyan" | "magenta" | "green" | "amber";
  hint?: string;
};

const ACCENT_COLOR: Record<NonNullable<StatCardProps["accent"]>, string> = {
  cyan: "var(--color-cyan)",
  magenta: "var(--color-magenta)",
  green: "var(--color-green)",
  amber: "var(--color-amber)",
};

export function StatCard({ label, value, unit, accent, hint }: StatCardProps) {
  return (
    <GlassPanel className="p-4">
      <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="flex items-baseline gap-1.5 font-[family-name:var(--font-jetbrains-mono)] text-2xl font-semibold tabular-nums leading-none">
        <span style={{ color: accent ? ACCENT_COLOR[accent] : "var(--color-text)" }}>
          {value}
        </span>
        {unit && (
          <span className="text-xs font-normal text-[var(--color-text-muted)]">{unit}</span>
        )}
      </p>
      {hint && (
        <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">{hint}</p>
      )}
    </GlassPanel>
  );
}
