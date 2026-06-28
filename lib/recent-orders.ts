// 訪客訂單在這台裝置上的「小抄」（localStorage based，per-store key）。
// 成功頁只給客人看一次訂單編號，沒抄下來之後想查單就只能問店家；
// 把短碼＋查單電話記在客人自己的裝置上，查訂單頁就能一鍵帶入。

export type RecentOrder = {
  shortId: string; // UUID 第一段大寫 8 碼（顯示與查詢都用這段）
  phone: string; // 下單時填的電話，查單要兩者都對才查得到
  totalCents: number;
  currency: string;
  createdAt: string; // ISO
};

const KEY_PREFIX = "sproutly_recent_orders_";
const MAX_ORDERS = 10;

export function getRecentOrders(slug: string): RecentOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY_PREFIX + slug);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x) =>
          x &&
          typeof x.shortId === "string" &&
          typeof x.phone === "string" &&
          Number.isFinite(Number(x.totalCents)) &&
          typeof x.currency === "string" &&
          typeof x.createdAt === "string"
      )
      // totalCents 可能被存成字串／null（跨版本舊資料、或手動竄改 localStorage）。上面
      // 只用 Number() 把它「當作數字」驗證有限、卻原樣回傳——跟 recent-products 的
      // priceCents、cart 的 qty 同一條「驗證並轉成真數字」防呆線。不轉的話原樣字串會流到
      // formatPrice（用 Number.isFinite 不做轉換、字串被當 0），查單頁的「最近訂單」就
      // 顯示「NT$ 0」；回傳值也對 RecentOrder.totalCents 的 number 型別撒謊。
      .map((x) => ({
        shortId: x.shortId as string,
        phone: x.phone as string,
        totalCents: Number(x.totalCents),
        currency: x.currency as string,
        createdAt: x.createdAt as string,
      }));
  } catch {
    return [];
  }
}

export function rememberOrder(slug: string, order: RecentOrder) {
  try {
    // 同一筆訂單重複記（成功頁重整、查單頁再查一次）先去重，永遠最新在前。
    const rest = getRecentOrders(slug).filter(
      (o) => o.shortId !== order.shortId
    );
    localStorage.setItem(
      KEY_PREFIX + slug,
      JSON.stringify([order, ...rest].slice(0, MAX_ORDERS))
    );
  } catch {
    /* localStorage 不給寫就算了，不影響下單 */
  }
}
