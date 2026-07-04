"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RecentlyViewed } from "@/app/_components/recently-viewed";
import { StoreEmptyState } from "@/app/_components/store-empty-state";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  stock: number | null;
  image_urls: string[] | null;
};

import { formatPrice } from "@/lib/format-price";
import { isSoldOut, isLowStock, stockAriaSuffix } from "@/lib/product-stock";

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
  // 收藏 id 存在 localStorage，fetch 只是去補商品的名稱/價格/圖。原本沒有任何
  // 錯誤處理：網路一閃失 res.json() 一丟錯，load() 就靜靜 reject，products 永遠
  // 停在 null → 整頁卡在「整理中⋯」骨架不動，客人以為收藏壞了，其實資料還在身上。
  // 用 failed 標記讀取失敗、改顯示「沒不見、重試一下」的退路；reloadKey 讓重試鈕
  // 重跑 effect。
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
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
      try {
        const res = await fetch(
          `/${slug}/favorites/api?ids=${encodeURIComponent(ids.join(","))}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`favorites api ${res.status}`);
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
        // 收藏的某株被商家下架／刪除後，API 不再回它：這頁看不到（只 map 撈回來的），
        // 但 id 還留在 localStorage，nav 那顆愛心徽章（FavoritesCounter 讀 localStorage
        // 的 size）仍把這些看不到的幽靈算進去——徽章數字比實際顯示的多，客人一頭霧水卻
        // 找不到地方清。抓回資料的當下順手把對不上的 id 清掉，讓徽章跟收藏內容一致，並
        // 通知 nav 與其他分頁更新。安全前提同購物車：只有在「至少撈回一株」時才清——整批
        // 回空可能是店家暫時整間下架或一時抓不到（API 對未發布店面也回空陣列），那種情況
        // 寧可留著不動，免得把整批有效收藏清光。
        if (!cancelled && data.length > 0) {
          const returnedIds = new Set(data.map((p) => p.id));
          const stored = readFavoriteIds();
          const cleaned = stored.filter((id) => returnedIds.has(id));
          if (cleaned.length !== stored.length) {
            try {
              localStorage.setItem(FAVORITES_KEY, JSON.stringify(cleaned));
              window.dispatchEvent(new Event("sproutly-favorites-changed"));
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        // 讀失敗就掛 failed、別讓 products 停在 null 整頁卡骨架；
        // 收藏 id 還在 localStorage，沒有不見，給重試退路即可。
        if (!cancelled) setFailed(true);
      }
    }
    setFailed(false);
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

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
    startUndoTimer();
  }

  // 6 秒自動收掉復原提示；但滑到 / 用鍵盤 focus 到提示上時先停錶（離開再重新計時），
  // 免得客人正讀提示、或正用 Tab 往「復原」鈕移動時，倒數就把唯一的退路收走了。
  function startUndoTimer() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  }

  function pauseUndoTimer() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
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
    products?.filter((p) => isSoldOut(p.stock)).length ?? 0;

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
          {failed
            ? "暫時讀不到你的收藏"
            : products === null
            ? "整理中⋯"
            : count === 0
            ? "這裡會放你想留下來慢慢看的植物"
            : soldOutCount > 0
            ? `${count} 株植物在等你 · 其中 ${soldOutCount} 株已售完`
            : `${count} 株植物在等你`}
        </p>
      </header>

      {failed ? (
        // 讀取失敗：收藏 id 還在身上，沒不見，給一條「重試」退路而不是卡骨架。
        <div className="py-16 max-w-md">
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{
              color: "var(--store-accent, currentColor)",
              letterSpacing: "0.4em",
            }}
          >
            Offline · 讀取失敗
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
            暫時
            <br />
            讀不到收藏
          </p>
          <p
            className="mt-5 text-[0.9375rem]"
            style={{
              color: "var(--store-text-muted, rgba(0,0,0,0.6))",
              lineHeight: 1.7,
            }}
          >
            可能是網路不太穩。你收藏的植物沒有不見，
            <br />
            重新整理一下再試一次。
          </p>
          <button
            type="button"
            onClick={() => {
              setProducts(null);
              setReloadKey((k) => k + 1);
            }}
            className="sproutly-link mt-10 inline-block text-[0.75rem] uppercase font-medium"
            style={{ letterSpacing: "0.3em" }}
            data-default-line="true"
          >
            重新整理 →
          </button>
        </div>
      ) : products === null ? (
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
        <StoreEmptyState
          title={
            <>
              還沒有
              <br />
              收藏的植物
            </>
          }
          description="逛逛 shop，遇到想留下來慢慢看的，按愛心收進這裡。"
        >
          <Link
            href={`/${slug}/shop`}
            className="sproutly-link mt-10 inline-block text-[0.75rem] uppercase font-medium"
            style={{ letterSpacing: "0.3em" }}
            data-default-line="true"
          >
            去逛逛 →
          </Link>
        </StoreEmptyState>
        {/* 還沒收藏不是死路：把這台裝置剛看過的幾株帶回來，客人想起「剛剛那株」
            可直接點回去再按愛心收藏。跟購物車空狀態、shop 搜不到時同一套用法
            （讀取模式：不傳 current 純讀取不記錄、不傳 colors 吃店面 --store-* 變數）。
            沒看過紀錄就整段不出現（元件自判），第一次逛店的人不受影響。
            放在 max-w-md 文字塊外，讓商品網格用整個容器寬度。 */}
        <RecentlyViewed slug={slug} className="mt-8" />
        </>
      ) : (
        <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-16">
          {products.map((p, i) => {
            const soldOut = isSoldOut(p.stock);
            return (
            <Link
              key={p.id}
              href={`/${slug}/products/${p.id}`}
              className="sproutly-card"
              aria-label={`${p.name}，${formatPrice(p.price_cents, p.currency)}${stockAriaSuffix(p.stock)}`}
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
                    loading="lazy"
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
              {isLowStock(p.stock) ? (
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
        {/* 看完收藏的這幾株、想再挑更多時，這頁本來到底就斷了，只能捲回最上面的導覽找商品。
            沿用購物車有貨時、關於／聯絡頁、以及這頁空狀態同一套低調「繼續逛」連結，補一條
            往全部商品的去路——收藏有東西的這個分支，是 storefront 唯一還沒接上「每頁都有下一步」的地方。 */}
        <div className="mt-16 text-center">
          <Link
            href={`/${slug}/shop`}
            className="sproutly-link inline-block text-[0.75rem] uppercase font-medium"
            style={{ letterSpacing: "0.3em" }}
            data-default-line="true"
          >
            ← 繼續逛 shop
          </Link>
        </div>
        </>
      )}

      {undo && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6 pointer-events-none"
        >
          <div
            onMouseEnter={pauseUndoTimer}
            onMouseLeave={startUndoTimer}
            onFocus={pauseUndoTimer}
            onBlur={startUndoTimer}
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
