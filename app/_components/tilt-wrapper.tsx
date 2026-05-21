"use client";

import { useRef } from "react";

/**
 * 3D tilt hover：根據滑鼠在卡片上的位置給卡片 rotateX / rotateY
 * 純前端，subtle、克制（max 4 度），尊重 prefers-reduced-motion
 */
export function TiltWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotY = (x - 0.5) * 6; // -3 ~ +3 度
    const rotX = (0.5 - y) * 6;
    el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{
        transition: "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
