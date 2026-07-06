import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// 對庫存做「加減 delta」的比對更新，結帳 rollback 與後台取消/取消復原共用這一份。
//
// 以前的 rollback 是把庫存整欄寫回下單前抄下的舊值。問題在扣減到 rollback 之間
// 有空檔：這段時間別的客人下單成功、庫存已經又被扣過，一蓋舊值就把別人買走的
// 份憑空補回來——賣 5 件的商品可能收到 8 件的單。扣減那邊都有做「先比對再更新」
// 防超賣，rollback 卻直接覆蓋，是同一個問題的半套。
//
// 這裡改成跟扣減同款的比對更新：讀當下庫存 → 只在庫存還是那個值時 +delta，
// 被別人搶先改掉就重讀重試。重試幾次不成就放掉，不把錯誤丟回去蓋掉呼叫端
// 原本要回報的訊息（少補一次庫存，比整個流程掛掉好）。
//
// delta 可以是負的（取消單又復原時把庫存扣回去）。扣回去允許變成負數：
// 這段空檔那件商品可能已被別的客人買走，負數老實呈現「賣超了」（前台的
// 售完判斷本來就把 <= 0 當售完），若在這裡夾成 0，取消→復原→再取消一輪
// 下來庫存會憑空多出來。
export async function adjustStock(
  admin: AdminClient,
  productId: string,
  delta: number
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row } = await admin
      .from("sproutly_products")
      .select("stock")
      .eq("id", productId)
      .maybeSingle();
    // 商品被刪、或商家這期間把庫存改成不限量，就沒有東西要調
    if (!row || row.stock === null) return;
    const { data: updated } = await admin
      .from("sproutly_products")
      .update({ stock: row.stock + delta })
      .eq("id", productId)
      .eq("stock", row.stock)
      .select("id");
    if (updated && updated.length > 0) return;
  }
}

// 訂單建立失敗時，把剛剛扣掉的庫存「加回去」——兩個結帳後端叫的是這個名字，
// 語意保留原樣（qty 為正、方向是補回）。
export async function restoreStock(
  admin: AdminClient,
  productId: string,
  qty: number
) {
  return adjustStock(admin, productId, qty);
}
