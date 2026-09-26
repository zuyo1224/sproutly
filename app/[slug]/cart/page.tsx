"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getCart, updateQty, removeFromCart, addToCart } from "@/lib/cart";
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
import { isSoldOut, maxSelectableQty } from "@/lib/product-stock";
import { fetchProductsByIds } from "@/lib/fetch-products-by-ids";
import { displayableImageUrls } from "@/lib/image-url";

export default function CartPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [products, setProducts] = useState<Product[] | null>(null);
  // 車裡的商品 id／數量都存在 localStorage，fetch 只是去補名稱/價格/庫存/圖。原本
  // load() 對 fetch 零錯誤處理：網路一閃失或 API 回 500/非陣列，res.json() 一丟錯就
  // 靜靜 reject，products 永遠停在 null → 整頁卡在「整理中⋯」骨架、到不了結帳，客人
  // 以為購物車壞了，其實東西還在身上。標記讀取失敗、改顯示「沒不見、重試一下」的退路；
  // reloadKey 讓重試鈕重跑 effect。
  // 記的是「哪一次抓取失敗了」而不是「有沒有失敗過」。以前是 failed 布林，每次要重抓
  // 前得先在 effect 裡把它按回 false（等於多一次重畫，eslint 的 set-state-in-effect
  // 擋的就是這個）；現在把失敗那次的識別字串存起來，跟當下要抓的那次比對，一換車內容
  // 或按重試，識別字串就不一樣、退路畫面自動收起來，不用誰去按回去。
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // 純粹當重新渲染的觸發器：購物車變動時 +1 強制重算 cart / idsKey / 各列數量。
  const [, bumpCart] = useState(0);
  // 剛移除的商品先暫存，讓客人有機會「復原」——按 Remove 是一鍵就清掉，
  // 手滑或反悔卻沒退路，正是 user 長期在意的「不小心弄掉東西、沒復原」。
  const [undo, setUndo] = useState<{
    id: string;
    qty: number;
    name: string;
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 按「復原」後提示連同按鈕一起收掉，焦點會掉到頁首，用鍵盤的人得從頭 Tab 回來。
  // 記下要放回哪一列，等那列重新出現（復原後要重抓商品，會晚一點）再把焦點送到它的移除鈕。
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterUndo = useRef<string | null>(null);
  // 按「移除」後那列連同移除鈕一起消失，焦點同樣掉到頁首。記下被移除的是哪列、
  // 焦點該去哪（下一列的移除鈕，沒有就上一列，整車清空就回標題），等那列真的不見再送。
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterRemove = useRef<{
    removed: string;
    target: string | null;
  } | null>(null);
  // 按到上限後再按 +，數量格文字沒變，報讀不會再念「已到上限」，按了像沒反應。
  // 每擋一次就翻轉該列的旗標，讓數量格尾端多／少一個看不到的空白，內容算有更新就會重念。
  const [limitFlip, setLimitFlip] = useState<Record<string, boolean>>({});
  // 同理，按到 1 再按 − 也翻轉，重念「已是最少」。
  const [minFlip, setMinFlip] = useState<Record<string, boolean>>({});

  function handleRemove(
    e: React.MouseEvent<HTMLButtonElement>,
    p: Product,
    qty: number
  ) {
    const ids = itemRows.map((r) => r.product.id);
    const at = ids.indexOf(p.id);
    // 跟復原一樣，只有焦點本來就在這顆移除鈕上才接手。
    focusAfterRemove.current =
      document.activeElement === e.currentTarget
        ? { removed: p.id, target: ids[at + 1] ?? ids[at - 1] ?? null }
        : null;
    removeFromCart(slug, p.id);
    focusAfterUndo.current = null;
    // 記住剛移除那筆（含數量），復原時原封不動加回去。
    setUndo({ id: p.id, qty, name: p.name });
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

  function handleUndo(e: React.MouseEvent<HTMLButtonElement>) {
    if (!undo) return;
    // 只有焦點本來就在復原鈕上（鍵盤按、或瀏覽器點擊會給焦點）才接手，不去搶別處的焦點。
    if (document.activeElement === e.currentTarget) {
      focusAfterUndo.current = undo.id;
    }
    focusAfterRemove.current = null;
    addToCart(slug, undo.id, undo.qty);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
  }

  // 每次畫完檢查：復原的那列回來了，且焦點還沒被別處拿走（掉在 body），就送到它的移除鈕。
  useEffect(() => {
    const id = focusAfterUndo.current;
    if (!id) return;
    const btn = removeButtons.current.get(id);
    if (!btn) return;
    focusAfterUndo.current = null;
    if (!document.activeElement || document.activeElement === document.body) {
      btn.focus();
    }
  });

  // 移除的那列從畫面上拿掉後（焦點隨之掉到 body），把焦點送到鄰列的移除鈕或標題。
  useEffect(() => {
    const pending = focusAfterRemove.current;
    if (!pending || removeButtons.current.has(pending.removed)) return;
    focusAfterRemove.current = null;
    if (document.activeElement && document.activeElement !== document.body) {
      return;
    }
    const btn = pending.target
      ? removeButtons.current.get(pending.target)
      : null;
    (btn ?? headingRef.current)?.focus();
  });

  // 元件卸載時清掉還沒燒完的計時器，避免對已卸載元件 setState。
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const cart = typeof window !== "undefined" ? getCart(slug) : [];
  // 只在「購物車裡的商品集合」改變時才重抓商品資料。先前用 cartVersion 當依賴，
  // 但它每次加減數量都會 +1，害每點一下 +/− 就白抓一次整份清單（價格/庫存/圖片
  // 跟數量無關，抓了也沒新資料）。改成只看 id 集合：調數量 → 集合不變 → 不重抓；
  // 移除商品 → 集合變 → 重抓。排序後 join 讓集合相同時字串穩定。
  const idsKey = cart
    .map((c) => c.productId)
    .sort()
    .join(",");

  // 這一次要抓的是哪一批（車內容＋重試次數）。失敗紀錄綁在這串上。
  const loadKey = `${slug}|${idsKey}|${reloadKey}`;
  const failed = failedKey === loadKey;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (idsKey === "") {
        if (!cancelled) setProducts([]);
        return;
      }
      try {
        const data = await fetchProductsByIds<Product>(slug, idsKey);
        if (!cancelled) setProducts(data);
        // 車裡某項商品被商家下架／刪除後，API 不會再回它：購物車頁看不到（itemRows
        // 濾掉沒撈到的），但 id／數量還留在 localStorage，nav 購物車徽章（cart-icon 讀
        // getCartCount）仍把這些看不到的幽靈商品一起算進去——徽章件數比購物車實際顯示的
        // 多，客人一頭霧水卻找不到地方清。抓回資料的當下順手把對不上的項目清掉，讓徽章跟
        // 購物車內容一致。安全前提：只有在「至少有一項商品成功撈回」時才清——整批回空可能是
        // 店家暫時整間下架或一時抓不到（API 對未發布店面也回空陣列），那種情況寧可留著不動，
        // 免得把一車有效商品整個清光。
        if (!cancelled && data.length > 0) {
          const returnedIds = new Set(data.map((p) => p.id));
          for (const id of idsKey.split(",")) {
            if (!returnedIds.has(id)) removeFromCart(slug, id);
          }
        }
      } catch {
        // 讀失敗就記下是這一輪失敗、別讓 products 停在 null 整頁卡骨架；車裡的 id/數量
        // 還在 localStorage，沒有不見，給重試退路即可。
        if (!cancelled) setFailedKey(loadKey);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [idsKey, slug, reloadKey, loadKey]);

  useEffect(() => {
    const onChange = () => bumpCart((v) => v + 1);
    window.addEventListener("sproutly-cart-changed", onChange);
    return () =>
      window.removeEventListener("sproutly-cart-changed", onChange);
  }, []);

  const itemRows = (products ?? [])
    .map((p) => ({
      product: p,
      qty: cart.find((c) => c.productId === p.id)?.qty ?? 0,
    }))
    // 移除商品後到重抓完成之間，products 可能還留著已移除的那筆（qty 0），
    // 濾掉避免短暫渲染出一列數量 0 的商品。
    .filter((r) => r.qty > 0);
  const total = itemRows.reduce(
    (s, r) => s + r.product.price_cents * r.qty,
    0
  );
  const itemCount = itemRows.reduce((s, r) => s + r.qty, 0);
  // 結帳前先擋：任何一項數量超過庫存（含已缺貨）就不讓按「去結帳」，
  // 跟結帳 API 同一條紅線。否則客人會帶著超量的車排到結帳才被退回。
  const checkoutBlocked = itemRows.some(
    (r) => r.product.stock != null && r.qty > r.product.stock
  );
  // Total 幣別跟著商品走，別硬寫 TWD（同店商品幣別一致，取第一項即可）。
  const totalCurrency = itemRows[0]?.product.currency ?? "TWD";

  return (
    <main className="max-w-4xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <header className="mb-16 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.4em",
          }}
        >
          Cart
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-3xl sm:text-4xl font-medium outline-none"
          style={{
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          購物車
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
            ? "暫時讀不到購物車"
            : products === null
            ? "整理中⋯"
            : itemRows.length === 0
            ? "這裡會放你準備帶回家的植物"
            : `${itemCount} 件商品 · 結帳前確認一下`}
        </p>
      </header>

      {failed ? (
        // 讀取失敗：車裡的 id/數量還在身上，沒不見，給一條「重試」退路而不是卡骨架。
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
            讀不到購物車
          </p>
          <p
            className="mt-5 text-[0.9375rem]"
            style={{
              color: "var(--store-text-muted, rgba(0,0,0,0.6))",
              lineHeight: 1.7,
            }}
          >
            可能是網路不太穩。你車裡的東西沒有不見，
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
        <div className="space-y-8" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-5 pb-8 opacity-50"
              style={{
                borderBottom: "1px solid var(--store-border, rgba(0,0,0,0.08))",
              }}
            >
              <div
                className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-xl"
                style={{
                  background: "var(--store-surface, rgba(0,0,0,0.04))",
                }}
              />
              <div className="flex-1 min-w-0 space-y-3 pt-2">
                <div
                  className="h-4 w-2/3 rounded"
                  style={{
                    background: "var(--store-surface, rgba(0,0,0,0.04))",
                  }}
                />
                <div
                  className="h-3 w-1/4 rounded"
                  style={{
                    background: "var(--store-surface, rgba(0,0,0,0.04))",
                  }}
                />
                <div
                  className="h-8 w-28 rounded-full mt-2"
                  style={{
                    background: "var(--store-surface, rgba(0,0,0,0.04))",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : itemRows.length === 0 ? (
        <>
        <StoreEmptyState
          title={
            <>
              購物車
              <br />
              還是空的
            </>
          }
          description="去逛逛 shop，遇到合眼緣的，加進來慢慢挑。"
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
        {/* 空車不是死路：把這台裝置剛看過的幾株帶回來，客人想起「剛剛那株」
            不用回頭一頁頁找。沒看過紀錄時整段不出現（元件自己判斷）。
            放在 max-w-md 文字塊外，讓商品網格用整個容器寬度。 */}
        <RecentlyViewed slug={slug} className="mt-4" />
        </>
      ) : (
        <>
          <div className="space-y-8">
            {itemRows.map(({ product: p, qty }) => {
              // 庫存上限：null 視為不限（沿用 QTY_MAX 軟上限），否則卡在庫存量。
              // 跟結帳 API 同一條紅線，只是搬到購物車先擋，讓客人不用排到
              // 結帳才被退回。跟商品頁數量下拉同走 maxSelectableQty。
              const maxQty = maxSelectableQty(p.stock);
              const atStockLimit = p.stock != null && qty >= p.stock;
              // 縮圖先濾掉店面注定顯示不出的舊值（http://、半截網址、空白），跟逛街頁同一條線。
              const thumb = displayableImageUrls(p.image_urls)[0];
              return (
              <div
                key={p.id}
                className="flex gap-5 pb-8"
                style={{
                  borderBottom:
                    "1px solid var(--store-border, rgba(0,0,0,0.08))",
                }}
              >
                <Link
                  href={`/${slug}/products/${p.id}`}
                  className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 overflow-hidden rounded-xl"
                  style={{
                    background: "var(--store-surface, rgba(0,0,0,0.04))",
                  }}
                >
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={p.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/${slug}/products/${p.id}`}
                    className="text-lg sm:text-xl block"
                    style={{
                      fontFamily: "var(--store-font)",
                      fontWeight: 400,
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {p.name}
                  </Link>
                  <p
                    className="mt-1 text-sm"
                    style={{
                      color:
                        "var(--store-text-muted, rgba(0,0,0,0.6))",
                    }}
                  >
                    {formatPrice(p.price_cents, p.currency)}
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <div
                      className="inline-flex items-center rounded-full overflow-hidden"
                      style={{
                        border:
                          "1px solid var(--store-border, rgba(0,0,0,0.12))",
                      }}
                      role="group"
                      aria-label={`${p.name}，調整數量`}
                    >
                      <button
                        type="button"
                        // 用 aria-disabled 不用 disabled：按到 1 時按鈕若真的停用，
                        // 焦點會從手上掉到頁面最上面，用鍵盤的人要從頭 Tab 回來。
                        onClick={() => {
                          if (qty > 1) updateQty(slug, p.id, qty - 1);
                          else setMinFlip((f) => ({ ...f, [p.id]: !f[p.id] }));
                        }}
                        aria-disabled={qty <= 1}
                        className="w-8 h-8 transition aria-disabled:opacity-30 aria-disabled:cursor-not-allowed"
                        style={{
                          color:
                            "var(--store-text-muted, rgba(0,0,0,0.6))",
                        }}
                        aria-label={`減少 ${p.name} 數量`}
                      >
                        −
                      </button>
                      {/* aria-live：客人按 +/− 時讀出新數量，不然數字默默變、看不見畫面的人
                          只聽到「按鈕」沒有結果回饋。aria-atomic 確保整句一起讀。 */}
                      <span
                        className="w-10 text-center text-sm tabular-nums"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {qty}
                        {/* 按到 1 時一併唸出來，不然再按 − 沒反應也不知道為什麼。 */}
                        {qty <= 1 && (
                          <span className="sr-only">
                            ，已是最少{minFlip[p.id] ? "\u00A0" : ""}
                          </span>
                        )}
                        {/* 按到上限時一併唸出來，不然再按 + 沒反應也不知道為什麼。 */}
                        {qty >= maxQty && (
                          <span className="sr-only">
                            ，已到上限{limitFlip[p.id] ? "\u00A0" : ""}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        // 同上，按到上限焦點留在原地。
                        onClick={() => {
                          if (qty < maxQty)
                            updateQty(slug, p.id, Math.min(qty + 1, maxQty));
                          else
                            setLimitFlip((f) => ({ ...f, [p.id]: !f[p.id] }));
                        }}
                        aria-disabled={qty >= maxQty}
                        className="w-8 h-8 transition aria-disabled:opacity-30 aria-disabled:cursor-not-allowed"
                        style={{
                          color:
                            "var(--store-text-muted, rgba(0,0,0,0.6))",
                        }}
                        aria-label={`增加 ${p.name} 數量`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) removeButtons.current.set(p.id, el);
                        else removeButtons.current.delete(p.id);
                      }}
                      onClick={(e) => handleRemove(e, p, qty)}
                      aria-label={`從購物車移除 ${p.name}`}
                      title="從購物車移除"
                      className="text-[0.6875rem] uppercase transition hover:opacity-100"
                      style={{
                        letterSpacing: "0.3em",
                        opacity: 0.55,
                        color:
                          "var(--store-text-muted, rgba(0,0,0,0.6))",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  {atStockLimit && (
                    <p
                      className="mt-3 text-[0.6875rem]"
                      style={{
                        color: "var(--store-text-muted, rgba(0,0,0,0.55))",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {isSoldOut(p.stock)
                        ? "目前缺貨，結帳前請先移除"
                        : qty > (p.stock ?? 0)
                        ? `庫存只剩 ${p.stock} 件，結帳前請調整數量`
                        : `已達庫存上限（剩 ${p.stock} 件）`}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className="text-base sm:text-lg tabular-nums"
                    style={{
                      fontFamily: "var(--store-font)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {formatPrice(p.price_cents * qty, p.currency)}
                  </p>
                </div>
              </div>
              );
            })}
          </div>

          <div className="mt-14 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <p
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                Total
              </p>
              <div
                className="mt-3 h-px w-10"
                style={{
                  background: "var(--store-accent, currentColor)",
                  opacity: 0.4,
                }}
              />
              <p
                className="mt-4 text-3xl sm:text-4xl tabular-nums"
                style={{
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  color: "var(--store-accent, currentColor)",
                }}
              >
                {formatPrice(total, totalCurrency)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              {checkoutBlocked && (
                <p
                  className="text-[0.6875rem] text-right max-w-[16rem]"
                  style={{
                    color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                    letterSpacing: "0.04em",
                    lineHeight: 1.6,
                  }}
                >
                  有商品超過庫存，調整數量後再結帳
                </p>
              )}
              {checkoutBlocked ? (
                <button
                  type="button"
                  disabled
                  aria-label="去結帳（有商品超過庫存，需先調整數量）"
                  className="sproutly-btn sproutly-btn-primary sproutly-btn-lg"
                  style={{ opacity: 0.4, cursor: "not-allowed" }}
                >
                  去結帳
                </button>
              ) : (
                <Link
                  href={`/${slug}/cart/checkout`}
                  className="sproutly-btn sproutly-btn-primary sproutly-btn-lg"
                >
                  去結帳
                </Link>
              )}
            </div>
          </div>

          {/* 車裡有東西時只剩「去結帳」一條去向，想再加一株得自己回 nav 找 shop。
              補一條低調的「繼續逛」連結，讓客人加完這幾株能順手回去逛、再帶幾株——
              空車狀態早有「去逛逛 →」，這裡沿用同一套 sproutly-link 視覺對齊。 */}
          <div className="mt-10 text-center">
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

      {/* 狀態格一直掛著、只換裡面的內容：跟內容一起才冒出來的狀態格，報讀軟體常常不唸。 */}
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6 pointer-events-none"
      >
        {undo && (
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
              已移除「{undo.name}」
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
        )}
      </div>
    </main>
  );
}
