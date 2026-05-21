"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Props = {
  images: string[];
  alt: string;
  surfaceBg: string;
};

export function ImageCarousel({ images, alt, surfaceBg }: Props) {
  const [idx, setIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const total = images.length;
  const next = useCallback(
    () => setIdx((i) => (i + 1) % total),
    [total]
  );
  const prev = useCallback(
    () => setIdx((i) => (i - 1 + total) % total),
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightboxOpen) {
        if (e.key === "Escape") setLightboxOpen(false);
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
        return;
      }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, prev, next]);

  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0) prev();
      else next();
    }
    touchStartX.current = null;
  }

  return (
    <>
      <div
        className="relative aspect-square rounded-3xl overflow-hidden shadow-sm select-none"
        style={{ background: surfaceBg }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {images.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url + i}
            src={url}
            alt={`${alt} ${i + 1}`}
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
            style={{
              opacity: i === idx ? 1 : 0,
              transition: "opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            draggable={false}
          />
        ))}

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="上一張"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 backdrop-blur text-stone-900 flex items-center justify-center hover:bg-white transition shadow-md"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="下一張"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 backdrop-blur text-stone-900 flex items-center justify-center hover:bg-white transition shadow-md"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`第 ${i + 1} 張`}
                  className="transition"
                  style={{
                    width: i === idx ? 24 : 6,
                    height: 6,
                    borderRadius: 3,
                    background: i === idx ? "#fff" : "rgba(255,255,255,0.5)",
                  }}
                />
              ))}
            </div>
            <div className="absolute top-4 right-4 bg-white/80 backdrop-blur text-stone-900 text-xs px-2 py-1 rounded-full">
              {idx + 1} / {total}
            </div>
          </>
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8 backdrop-blur-sm cursor-zoom-out"
          style={{ animation: "sproutly-lb-fade 0.4s ease-out both" }}
          onClick={() => setLightboxOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[idx]}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="上一張"
                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="下一張"
                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/80 hover:text-white text-sm tracking-widest uppercase"
            aria-label="Close"
          >
            Close
          </button>
          <style>{`
            @keyframes sproutly-lb-fade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
