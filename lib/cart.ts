// 客戶端購物車 helpers（localStorage based，per-store key）

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
    return arr.filter(
      (x) => x && typeof x.productId === "string" && typeof x.qty === "number"
    );
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

export function addToCart(slug: string, productId: string, qty = 1) {
  const items = getCart(slug);
  const existing = items.find((i) => i.productId === productId);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, 99);
  } else {
    items.push({ productId, qty: Math.min(qty, 99) });
  }
  setCart(slug, items);
}

export function updateQty(slug: string, productId: string, qty: number) {
  const items = getCart(slug);
  const idx = items.findIndex((i) => i.productId === productId);
  if (idx === -1) return;
  if (qty <= 0) items.splice(idx, 1);
  else items[idx].qty = Math.min(qty, 99);
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
