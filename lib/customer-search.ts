// 客人列表關鍵字比對（姓名 / Email / 電話）單一來源。
//
// 客人後台的「列表頁」與「匯出 CSV」是同一份客人名單的兩個出口，兩邊都吃同一個
// 搜尋字串 q，也都該用同一套「比對哪些欄位」的規則。原本這條 filter 述詞在兩處各抄
// 一份逐字相同的：把 q 轉小寫，再比姓名 / (email ?? "") / 電話 是否包含。日後要調整
// 可搜尋的欄位（例如加上訂單編號、或改成也比對地址），得兩處同步；漏一處就變成
// 「在列表搜得到的客人，匯出時卻被濾掉」這種同一份名單兩個出口對不上。收成這支後，
// 列表與匯出吃同一條比對規則。
//
// email 可能為 null，比對前補空字串（維持原本 (email ?? "") 行為）；query 由呼叫端
// 自行決定空字串時是否略過整個 filter（兩處都是 q ? rows.filter(...) : rows），這支
// 只負責「單一客人是否命中」。
export function matchesCustomerSearch(
  customer: { name: string; email: string | null; phone: string },
  query: string,
): boolean {
  const needle = query.toLowerCase();
  return (
    customer.name.toLowerCase().includes(needle) ||
    (customer.email ?? "").toLowerCase().includes(needle) ||
    customer.phone.toLowerCase().includes(needle)
  );
}
