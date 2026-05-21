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
        className="inline-flex items-center gap-2 text-sm transition hover:opacity-70"
        style={{ color: "inherit" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <span className="hidden sm:inline text-xs tracking-wider opacity-70">⌘ K</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
          style={{ animation: "sproutly-search-fade 0.25s ease-out both" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "sproutly-search-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1) both" }}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 flex-shrink-0">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜尋植物..."
                className="flex-1 text-base outline-none bg-transparent"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-stone-400 tracking-widest uppercase hover:text-stone-700 transition"
              >
                Esc
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading && (
                <p className="px-5 py-8 text-sm text-stone-400 text-center">
                  搜尋中...
                </p>
              )}
              {!loading && q && results.length === 0 && (
                <p className="px-5 py-8 text-sm text-stone-400 text-center">
                  找不到相關植物
                </p>
              )}
              {!loading && !q && (
                <p className="px-5 py-8 text-xs tracking-wider uppercase text-stone-400 text-center">
                  輸入名字搜尋 · ↑↓ 選擇 · Enter 開啟
                </p>
              )}
              {results.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/${slug}/products/${p.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-4 px-5 py-3 transition ${
                    i === selectedIdx ? "bg-stone-100" : "hover:bg-stone-50"
                  }`}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
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
                    <p className="text-stone-900 truncate">{p.name}</p>
                    <p className="text-sm text-stone-500">
                      {formatPrice(p.price_cents, p.currency)}
                    </p>
                  </div>
                  {i === selectedIdx && (
                    <span className="text-xs text-stone-400 tracking-widest uppercase">
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
