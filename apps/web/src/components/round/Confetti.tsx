"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const COLORS = ["#00d4ff", "#ff006e", "#00ff88", "#ffb800", "#ffffff"];
const PARTICLE_COUNT = 38;

type Particle = {
  id: number;
  color: string;
  angle: number;
  distance: number;
  duration: number;
  delay: number;
  rotation: number;
  size: number;
};

export type ConfettiProps = {
  fire: boolean;
};

export function Confetti({ fire }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[] | null>(null);

  useEffect(() => {
    if (!fire) return;
    // Compute particles on the client only — they use Math.random.
    const seeded: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      angle: Math.random() * Math.PI * 2,
      distance: 140 + Math.random() * 220,
      duration: 1.1 + Math.random() * 0.9,
      delay: Math.random() * 0.18,
      rotation: (Math.random() - 0.5) * 720,
      size: 5 + Math.random() * 6,
    }));
    setParticles(seeded);

    const cleanup = window.setTimeout(() => setParticles(null), 2400);
    return () => window.clearTimeout(cleanup);
  }, [fire]);

  if (!particles) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 h-0 w-0">
      {particles.map((p) => {
        const dx = Math.cos(p.angle) * p.distance;
        const dy = Math.sin(p.angle) * p.distance;
        return (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
            animate={{
              x: dx,
              y: dy + 60,
              opacity: 0,
              rotate: p.rotation,
              scale: 1,
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: [0.16, 0.84, 0.44, 1],
            }}
            className="absolute rounded-sm"
            style={{
              width: p.size,
              height: p.size * 0.4,
              background: p.color,
              boxShadow: `0 0 12px ${p.color}80`,
            }}
          />
        );
      })}
    </div>
  );
}
