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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

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
      // 燈箱沒開時方向鍵是全域監聽——別搶走正在打字 / 聚焦表單欄位
      // （例如 Cmd+K 搜尋框）的方向鍵，否則背後商品照會被默默翻頁
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
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

  // 燈箱是 modal（role="dialog" aria-modal）——aria-modal 本身不會把鍵盤焦點關進來，
  // 要自己處理：開啟時把焦點移進燈箱、Tab 在燈箱內循環不溜到背後的翻頁鈕、關閉後把
  // 焦點還給原本點開的那張照片，鍵盤使用者才不會迷失在被 aria-hidden 的背景裡
  useEffect(() => {
    if (!lightboxOpen) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () =>
      dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button, [href], [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];
    focusables()[0]?.focus();

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onTab);
    return () => {
      window.removeEventListener("keydown", onTab);
      lastFocusedRef.current?.focus?.();
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
      {/* 方向鍵翻照片時，畫面默默換圖（內嵌只有視覺計數器、燈箱連計數器都沒有），
          報讀器使用者聽不出翻到第幾張——補一條 sr-only live 區域，idx 一變就念位置。
          內嵌與燈箱共用同一個 idx，兩種狀態都覆蓋；單張時不會有翻頁故不念 */}
      {total > 1 && (
        <span className="sr-only" role="status" aria-live="polite">
          {`第 ${idx + 1} 張，共 ${total} 張`}
        </span>
      )}
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
            onKeyDown={
              i === idx
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLightboxOpen(true);
                    }
                  }
                : undefined
            }
            role="button"
            tabIndex={i === idx ? 0 : -1}
            aria-label={`放大檢視：${alt} ${i + 1}`}
            aria-hidden={i === idx ? undefined : true}
            className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
            style={{
              opacity: i === idx ? 1 : 0,
              transition: "opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            // 多張照片是疊在一起、靠 opacity 切換，全都在畫面內，所以全部會同時下載、
            // 一起搶頻寬。第一張是客人一開頁就看到的主圖（商品頁最大那張），把它調高、
            // 其餘調低，瀏覽器就先把主圖載出來，不會被後面幾張照片拖慢。
            fetchPriority={i === 0 ? "high" : "low"}
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
                  aria-label={`第 ${i + 1} 張，共 ${total} 張`}
                  aria-current={i === idx ? "true" : undefined}
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
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} 放大檢視`}
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
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/80 hover:text-white text-sm tracking-widest"
            aria-label="關閉"
          >
            關閉
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
