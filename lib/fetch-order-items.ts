import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// 「一次撈一批訂單的品項」單一來源。訂單匯出 CSV（dashboard orders/export）與
// 客人的訂單紀錄（[slug]/account/orders）都要把一整份訂單名單的品項湊回每張單上，
// 兩處各抄了一份逐字相同的分批迴圈。
//
// 那份迴圈只解了一半的問題。它把訂單編號每 100 筆切一批塞進 .in()，解掉的是
// 「幾千個 id 塞同一個 .in() 會讓查詢網址過長」；但每一批仍然是單發一次 select，
// 而 Supabase 一次查詢最多回約 1000 列——這個上限管的是「回傳幾列」，不是
// 「in() 裡幾個 id」，切批完全沒動到它。100 張單只要平均超過 10 個品項就湊滿
// 1000 列，剩下的品項整列不回，而且沒有任何錯誤：匯出的 CSV 裡那些單「商品」欄
// 空白、「件數」變 0，客人的訂單紀錄卡片同樣變空白——畫面上明明看得到品項。
// 節慶湊單、批發客一次下十幾二十樣，一批 100 張單破 1000 列是正常量，不是極端值。
// 兩處的註解都寫著「比照訂單匯出／回列數一樣吃 1000 上限」，可見本來就想擋這件事，
// 只是擋的手段沒對上——訂單本體那層早就換成 fetchAllRows 翻頁撈齊了（b21488f），
// 品項這層還停在單發一次。
//
// 這裡把每一批也改走 fetchAllRows 翻頁，撈到不滿一頁為止。翻頁要靠穩定排序才不會
// 漏列或重複，所以下 order_id + id（品項表的 uuid 主鍵）兩層排序當固定切點。
// 呼叫端拿到的是攤平的品項列，怎麼分群、怎麼顯示照舊各自處理。
export type OrderItemRow = {
  order_id: string;
  name_snapshot: string;
  quantity: number;
  price_cents_snapshot: number;
};

// 一批的訂單編號上限。這條管的是查詢網址長度（id 是 36 字的 uuid），
// 跟上面那條 1000 列上限是兩回事，兩條都要顧。
const ID_CHUNK = 100;

export async function fetchOrderItems(
  supabase: ServerClient,
  orderIds: string[]
): Promise<OrderItemRow[]> {
  const all: OrderItemRow[] = [];
  for (let i = 0; i < orderIds.length; i += ID_CHUNK) {
    const ids = orderIds.slice(i, i + ID_CHUNK);
    const page = await fetchAllRows<OrderItemRow>(async (from, to) => {
      const { data } = await supabase
        .from("sproutly_order_items")
        .select("order_id, name_snapshot, quantity, price_cents_snapshot")
        .in("order_id", ids)
        .order("order_id", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      return { data: data as OrderItemRow[] | null };
    });
    all.push(...page);
  }
  return all;
}
