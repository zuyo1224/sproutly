import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// 訂單建立失敗時，把剛剛扣掉的庫存「加回去」，兩個結帳後端共用這一份。
//
// 以前的 rollback 是把庫存整欄寫回下單前抄下的舊值。問題在扣減到 rollback 之間
// 有空檔：這段時間別的客人下單成功、庫存已經又被扣過，一蓋舊值就把別人買走的
// 份憑空補回來——賣 5 件的商品可能收到 8 件的單。扣減那邊都有做「先比對再更新」
// 防超賣，rollback 卻直接覆蓋，是同一個問題的半套。
//
// 這裡改成跟扣減同款的比對更新：讀當下庫存 → 只在庫存還是那個值時 +qty，
// 被別人搶先改掉就重讀重試。加回和扣減不同、失敗不會造成超賣（只是少補），
// 所以重試幾次不成就放掉，不把錯誤丟回去蓋掉原本要回報給客人的訊息。
export async function restoreStock(
  admin: AdminClient,
  productId: string,
  qty: number
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row } = await admin
      .from("sproutly_products")
      .select("stock")
      .eq("id", productId)
      .maybeSingle();
    // 商品被刪、或商家這期間把庫存改成不限量，就沒有東西要補
    if (!row || row.stock === null) return;
    const { data: updated } = await admin
      .from("sproutly_products")
      .update({ stock: row.stock + qty })
      .eq("id", productId)
      .eq("stock", row.stock)
      .select("id");
    if (updated && updated.length > 0) return;
  }
}
