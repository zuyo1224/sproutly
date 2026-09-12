// 客戶端購物車 helpers（localStorage based，per-store key）

import { QTY_MIN, QTY_MAX, clampQty } from "./product-quantity.ts";

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
    // 不是數字的那筆（clampQty 回 null）整筆丟掉。
    const items: CartItem[] = [];
    for (const x of arr) {
      if (!x || typeof x.productId !== "string") continue;
      const qty = clampQty(x.qty);
      if (qty === null) continue;
      items.push({ productId: x.productId, qty });
    }
    return items;
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
  return clampQty(qty) ?? QTY_MIN;
}

// 「改成幾件」的入口清洗。跟 normalizeAddQty 分開是因為這裡的 0 與負數有意義
// （等於把這筆從購物車拿掉），不能一律夾到 1。回傳 null 代表「這個值不是數字，
// 什麼都別動」。
function normalizeNewQty(qty: number): number | "remove" | null {
  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return "remove";
  return Math.min(n, QTY_MAX);
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

// 以前這裡只做 Math.min(qty, QTY_MAX)：小數會原樣寫進 localStorage（存 2.5、讀回
// 被 getCart 夾成 2，畫面上的數字跟存的不一樣），NaN 因為「NaN <= 0」是 false 也會
// 被當成有效數量寫進去，JSON 存成 null、讀回變成 1——這兩種都是 addToCart 早就修過
// 的同一類問題，只有這支還沒補。現在三個寫入口（addToCart／updateQty／getCart 讀回
// 時的清洗）都是同一口徑：整數、1-99。
export function updateQty(slug: string, productId: string, qty: number) {
  const next = normalizeNewQty(qty);
  if (next === null) return;
  const items = getCart(slug);
  const idx = items.findIndex((i) => i.productId === productId);
  if (idx === -1) return;
  if (next === "remove") items.splice(idx, 1);
  else items[idx].qty = next;
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
