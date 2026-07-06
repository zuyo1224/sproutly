import type { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all-rows";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// 客人列表頁與客人 CSV 匯出共用的「撈這家店全部未取消訂單」查詢。
//
// 以前兩邊各抄一份，而且都是一次 .select() 撈整家店——Supabase 一次查詢
// 最多回約 1000 列，店累積訂單超過之後，超出的單就默默不見：客人的
// 訂單筆數、累計消費、VIP／回購標籤全算少，而且沒下 .order，哪 1000 筆
// 被留下還隨每次查詢浮動，同一位客人重整頁面標籤可能忽有忽無。
// 跟 7f9d6d0 修掉的訂單匯出品項欄是同一種病，只是這次少的是訂單本身。
//
// 這裡下固定排序（created_at 舊→新、同時間再比 id 保證每頁切點穩定），
// 翻頁本身走共用的 fetchAllRows，多少單都撈得齊。
// 分群、統計等口徑照舊由呼叫端處理，這支只保證「單子有撈齊」。
export type CustomerOrderRow = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  total_cents: number;
  currency: string;
  payment_status: string;
  status: string;
  created_at: string;
};

export async function fetchCustomerOrders(
  supabase: ServerClient,
  merchantId: string
): Promise<CustomerOrderRow[]> {
  return fetchAllRows<CustomerOrderRow>(async (from, to) => {
    const { data } = await supabase
      .from("sproutly_orders")
      .select(
        "id, customer_id, customer_name, customer_email, customer_phone, total_cents, currency, payment_status, status, created_at"
      )
      .eq("merchant_id", merchantId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    return { data: data as CustomerOrderRow[] | null };
  });
}
