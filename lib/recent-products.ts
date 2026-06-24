// 客人在這台裝置上「最近看過」的商品（localStorage based，per-store key）。
// 客人逛店常一株一株點進去看，看到第三株時往往想回頭比較前兩株，
// 但瀏覽器上一頁會丟掉捲動位置、收藏又要先按愛心。把看過的商品在客人自己
// 裝置上記一份小抄，商品詳情頁底部就能列出「最近看過」一排，一鍵跳回。
// 只存顯示要用的快照（名稱／價格／縮圖），不碰資料庫；庫存會變動所以不存，
// 客人點進去看的是即時頁面。

export type RecentProduct = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  image: string | null;
  viewedAt: string; // ISO，最新看的排前面
};

const KEY_PREFIX = "sproutly_recent_products_";
const MAX_PRODUCTS = 12;

export function getRecentProducts(slug: string): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_PREFIX + slug);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x) =>
        x &&
        typeof x.id === "string" &&
        typeof x.name === "string" &&
        Number.isFinite(Number(x.priceCents)) &&
        typeof x.currency === "string" &&
        (x.image === null || typeof x.image === "string") &&
        typeof x.viewedAt === "string"
    );
  } catch {
    return [];
  }
}

// 小抄裡某幾株被商家下架／刪除後，列出來點進去就是 404。詳情頁／空車頁核對過哪些
// 還在（active）之後，把明確指名的那幾個 id 從這台裝置的小抄裡清掉。只移除指名的，
// 其餘一律不動——剛看的當前商品還沒被核對到，不能順手掃掉。回傳有沒有真的改到。
export function removeRecentProducts(slug: string, ids: string[]): boolean {
  if (typeof window === "undefined" || ids.length === 0) return false;
  try {
    const dead = new Set(ids);
    const current = getRecentProducts(slug);
    const kept = current.filter((p) => !dead.has(p.id));
    if (kept.length === current.length) return false;
    localStorage.setItem(KEY_PREFIX + slug, JSON.stringify(kept));
    return true;
  } catch {
    return false;
  }
}

export function rememberProduct(
  slug: string,
  product: Omit<RecentProduct, "viewedAt">
) {
  try {
    // 同一株重複看（重整、來回逛）先去重，永遠把最新看的放最前。
    const rest = getRecentProducts(slug).filter((p) => p.id !== product.id);
    const entry: RecentProduct = {
      ...product,
      viewedAt: new Date().toISOString(),
    };
    localStorage.setItem(
      KEY_PREFIX + slug,
      JSON.stringify([entry, ...rest].slice(0, MAX_PRODUCTS))
    );
  } catch {
    /* localStorage 不給寫就算了，不影響逛店 */
  }
}
