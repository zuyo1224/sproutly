// 依 id 清單向 /[slug]/favorites/api 補商品資料（名稱／價格／庫存／圖）：購物車頁與
// 結帳頁各抄一份逐字相同的「!res.ok 就丟、回非陣列就丟」防呆——收成這裡的單一來源。
// 車裡的 id／數量存在 localStorage，這支只負責去補顯示欄位。回非陣列（API 異常回了
// 物件／錯誤）當讀取失敗而 throw，讓呼叫端 catch 掛 failed、別讓後面 products.map 炸頁。
// idsParam 是呼叫端已用逗號 join 好的 id 字串（是否排序由呼叫端決定），這裡只負責 encode。
// 泛型回傳讓兩頁各自 cast 自己的本地 Product 型別，不必在 lib 綁一份共用型別。
export async function fetchProductsByIds<T>(
  slug: string,
  idsParam: string
): Promise<T[]> {
  const res = await fetch(
    `/${slug}/favorites/api?ids=${encodeURIComponent(idsParam)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`商品資料抓取失敗: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("商品資料抓取: 回傳非陣列");
  return data as T[];
}
