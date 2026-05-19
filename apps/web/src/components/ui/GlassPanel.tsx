import { cn } from "@/lib/cn";
import { forwardRef, type HTMLAttributes } from "react";

export type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "strong";
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel({ className, variant = "default", ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          variant === "strong" ? "glass-strong" : "glass",
          "rounded-[var(--radius-lg)]",
          className,
        )}
        {...rest}
      />
    );
  },
);
