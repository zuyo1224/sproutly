// 依 id 清單向 /[slug]/favorites/api 補商品資料（名稱／價格／庫存／圖）：購物車頁、
// 結帳頁、收藏頁各抄一份逐字相同的「!res.ok 就丟、回非陣列就丟」防呆——收成這裡的單一來源。
// 車裡／收藏的 id 存在 localStorage，這支只負責去補顯示欄位。回非陣列（API 異常回了
// 物件／錯誤）當讀取失敗而 throw，讓呼叫端 catch 掛 failed、別讓後面 products.map 炸頁。
// idsParam 是呼叫端已用逗號 join 好的 id 字串（是否排序由呼叫端決定），這裡負責切批組網址。
// 泛型回傳讓各頁各自 cast 自己的本地 Product 型別，不必在 lib 綁一份共用型別。
//
// id 每 100 個切一批、各打一次 API（跟 API 那邊每 100 個一批下 in() 對齊）。以前整串塞
// 同一條網址：收藏沒有上限，客人收藏幾百件時 ?ids= 會長過 Vercel 那層的網址上限（約
// 380 個 UUID）被打回，收藏頁整頁變讀取失敗、購物車同樣拿不到商品資料。100 件以內
// 跟以前一樣只打一次、網址一字不變。任何一批失敗就整支 throw，不回半套：呼叫端只要
// 拿到一筆就會把沒回來的 id 當下架從 localStorage 清掉，半套結果會誤刪真收藏。
import { buildUrl } from "./url.ts";

const IDS_PER_REQUEST = 100;

export async function fetchProductsByIds<T>(
  slug: string,
  idsParam: string
): Promise<T[]> {
  const ids = Array.from(
    new Set(
      idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  if (ids.length === 0) return [];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    batches.push(ids.slice(i, i + IDS_PER_REQUEST));
  }
  const results = await Promise.all(
    batches.map(async (batch) => {
      const res = await fetch(
        buildUrl(`/${slug}/favorites/api`, { ids: batch.join(",") }),
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`商品資料抓取失敗: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("商品資料抓取: 回傳非陣列");
      return data as T[];
    })
  );
  return results.flat();
}
