"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  image_urls: string[] | null;
  stock: number | null;
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
        return;
      }
      if (!open) return;
      // 用注音／拼音等輸入法選字時，Enter 是拿來確認候選字、上下鍵是換候選字的，
      // 不能被當成「開啟商品 / 移動選取」——否則台灣客人一打中文就被導去第一個結果。
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        // 結果清單底下那條「在商品頁搜尋」橋接也算最後一個可選項（索引 = results.length），
        // 鍵盤往下能停在它身上，不必摸滑鼠才點得到。
        const maxIdx = results.length > 0 ? results.length : 0;
        setSelectedIdx((i) => Math.min(i + 1, maxIdx));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        // 反白在商品上就開商品；停在最後那條橋、或搜不到時的空狀態，都帶去 /shop
        // 完整列表（有字帶 ?q= 可排序篩庫存，沒結果就純逛全部），鍵盤族不再卡在面板裡。
        const query = q.trim();
        if (selectedIdx < results.length && results[selectedIdx]) {
          window.location.href = `/${slug}/products/${results[selectedIdx].id}`;
        } else if (query) {
          window.location.href =
            results.length > 0
              ? `/${slug}/shop?q=${encodeURIComponent(query)}`
              : `/${slug}/shop`;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selectedIdx, slug, q]);

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
                    換個字試試，或看看店裡其他商品
                  </p>
                  {/* 這個快搜面板搜不到時原本只剩一句話、點不了任何東西，客人得自己
                      關掉再找入口。給一條去全部商品頁的去路，跟其他頁面的空狀態一致。 */}
                  <Link
                    href={`/${slug}/shop`}
                    onClick={() => setOpen(false)}
                    className="sproutly-link mt-6 inline-block font-medium uppercase"
                    data-default-line="true"
                    style={{
                      fontSize: "0.75rem",
                      letterSpacing: "0.3em",
                      color: "var(--store-accent, currentColor)",
                    }}
                  >
                    看全部商品 →
                  </Link>
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
              {results.map((p, i) => {
                // 跟首頁、收藏、商品頁同一套庫存語言：搜尋是逛商品的入口之一，
                // 客人搜到一株、點進去才發現沒了會白跑。售完整列去彩、縮圖蓋角標，
                // 快沒貨補一行琥珀色「剩 N」。
                const soldOut = p.stock !== null && p.stock === 0;
                const lowStock = !soldOut && p.stock !== null && p.stock <= 3;
                return (
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
                    className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative"
                    style={{
                      background: "var(--store-surface, rgba(0,0,0,0.04))",
                      border:
                        "1px solid var(--store-border, rgba(0,0,0,0.06))",
                    }}
                  >
                    {soldOut && (
                      <span
                        className="absolute inset-x-0 bottom-0 z-10 text-center py-0.5 text-[0.5rem] uppercase font-medium"
                        style={{
                          background: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          letterSpacing: "0.15em",
                        }}
                      >
                        售完
                      </span>
                    )}
                    {p.image_urls?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_urls[0]}
                        alt={p.name}
                        className={`w-full h-full object-cover ${
                          soldOut ? "opacity-55 grayscale" : ""
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{
                        color: "var(--store-text, #1a1a1a)",
                        letterSpacing: "-0.005em",
                        opacity: soldOut ? 0.6 : 1,
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
                    {lowStock && (
                      <p
                        className="mt-0.5 text-[0.625rem] uppercase font-medium"
                        style={{
                          color: "#92400E",
                          letterSpacing: "0.25em",
                        }}
                      >
                        Low Stock · 剩 {p.stock}
                      </p>
                    )}
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
                );
              })}
              {/* 這個快搜 API 只回前 10 筆（route.ts），搜到熱門關鍵字時後面的會被
                  默默截掉、客人在面板裡看不到也搆不著。商品頁的 ?q= 是同一套搜尋、
                  且能排序＋只看有貨——給一條過去的橋，把快搜接上能篩選的完整列表。 */}
              {!loading && results.length > 0 && (
                <Link
                  href={`/${slug}/shop?q=${encodeURIComponent(q.trim())}`}
                  onClick={() => setOpen(false)}
                  // 索引接在所有商品之後（= results.length），鍵盤往下能停在它身上、
                  // Enter 直接過去；滑鼠移上去也跟商品列一樣反白，兩種操作一致。
                  data-result-idx={results.length}
                  onMouseEnter={() => setSelectedIdx(results.length)}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:opacity-70"
                  style={{
                    borderTop:
                      "1px solid var(--store-border, rgba(0,0,0,0.08))",
                    color: "var(--store-accent, currentColor)",
                    background:
                      selectedIdx === results.length
                        ? "var(--store-surface, rgba(0,0,0,0.04))"
                        : "transparent",
                  }}
                >
                  <span
                    className="font-medium uppercase truncate"
                    style={{ fontSize: "0.6875rem", letterSpacing: "0.25em" }}
                  >
                    在商品頁搜尋「{q.trim()}」· 可排序、篩庫存
                  </span>
                  <span
                    aria-hidden
                    className="flex-shrink-0"
                    style={{ fontSize: "0.875rem" }}
                  >
                    →
                  </span>
                </Link>
              )}
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
