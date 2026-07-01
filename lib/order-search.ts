// 後台訂單「用關鍵字搜姓名／電話／Email」單一來源。訂單列表頁與匯出 route 是同一份
// 訂單名單的兩個出口，兩邊都吃同一個搜尋字串 q，也都該用同一套「比對哪些欄位、怎麼
// 轉義」的規則。原本這段在兩處各抄一份逐字相同的：先把 q 裡的 ilike 萬用字元（% 和 _）
// 轉義——不轉的話客人打「50%」的 % 會被 PostgREST 當成「比對任意字串」的萬用符，搜出
// 一堆不相干的單——再組 customer_name／customer_phone／customer_email 三欄的 or ilike 查詢。
// 日後要多搜一個欄位（例如訂單編號）、或改轉義規則，得兩處同步；漏一處就變成「在列表
// 搜得到的單，按同一個關鍵字匯出時卻被濾掉」這種同一份名單兩個出口對不上。收成這支，
// 兩處吃同一條比對規則。跟 lib/customer-search 的 matchesCustomerSearch 用途不同：那邊是
// 客人名單「在記憶體裡逐筆比對」的述詞，這邊是訂單查詢「交給資料庫 ilike 過濾」，機制不同、
// 不合併。呼叫端自行決定 q 空字串時是否略過整個搜尋（兩處都是 if (q) query = applyOrderSearch(...)）。
//
// 型別用 { or }: PostgREST 的 filter builder 每個方法都回傳自己（this），這裡只約束「有一個
// 吃 filter 字串、回傳同型 builder 的 or 方法」，就不必把 Supabase 那串泛型型別搬進來。
export function applyOrderSearch<T extends { or(filter: string): T }>(
  query: T,
  q: string,
): T {
  const escaped = q.replace(/[%_]/g, (m) => `\\${m}`);
  return query.or(
    `customer_name.ilike.%${escaped}%,customer_phone.ilike.%${escaped}%,customer_email.ilike.%${escaped}%`,
  );
}
