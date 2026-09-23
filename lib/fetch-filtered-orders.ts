import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "./fetch-all-rows.ts";
import { taipeiRangeSince } from "./format-date.ts";
import {
  applyOrderSearch,
  matchesOrderSearch,
  needsMemoryOrderSearch,
} from "./order-search.ts";
import type { OrderFilters } from "./order-filters.ts";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// 「照篩選撈這家店的訂單」單一來源。訂單列表頁與訂單匯出 CSV 是同一批訂單的兩個
// 出口，匯出要等於眼前所見。篩選參數的解析早就共用（lib/order-filters），但拿參數
// 去組查詢這段——狀態／付款 eq、時間區間 gte、搜尋分流、分頁撈齊、排序——兩邊仍各抄
// 一份逐字同形的。日後改其中一邊（例如多一個篩選維度、改排序），另一邊沒跟上，
// 就又回到「列表篩得出、匯出拿到另一批」。收成這支，兩個出口吃同一條查詢。
//
// 行為照原本兩處：
// - 分頁撈齊走 fetchAllRows（Supabase 一次最多回約 1000 列，訂單破千不能默默少掉）。
// - 排序新到舊，同時間再比 id，讓每頁切點穩定不漏不重。
// - 搜尋字串含數字或 , ( ) 時不交給 DB ilike，撈回來在記憶體用 matchesOrderSearch
//   逐筆比（原因見 lib/order-search 的 needsMemoryOrderSearch）；其餘交給 DB ilike。
export async function fetchFilteredOrders(
  supabase: ServerClient,
  merchantId: string,
  filters: OrderFilters
) {
  const { status, pay, range, q } = filters;
  const since = taipeiRangeSince(range);
  const memorySearch = q !== "" && needsMemoryOrderSearch(q);
  const fetched = await fetchAllRows(async (from, to) => {
    let query = supabase
      .from("sproutly_orders")
      .select("*")
      .eq("merchant_id", merchantId);
    if (status !== "all") query = query.eq("status", status);
    if (pay !== "all") query = query.eq("payment_status", pay);
    if (q && !memorySearch) query = applyOrderSearch(query, q);
    if (since) query = query.gte("created_at", since.toISOString());
    const { data } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    return { data };
  });
  return memorySearch
    ? fetched.filter((o) => matchesOrderSearch(o, q))
    : fetched;
}
