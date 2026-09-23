// 後台商品列表的狀態篩選（全部／上架中／停售中／快沒貨／已售完）與網址參數解析單一來源。
//
// 原本整份清單寫在列表頁裡，白名單判斷（some 比 key）、篩選＋搜尋接回網址（chip 連結、
// 快速動作跳回來的 returnQs）也在頁面裡各組一次，沒有任何測試釘住。比照訂單的
// lib/order-filters 收出來：不在清單裡的 filter 一律當「全部」，q 去前後空白，
// 查詢字串只有一種組法（filter 是 all 不帶、q 空不帶），chip 連結與快速動作跳回的網址不會各寫各的。
//
// 快沒貨／已售完走 product-stock 的 isLowStock／isSoldOut，跟卡片上的「剩 N 件」、後台首頁的
// 快沒貨清單、客人端全站同一份門檻（LOW_STOCK_THRESHOLD），不會各說各話。
// 以前列表頁寫死 stock < 5（≤4），客人端卻是 ≤3，兩邊其實對不上才收成那一份。

import { isLowStock, isSoldOut } from "./product-stock.ts";

type FilterableProduct = { is_active: boolean; stock: number | null };

export type ProductStatusFilter = {
  key: string;
  label: string;
  match: (p: FilterableProduct) => boolean;
};

// 順序即列表頁 chip 順序；第一個「all」同時是退回值。
export const PRODUCT_STATUS_FILTERS: ProductStatusFilter[] = [
  { key: "all", label: "全部", match: () => true },
  { key: "active", label: "上架中", match: (p) => p.is_active },
  { key: "inactive", label: "停售中", match: (p) => !p.is_active },
  { key: "low", label: "快沒貨", match: (p) => isLowStock(p.stock) },
  { key: "soldout", label: "已售完", match: (p) => isSoldOut(p.stock) },
];

export type ProductFilters = { filter: string; q: string };

export function parseProductFilters(raw: {
  filter?: string | null;
  q?: string | null;
}): ProductFilters {
  const filter = PRODUCT_STATUS_FILTERS.some((f) => f.key === raw.filter)
    ? raw.filter!
    : "all";
  return { filter, q: (raw.q ?? "").trim() };
}

export function productStatusFilter(key: string): ProductStatusFilter {
  return (
    PRODUCT_STATUS_FILTERS.find((f) => f.key === key) ??
    PRODUCT_STATUS_FILTERS[0]
  );
}

export function isProductFilterActive(f: ProductFilters): boolean {
  return f.filter !== "all" || f.q !== "";
}

// 篩選＋搜尋接回網址用的查詢字串（不含「?」），給 withQuery 接路徑。
export function productFilterQuery(f: ProductFilters): string {
  const sp = new URLSearchParams();
  if (f.filter !== "all") sp.set("filter", f.filter);
  if (f.q) sp.set("q", f.q);
  return sp.toString();
}
