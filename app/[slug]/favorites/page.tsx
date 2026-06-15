"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RecentlyViewed } from "@/app/_components/recently-viewed";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  stock: number | null;
  image_urls: string[] | null;
};

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

const FAVORITES_KEY = "sproutly_favorites";

function readFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
  } catch {
    /* ignore */
  }
  return [];
}

export default function FavoritesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [products, setProducts] = useState<Product[] | null>(null);
  // 按 × 移除收藏原本一鍵就消失、沒退路，跟購物車一樣是 user 在意的「手滑弄掉沒復原」。
  // 暫存剛移除那株（含原本在清單裡的位置），復原時原封不動放回原處。
  const [undo, setUndo] = useState<{ product: Product; index: number } | null>(
    null
  );
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ids = readFavoriteIds();
      if (ids.length === 0) {
        if (!cancelled) setProducts([]);
        return;
      }
      const res = await fetch(
        `/${slug}/favorites/api?ids=${encodeURIComponent(ids.join(","))}`,
        { cache: "no-store" }
      );
      const data: Product[] = await res.json();
      // API 用 .in("id", ids) 查，回來的順序是資料庫隨機序、不照 ids 走，
      // 害收藏卡片每次載入排序都不一樣，也跟客人實際收藏的先後對不上。
      // 更要緊的是：移除的「復原」記的是卡片在畫面上的 index、卻 splice 回
      // localStorage 陣列那個位置——畫面序 ≠ 儲存序時就會放回錯的地方。
      // 這裡先照 ids（= localStorage 收藏順序）把結果排回去，兩邊對齊。
      const order = new Map(ids.map((id, i) => [id, i]));
      const ordered = [...data].sort(
        (a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity)
      );
      if (!cancelled) setProducts(ordered);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 別處（商品頁愛心、其他分頁）取消收藏時，這頁即時跟著移除，不用重整
  useEffect(() => {
    const sync = () => {
      const favs = new Set(readFavoriteIds());
      setProducts((prev) => (prev ? prev.filter((p) => favs.has(p.id)) : prev));
    };
    window.addEventListener("sproutly-favorites-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sproutly-favorites-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function removeFavorite(product: Product, index: number) {
    try {
      const next = readFavoriteIds().filter((x) => x !== product.id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      // 通知 nav 收藏數與其他分頁；本頁的 sync effect 也會接到並移除卡片
      window.dispatchEvent(new Event("sproutly-favorites-changed"));
    } catch {
      /* ignore */
    }
    // 記住剛移除那株與原位置，6 秒內可一鍵放回
    setUndo({ product, index });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  }

  function handleUndo() {
    if (!undo) return;
    try {
      // 把 id 放回原本在清單裡的位置，再復原卡片，最後通知 nav 收藏數回升
      const ids = readFavoriteIds().filter((x) => x !== undo.product.id);
      ids.splice(undo.index, 0, undo.product.id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
      setProducts((prev) => {
        if (!prev) return prev;
        if (prev.some((p) => p.id === undo.product.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(undo.index, next.length), 0, undo.product);
        return next;
      });
      window.dispatchEvent(new Event("sproutly-favorites-changed"));
    } catch {
      /* ignore */
    }
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
  }

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const count = products?.length ?? 0;
  // 收藏是「想留下來慢慢看」，常擱一陣子才回來——這段時間裡有的可能已經被買走。
  // 先在標題就點出有幾株沒了，客人不必一張張點進去才發現白收藏一場。
  const soldOutCount =
    products?.filter((p) => p.stock !== null && p.stock === 0).length ?? 0;

  return (
    <main className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <header className="mb-16 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.4em",
          }}
        >
          Wishlist
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          我的收藏
        </h1>
        <div
          className="mt-5 h-px w-12"
          style={{
            background: "var(--store-accent, currentColor)",
            opacity: 0.5,
          }}
        />
        <p
          className="mt-5 text-[0.9375rem]"
          style={{
            color: "var(--store-text-muted, rgba(0,0,0,0.6))",
            lineHeight: 1.7,
          }}
        >
          {products === null
            ? "整理中⋯"
            : count === 0
            ? "這裡會放你想留下來慢慢看的植物"
            : soldOutCount > 0
            ? `${count} 株植物在等你 · 其中 ${soldOutCount} 株已售完`
            : `${count} 株植物在等你`}
        </p>
      </header>

      {products === null ? (
        <div
          className="grid grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-16"
          aria-hidden
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="opacity-50">
              <div
                className="aspect-square rounded-2xl"
                style={{
                  background:
                    "var(--store-surface, rgba(0,0,0,0.04))",
                }}
              />
              <div
                className="mt-5 h-4 w-3/4 rounded"
                style={{
                  background:
                    "var(--store-surface, rgba(0,0,0,0.04))",
                }}
              />
              <div
                className="mt-2 h-3 w-1/3 rounded"
                style={{
                  background:
                    "var(--store-surface, rgba(0,0,0,0.04))",
                }}
              />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <>
        <div className="py-16 max-w-md">
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{
              color: "var(--store-accent, currentColor)",
              letterSpacing: "0.4em",
            }}
          >
            Empty
          </p>
          <div
            className="mt-5 h-px w-10"
            style={{
              background: "var(--store-accent, currentColor)",
              opacity: 0.4,
            }}
          />
          <p
            className="mt-6 text-2xl sm:text-3xl font-medium"
            style={{
              fontFamily: "var(--store-font)",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            還沒有
            <br />
            收藏的植物
          </p>
          <p
            className="mt-5 text-[0.9375rem]"
            style={{
              color: "var(--store-text-muted, rgba(0,0,0,0.6))",
              lineHeight: 1.7,
            }}
          >
            逛逛 shop，遇到想留下來慢慢看的，按愛心收進這裡。
          </p>
          <Link
            href={`/${slug}/shop`}
            className="sproutly-link mt-10 inline-block text-[0.75rem] uppercase font-medium"
            style={{ letterSpacing: "0.3em" }}
            data-default-line="true"
          >
            去逛逛 →
          </Link>
        </div>
        {/* 還沒收藏不是死路：把這台裝置剛看過的幾株帶回來，客人想起「剛剛那株」
            可直接點回去再按愛心收藏。跟購物車空狀態、shop 搜不到時同一套用法
            （讀取模式：不傳 current 純讀取不記錄、不傳 colors 吃店面 --store-* 變數）。
            沒看過紀錄就整段不出現（元件自判），第一次逛店的人不受影響。
            放在 max-w-md 文字塊外，讓商品網格用整個容器寬度。 */}
        <RecentlyViewed slug={slug} className="mt-8" />
        </>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-16">
          {products.map((p, i) => {
            const soldOut = p.stock !== null && p.stock === 0;
            return (
            <Link
              key={p.id}
              href={`/${slug}/products/${p.id}`}
              className="sproutly-card"
            >
              <div className="sproutly-card-image aspect-square relative">
                {/* 售完的去彩壓暗 + 角落標記，跟 shop 頁同一套語言，
                    收藏一打開就看得出哪幾株沒了，不必點進去才知道。 */}
                {soldOut && (
                  <span
                    className="absolute left-3 top-3 z-10 px-2.5 py-1 rounded-full text-[0.625rem] uppercase font-medium backdrop-blur-sm"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      letterSpacing: "0.2em",
                    }}
                  >
                    售完
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFavorite(p, i);
                  }}
                  aria-label={`從收藏移除 ${p.name}`}
                  title="從收藏移除"
                  className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-stone-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-stone-900 active:scale-90"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
                {p.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_urls[0]}
                    alt={p.name}
                    className={`w-full h-full object-cover transition ${
                      soldOut ? "opacity-55 grayscale" : ""
                    }`}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background:
                        "var(--store-surface, rgba(0,0,0,0.04))",
                    }}
                  >
                    <span
                      className="text-[0.6875rem] uppercase"
                      style={{ opacity: 0.4, letterSpacing: "0.4em" }}
                    >
                      No Image
                    </span>
                  </div>
                )}
              </div>
              <h3
                className="sproutly-card-title mt-5 text-base line-clamp-1"
                style={{ fontFamily: "var(--store-font)", fontWeight: 400 }}
              >
                {p.name}
              </h3>
              <p
                className="sproutly-card-meta mt-1 text-sm"
                style={{
                  color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                }}
              >
                {formatPrice(p.price_cents, p.currency)}
              </p>
              {/* 售完已由圖上角標表達，這裡只留琥珀色「剩 N」提示快沒貨，
                  跟 shop 頁、商品詳情頁一致。 */}
              {!soldOut && p.stock !== null && p.stock <= 3 ? (
                <p
                  className="mt-1 text-[0.6875rem] uppercase font-medium"
                  style={{
                    color: "#92400E",
                    letterSpacing: "0.3em",
                  }}
                >
                  Low Stock · 剩 {p.stock}
                </p>
              ) : null}
            </Link>
            );
          })}
        </div>
      )}

      {undo && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6 pointer-events-none"
        >
          <div
            className="pointer-events-auto flex items-center gap-4 rounded-full pl-5 pr-2 py-2 shadow-lg max-w-[calc(100vw-3rem)]"
            style={{
              background: "var(--store-text, #1a1a1a)",
              color: "var(--store-bg, #fff)",
            }}
          >
            <span className="text-sm truncate">
              已移除「{undo.product.name}」
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="flex-shrink-0 rounded-full px-4 py-1.5 text-[0.6875rem] uppercase font-medium transition hover:opacity-80"
              style={{
                letterSpacing: "0.2em",
                background: "var(--store-accent, currentColor)",
                color: "var(--store-bg, #fff)",
              }}
            >
              復原
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
