"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

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

// 使用者有開「減少動態效果」就不撒；進頁後不會變，不用訂閱任何事件。
function subscribeNothing() {
  return () => {};
}

function readShouldPlay() {
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.6,
    duration: 2.6 + Math.random() * 1.6,
    rotate: Math.random() * 360,
    drift: (Math.random() - 0.5) * 60,
  }));
}

export function Confetti({ count = 60 }: { count?: number }) {
  // 以前在 useEffect 裡產生粒子再 setState，等於掛載後多重畫一次（eslint
  // set-state-in-effect 擋的就是這個）。改成：粒子在第一次畫時就備好，
  // 要不要撒用 useSyncExternalStore 現讀；伺服器端與剛接手畫面那一下回 false，
  // 什麼都不畫，隨機數不會跟伺服器那份對不上。
  const [particles] = useState(() => makeParticles(count));
  const shouldPlay = useSyncExternalStore(
    subscribeNothing,
    readShouldPlay,
    () => false,
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!shouldPlay) return;
    const t = setTimeout(() => setDone(true), 5000);
    return () => clearTimeout(t);
  }, [shouldPlay]);

  if (!shouldPlay || done) return null;

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
