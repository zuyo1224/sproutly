// 客人名單「每位客人一列」的彙總與排序單一來源。
//
// 客人後台的「列表頁」與「匯出 CSV」是同一份名單的兩個出口。分群（group-orders-by-customer）、
// 搜尋（customer-search）、加總（sum-order-cents）、比較器（date-compare）都已經各自收成
// 共用，但把這些零件組起來的那兩段——「每個分群算出姓名／筆數／已付／累計／首末次下單」
// 的迴圈、和四種排序的 switch——還是兩處各抄一份逐字相同的。日後有人只在一邊改（例如
// 「最近下單」同時間再比累計、或姓名改取最早那筆），就變成列表跟匯出排序對不上。
// 收成這支後兩個出口吃同一份彙總與排序，匯出 = 眼前所見。

import { groupOrdersByCustomer, isAccountGroupKey } from "./group-orders-by-customer.ts";
import { sumOrderCents } from "./sum-order-cents.ts";
import { compareIsoAsc, compareIsoDesc } from "./date-compare.ts";
import { isPaidOrder } from "./order-labels.ts";

type CustomerRowSource = {
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  total_cents: number;
  payment_status: string;
  created_at: string;
};

export type CustomerRow = {
  key: string;
  identityType: "account" | "guest";
  customerId: string | null;
  name: string;
  email: string | null;
  phone: string;
  orderCount: number;
  paidCount: number;
  totalCents: number;
  paidCents: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

// 排序選項白名單，列表頁下拉與匯出 route 共用；第一個是預設值。
export const CUSTOMER_SORT_KEYS = ["recent", "spend", "orders", "first"] as const;
export type CustomerSort = (typeof CUSTOMER_SORT_KEYS)[number];

// 網址上的 sort 不在白名單就退回預設 "recent"。
export function parseCustomerSort(value: string | null | undefined): CustomerSort {
  return (CUSTOMER_SORT_KEYS as readonly string[]).includes(value ?? "")
    ? (value as CustomerSort)
    : "recent";
}

// 列表頁與匯出 route 共用的網址參數：q 去前後空白、sort 走白名單。
export type CustomerFilters = { q: string; sort: CustomerSort };

export function parseCustomerFilters(raw: {
  q?: string | null;
  sort?: string | null;
}): CustomerFilters {
  return { q: (raw.q ?? "").trim(), sort: parseCustomerSort(raw.sort) };
}

// 有搜尋或排序不是預設，匯出檔名就加註「篩選」。
export function isCustomerFilterActive(f: CustomerFilters): boolean {
  return f.q !== "" || f.sort !== "recent";
}

// 搜尋＋排序接回網址用的查詢字串（不含「?」），給 withQuery 接路徑；預設值不帶。
export function customerFilterQuery(f: CustomerFilters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.sort !== "recent") sp.set("sort", f.sort);
  return sp.toString();
}

// 訂單併成客人後每位一列，順序照分群的插入順序（排序另外呼叫 sortCustomerRows）。
// 姓名／Email／電話取該客人最近一筆訂單上的。
export function buildCustomerRows(orders: CustomerRowSource[]): CustomerRow[] {
  const rows: CustomerRow[] = [];
  for (const [key, group] of groupOrdersByCustomer(orders)) {
    const sorted = [...group].sort((a, b) =>
      compareIsoAsc(a.created_at, b.created_at)
    );
    const latest = sorted[sorted.length - 1];
    const earliest = sorted[0];
    const paidOrders = group.filter((o) => isPaidOrder(o.payment_status));
    const identityType: CustomerRow["identityType"] = isAccountGroupKey(key)
      ? "account"
      : "guest";
    rows.push({
      key,
      identityType,
      customerId: identityType === "account" ? latest.customer_id : null,
      name: latest.customer_name || "—",
      email: latest.customer_email,
      phone: latest.customer_phone,
      orderCount: group.length,
      paidCount: paidOrders.length,
      totalCents: sumOrderCents(group),
      paidCents: sumOrderCents(paidOrders),
      firstOrderAt: earliest.created_at,
      lastOrderAt: latest.created_at,
    });
  }
  return rows;
}

// 就地排序並回傳同一個陣列（跟原本兩處的 filtered.sort 行為一致）。
export function sortCustomerRows(rows: CustomerRow[], sort: CustomerSort): CustomerRow[] {
  switch (sort) {
    case "spend":
      return rows.sort((a, b) => b.totalCents - a.totalCents);
    case "orders":
      return rows.sort((a, b) => b.orderCount - a.orderCount);
    case "first":
      return rows.sort((a, b) => compareIsoAsc(a.firstOrderAt, b.firstOrderAt));
    default:
      return rows.sort((a, b) => compareIsoDesc(a.lastOrderAt, b.lastOrderAt));
  }
}
