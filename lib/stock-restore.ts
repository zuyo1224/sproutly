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

export type DecrementStockResult =
  | { ok: true; decremented: boolean }
  | { ok: false; reason: "insufficient"; stock: number }
  | { ok: false; reason: "conflict" };

// 結帳時的「扣庫存」，兩個結帳後端共用。
//
// 以前兩邊都是拿頁面早前讀到的庫存值做一次比對更新，失敗就整單退回。
// 問題在「早前讀到的值」很容易過期：兩個客人前後腳買同一件商品，後寫入
// 的那位比對必落空——即使庫存還有幾十件，也被告知「庫存剛被搶光」，
// 整張填好的結帳表白填。熱門商品湊單期間幾乎必發生。
//
// 這裡改成跟 adjustStock 同款：每次重讀當下庫存、夠就比對扣減，被別人
// 搶先改掉就重讀重試。只有兩種情況才真的失敗：庫存真的不夠（insufficient，
// 帶當下剩量給呼叫端組訊息），或連續搶輸太多次（conflict，讓客人重試）。
// decremented 回報「有沒有真的扣」：商品這期間被商家改成不限量（stock 變
// null）就沒東西可扣，呼叫端 rollback 時憑這個 flag 決定要不要補回。
export async function decrementStock(
  admin: AdminClient,
  productId: string,
  qty: number
): Promise<DecrementStockResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row } = await admin
      .from("sproutly_products")
      .select("stock")
      .eq("id", productId)
      .maybeSingle();
    // 商品這期間被刪掉：當成沒貨退回，別讓訂單掛在不存在的商品上
    if (!row) return { ok: false, reason: "insufficient", stock: 0 };
    if (row.stock === null) return { ok: true, decremented: false };
    if (row.stock < qty) {
      return { ok: false, reason: "insufficient", stock: row.stock };
    }
    const { data: updated } = await admin
      .from("sproutly_products")
      .update({ stock: row.stock - qty })
      .eq("id", productId)
      .eq("stock", row.stock)
      .select("id");
    if (updated && updated.length > 0) return { ok: true, decremented: true };
  }
  return { ok: false, reason: "conflict" };
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
