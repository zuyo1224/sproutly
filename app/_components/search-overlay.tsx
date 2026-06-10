"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  image_urls: string[] | null;
};

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export function SearchOverlay({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      } else if (open && e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (open && e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (open && e.key === "Enter" && results[selectedIdx]) {
        window.location.href = `/${slug}/products/${results[selectedIdx].id}`;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selectedIdx, slug]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
      setQ("");
      setResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // 鍵盤上下移動時，把目前選到的結果捲進可視範圍（結果多到超出清單高度時才不會選到看不見的項目）
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(
      `[data-result-idx="${selectedIdx}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx, open]);

  useEffect(() => {
    if (!open || !q.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/${slug}/search/api?q=${encodeURIComponent(q.trim())}`,
          { cache: "no-store" }
        );
        const data: Product[] = await res.json();
        if (!cancelled) {
          setResults(data);
          setSelectedIdx(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200); // debounce
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, slug, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="搜尋"
        className="inline-flex items-center gap-2 transition hover:opacity-70"
        style={{ color: "inherit" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <span
          className="hidden sm:inline font-medium uppercase"
          style={{
            fontSize: "0.6875rem",
            letterSpacing: "0.3em",
            opacity: 0.7,
          }}
        >
          ⌘ K
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
          style={{ animation: "sproutly-search-fade 0.25s ease-out both" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="搜尋商品"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation:
                "sproutly-search-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
              background: "var(--store-bg, #ffffff)",
              color: "var(--store-text, #1a1a1a)",
              border: "1px solid var(--store-border, rgba(0,0,0,0.08))",
              boxShadow: "var(--sproutly-elev-4)",
            }}
          >
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{
                borderBottom: "1px solid var(--store-border, rgba(0,0,0,0.08))",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="flex-shrink-0"
                style={{ opacity: 0.55 }}
              >
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜尋商品⋯"
                aria-label="搜尋商品名稱"
                className="flex-1 outline-none bg-transparent"
                style={{
                  fontSize: "1rem",
                  color: "var(--store-text, #1a1a1a)",
                  caretColor: "var(--store-accent, currentColor)",
                }}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-medium uppercase transition hover:opacity-100"
                style={{
                  fontSize: "0.6875rem",
                  letterSpacing: "0.3em",
                  color: "var(--store-text-muted, rgba(0,0,0,0.55))",
                  opacity: 0.75,
                }}
                aria-label="關閉搜尋"
              >
                Esc
              </button>
            </div>
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
              {loading && (
                <div className="px-5 py-10 text-center">
                  <p
                    className="font-medium uppercase"
                    style={{
                      fontSize: "0.6875rem",
                      letterSpacing: "0.4em",
                      color: "var(--store-text-muted, rgba(0,0,0,0.55))",
                    }}
                  >
                    Searching · 搜尋中
                  </p>
                  <div
                    className="mx-auto mt-3 h-px w-10"
                    style={{
                      background: "var(--store-accent, currentColor)",
                      opacity: 0.6,
                    }}
                  />
                </div>
              )}
              {!loading && q && results.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <p
                    className="font-medium uppercase"
                    style={{
                      fontSize: "0.6875rem",
                      letterSpacing: "0.4em",
                      color: "var(--store-text-muted, rgba(0,0,0,0.55))",
                    }}
                  >
                    No Match · 沒有結果
                  </p>
                  <div
                    className="mx-auto mt-3 h-px w-10"
                    style={{
                      background: "var(--store-accent, currentColor)",
                      opacity: 0.6,
                    }}
                  />
                  <p
                    className="mt-4"
                    style={{
                      fontSize: "0.9375rem",
                      lineHeight: 1.7,
                      color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                    }}
                  >
                    換個字試試，或回首頁逛逛
                  </p>
                </div>
              )}
              {!loading && !q && (
                <div className="px-5 py-10 text-center">
                  <p
                    className="font-medium uppercase"
                    style={{
                      fontSize: "0.6875rem",
                      letterSpacing: "0.4em",
                      color: "var(--store-text-muted, rgba(0,0,0,0.55))",
                    }}
                  >
                    Search · 商品名或關鍵字
                  </p>
                  <div
                    className="mx-auto mt-3 h-px w-10"
                    style={{
                      background: "var(--store-accent, currentColor)",
                      opacity: 0.6,
                    }}
                  />
                  <p
                    className="mt-4 font-medium uppercase"
                    style={{
                      fontSize: "0.6875rem",
                      letterSpacing: "0.3em",
                      color: "var(--store-text-muted, rgba(0,0,0,0.5))",
                    }}
                  >
                    ↑↓ 選擇 · ↵ 開啟
                  </p>
                </div>
              )}
              {results.map((p, i) => (
                <Link
                  key={p.id}
                  data-result-idx={i}
                  href={`/${slug}/products/${p.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-4 px-5 py-3 transition"
                  style={{
                    background:
                      i === selectedIdx
                        ? "var(--store-surface, rgba(0,0,0,0.04))"
                        : "transparent",
                  }}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <div
                    className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
                    style={{
                      background: "var(--store-surface, rgba(0,0,0,0.04))",
                      border:
                        "1px solid var(--store-border, rgba(0,0,0,0.06))",
                    }}
                  >
                    {p.image_urls?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_urls[0]}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{
                        color: "var(--store-text, #1a1a1a)",
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {p.name}
                    </p>
                    <p
                      className="mt-0.5 tabular-nums"
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--store-text-muted, rgba(0,0,0,0.55))",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {formatPrice(p.price_cents, p.currency)}
                    </p>
                  </div>
                  {i === selectedIdx && (
                    <span
                      className="font-medium uppercase"
                      style={{
                        fontSize: "0.6875rem",
                        letterSpacing: "0.3em",
                        color: "var(--store-accent, currentColor)",
                        opacity: 0.85,
                      }}
                    >
                      ↵
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
          <style>{`
            @keyframes sproutly-search-fade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes sproutly-search-pop {
              from { opacity: 0; transform: translateY(-12px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
