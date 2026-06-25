"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRecentProducts,
  rememberProduct,
  removeRecentProducts,
  type RecentProduct,
} from "@/lib/recent-products";

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

// 「最近看過」一排。兩種用法：
//  1. 商品詳情頁底部 — 傳 current，先讀出之前看過的清單顯示（自然排除當前這株），
//     再把當前這株記進去供之後別頁顯示。
//  2. 購物車空了等沒有「當前商品」的頁面 — 不傳 current，純讀取顯示、不記錄，
//     把客人帶回剛看過那幾株（空車不再是死路）。
// 整段純 client，localStorage 沒紀錄就整段不出現，不影響第一次逛店的人。
// colors 不傳就吃店面 CSS 變數（--store-*），讓沒有 theme 物件在手的 client 頁也能用。
export function RecentlyViewed({
  slug,
  current,
  colors,
  className = "mt-24",
}: {
  slug: string;
  current?: Omit<RecentProduct, "viewedAt">;
  colors?: {
    text: string;
    textMuted: string;
    accent: string;
    surface: string;
    bg: string;
  };
  className?: string;
}) {
  const [items, setItems] = useState<RecentProduct[]>([]);
  // 即時庫存（key = 商品 id）。小抄只是看過當下的快照、沒存庫存，
  // 客人回頭從這排點進去才發現沒貨會白跑。下面清死連結那次 fetch 本來就把
  // 還在架上的商品連同 stock 一起回了，順手收進來標售完／快沒貨，跟搜尋、
  // 收藏、首頁同一套庫存語言。問不到（一時連不上）就不標，不假裝有貨或沒貨。
  const [stockById, setStockById] = useState<Record<string, number>>({});

  const currentId = current?.id;
  useEffect(() => {
    const prior = getRecentProducts(slug).filter((p) => p.id !== currentId);
    setItems(prior.slice(0, 4));
    if (current) rememberProduct(slug, current);

    // 跟購物車／收藏徽章同款收斂：小抄存的只是看過當下的快照，那幾株可能已被商家下架／
    // 刪除，列出來點進去就是 404。拿這些 id 去問既有 API（只回還在且 active 的），把問
    // 不到的從這台裝置的小抄裡清掉、不再列。純讀既有 API、零 DB。安全前提沿用購物車：只有
    // API 至少回一筆時才清——整批回空可能是店家暫時整間下架或一時抓不到，那種情況寧可留著
    // 不動。當前正在看的這株沒進核對範圍（prior 已濾掉），不會被掃掉。
    const ids = prior.map((p) => p.id);
    if (ids.length === 0) return;
    let aborted = false;
    fetch(
      `/${slug}/favorites/api?ids=${encodeURIComponent(ids.join(","))}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data) => {
        if (aborted || !Array.isArray(data) || data.length === 0) return;
        // 把這次回來的即時庫存收進 map，標售完／快沒貨用（snapshot 沒這資料）。
        const stockMap: Record<string, number> = {};
        for (const d of data) {
          if (d && d.id != null && typeof d.stock === "number") {
            stockMap[String(d.id)] = d.stock;
          }
        }
        setStockById(stockMap);
        const live = new Set(data.map((d) => String(d?.id)));
        const dead = ids.filter((id) => !live.has(id));
        if (dead.length === 0) return;
        removeRecentProducts(slug, dead);
        const cleaned = getRecentProducts(slug).filter(
          (p) => p.id !== currentId
        );
        setItems(cleaned.slice(0, 4));
      })
      .catch(() => {
        // 抓不到就維持快照顯示，不清小抄——可能只是一時連不上，不該因此把看過的紀錄清光。
      });

    return () => {
      aborted = true;
    };
    // 只在切換到不同商品時跑一次（current 物件每次 render 都是新的，靠 id 收斂）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, currentId]);

  const c = colors ?? {
    text: "var(--store-text, currentColor)",
    textMuted: "var(--store-text-muted, rgba(0,0,0,0.6))",
    accent: "var(--store-accent, currentColor)",
    surface: "var(--store-surface, rgba(0,0,0,0.03))",
    bg: "var(--store-bg, transparent)",
  };

  if (items.length === 0) return null;

  return (
    <section className={className}>
      <div className="mb-14">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{ color: c.accent, letterSpacing: "0.4em" }}
        >
          Recently Viewed
        </p>
        <h2
          className="mt-4 text-2xl sm:text-3xl"
          style={{
            color: c.text,
            fontFamily: "var(--store-font)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          你最近看過
        </h2>
        <div
          className="mt-4 h-px w-10"
          style={{ background: c.accent, opacity: 0.4 }}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((p) => {
          // 庫存問到了才標：售完整列去彩＋縮圖蓋角標，快沒貨補一行琥珀「剩 N」，
          // 跟搜尋面板、收藏、首頁完全一致。stock 是 undefined（這次沒問到）就不標。
          const stock = stockById[p.id];
          const soldOut = stock === 0;
          const lowStock = !soldOut && typeof stock === "number" && stock <= 3;
          return (
          <Link
            key={p.id}
            href={`/${slug}/products/${p.id}`}
            className="group block"
            aria-label={`${p.name}，${formatPrice(p.priceCents, p.currency)}${soldOut ? "，已售完" : lowStock ? `，剩 ${stock} 件` : ""}`}
          >
            <div
              className="aspect-square rounded-2xl overflow-hidden transition relative"
              style={{
                background: c.surface,
                boxShadow: "var(--sproutly-elev-2)",
              }}
            >
              {soldOut && (
                <span
                  className="absolute inset-x-0 bottom-0 z-10 text-center py-1 text-[0.5625rem] uppercase font-medium"
                  style={{
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    letterSpacing: "0.2em",
                  }}
                >
                  售完
                </span>
              )}
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className={`w-full h-full object-cover group-hover:scale-105 transition duration-700 ${
                    soldOut ? "opacity-55 grayscale" : ""
                  }`}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: c.bg }}
                >
                  <span
                    className="text-[0.625rem] uppercase font-medium"
                    style={{
                      color: c.textMuted,
                      opacity: 0.45,
                      letterSpacing: "0.3em",
                    }}
                  >
                    No Image
                  </span>
                </div>
              )}
            </div>
            <h3
              className="mt-4 line-clamp-1 group-hover:opacity-70 transition"
              style={{
                color: c.text,
                fontFamily: "var(--store-font)",
                fontWeight: 500,
                letterSpacing: "-0.005em",
                opacity: soldOut ? 0.6 : 1,
              }}
            >
              {p.name}
            </h3>
            <p
              className="mt-1.5 text-[0.9375rem] tabular-nums"
              style={{
                color: c.accent,
                fontFamily: "var(--store-font)",
                letterSpacing: "-0.01em",
              }}
            >
              {formatPrice(p.priceCents, p.currency)}
            </p>
            {lowStock && (
              <p
                className="mt-1 text-[0.625rem] uppercase font-medium"
                style={{ color: "#92400E", letterSpacing: "0.25em" }}
              >
                Low Stock · 剩 {stock}
              </p>
            )}
          </Link>
          );
        })}
      </div>
    </section>
  );
}
