// 客戶端購物車 helpers（localStorage based，per-store key）

import { QTY_MIN, QTY_MAX } from "./product-quantity.ts";

export type CartItem = {
  productId: string;
  qty: number;
};

const KEY_PREFIX = "sproutly_cart_";

export function getCart(slug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_PREFIX + slug);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // qty 必須是 1-99 的整數。typeof "number" 擋不掉 NaN / 負數 / 小數，
    // 漏掉的話 getCartCount 會算出 NaN，購物車徽章直接顯示「NaN」。
    return arr
      .filter((x) => x && typeof x.productId === "string")
      .map((x) => ({
        productId: x.productId as string,
        qty: Math.min(Math.max(Math.floor(Number(x.qty)), QTY_MIN), QTY_MAX),
      }))
      .filter((x) => Number.isFinite(x.qty));
  } catch {
    return [];
  }
}

export function setCart(slug: string, items: CartItem[]) {
  try {
    localStorage.setItem(KEY_PREFIX + slug, JSON.stringify(items));
    window.dispatchEvent(new Event("sproutly-cart-changed"));
  } catch {
    /* ignore */
  }
}

// 「加幾件」在入口就夾成 1-99 的整數，跟 getCart 讀回時同一口徑。
// 以前只卡上限：傳 0、負數、小數、NaN 會原樣寫進 localStorage，讀回才被夾成 1，
// 等於存的跟看到的不一樣；傳負數還會把既有數量往下扣到 0 或負的。
function normalizeAddQty(qty: number): number {
  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n)) return QTY_MIN;
  return Math.min(Math.max(n, QTY_MIN), QTY_MAX);
}

export function addToCart(slug: string, productId: string, qty = 1) {
  const items = getCart(slug);
  const add = normalizeAddQty(qty);
  const existing = items.find((i) => i.productId === productId);
  if (existing) {
    existing.qty = Math.min(existing.qty + add, QTY_MAX);
  } else {
    items.push({ productId, qty: add });
  }
  setCart(slug, items);
}

export function updateQty(slug: string, productId: string, qty: number) {
  const items = getCart(slug);
  const idx = items.findIndex((i) => i.productId === productId);
  if (idx === -1) return;
  if (qty <= 0) items.splice(idx, 1);
  else items[idx].qty = Math.min(qty, QTY_MAX);
  setCart(slug, items);
}

export function removeFromCart(slug: string, productId: string) {
  setCart(
    slug,
    getCart(slug).filter((i) => i.productId !== productId)
  );
}

export function getCartCount(slug: string): number {
  return getCart(slug).reduce((s, i) => s + i.qty, 0);
}

export function clearCart(slug: string) {
  setCart(slug, []);
}
