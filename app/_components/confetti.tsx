"use client";

import { useEffect, useState } from "react";

const COLORS = [
  "#5F6F52",
  "#C9A961",
  "#A8B89A",
  "#D4A36A",
  "#6B8E5A",
  "#E8D5A8",
];

type Particle = {
  id: number;
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
};

export function Confetti({ count = 60 }: { count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const items: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.6,
      duration: 2.6 + Math.random() * 1.6,
      rotate: Math.random() * 360,
      drift: (Math.random() - 0.5) * 60,
    }));
    setParticles(items);
    const t = setTimeout(() => setParticles([]), 5000);
    return () => clearTimeout(t);
  }, [count]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: "-20px",
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `sproutly-confetti ${p.duration}s cubic-bezier(0.22, 1, 0.36, 1) ${p.delay}s both`,
            ["--drift" as string]: `${p.drift}px`,
            opacity: 0.9,
          }}
        />
      ))}
      <style>{`
        @keyframes sproutly-confetti {
          0% {
            top: -20px;
            opacity: 0;
            transform: rotate(0deg) translateX(0);
          }
          10% {
            opacity: 0.9;
          }
          100% {
            top: 110%;
            opacity: 0.3;
            transform: rotate(720deg) translateX(var(--drift));
          }
        }
      `}</style>
    </div>
  );
}
