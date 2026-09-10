// 訂單改狀態時「時間章要不要蓋、要不要擦掉」的單一來源。
//
// sproutly_orders 上有兩個時間欄位：shipped_at（什麼時候出的貨）、paid_at（什麼時候收到錢）。
// 這兩個時間是商家對帳與客人查進度的依據，寫進去的規則其實有四條，而且每一條都有它的
// 由來，不是「有改就蓋現在」那麼單純：
//
// 1. 只在真的「切換進」那個狀態時蓋章。詳情頁的表單每次存檔都同時送出狀態與付款兩個欄位，
//    若不比對舊值，一筆早就出貨的單只是被商家點進去改個付款，出貨時間就被蓋成今天。
// 2. 已經蓋過就不再蓋。訂單列表那顆「往下推一格」按鈕連按、或之前付過又退款後再標一次
//    已付款，第二次不能把原本的時間改寫成後來的時間。
// 3. 誤按出貨後改回待確認／已確認，要把錯蓋的出貨章擦掉（已完成／已取消保留，那兩個狀態
//    是走完流程，貨確實出過）。
// 4. 誤按已付款後改回未付款，要擦掉付款章；改成已退款則保留（錢確實付過，只是退回去了）。
//
// 這四條原本抄在三支 server action 裡：訂單詳情頁的 updateOrderStatus（五選一下拉，四條都有）、
// 訂單列表的 advanceOrderStatus 與 markOrderPaid（各只用到 1、2 兩條）。後兩支的註解甚至自己
// 寫著「規則跟詳情頁逐字一樣」——真的是逐字重打的。日後任何一條改了（例如以後想讓「已完成」
// 也補蓋出貨章、或多一個 delivered_at），漏改一處的樣子都很安靜：畫面不會噴錯，只是同一筆單
// 從列表推跟從詳情頁改，資料庫裡留下的時間不一樣，對帳時才發現。收成這兩支，三處吃同一條。
//
// 回傳的是「這次要寫進去的欄位」：值沒變就回空物件（呼叫端據此判斷「這次什麼都不用改」），
// 有變才帶 status／payment_status 與可能的時間章。合法值檢查不在這裡做（那是各 action 自己的
// 職責，詳情頁要擋表單亂送、列表那兩支則是只走固定的一格），這裡只管「值換成這個之後，
// 時間欄位該長什麼樣」。now 可以傳進來是為了測試能盯住蓋的是不是同一個時刻。

export function orderStatusUpdates(
  current: { status: string | null; shipped_at: string | null },
  next: string,
  now: string = new Date().toISOString()
): Record<string, unknown> {
  // 值沒變就不是一次「切換」，四條規則一條都不適用，整筆不用寫。
  if (next === current.status) return {};

  const updates: Record<string, unknown> = { status: next };
  if (next === "shipped" && !current.shipped_at) {
    updates.shipped_at = now;
  }
  // 往回退到流程前段才擦章。列表那顆「往下推一格」只會往前走、走不到這兩個值，
  // 所以對它來說這條等於沒作用，共用不會改變它原本的行為。
  if ((next === "pending" || next === "confirmed") && current.shipped_at) {
    updates.shipped_at = null;
  }
  return updates;
}

export function orderPaymentUpdates(
  current: { payment_status: string | null; paid_at: string | null },
  next: string,
  now: string = new Date().toISOString()
): Record<string, unknown> {
  if (next === current.payment_status) return {};

  const updates: Record<string, unknown> = { payment_status: next };
  if (next === "paid" && !current.paid_at) {
    updates.paid_at = now;
  }
  // 只有退回「未付款」才擦章；已退款保留原本的付款時間。
  if (next === "unpaid" && current.paid_at) {
    updates.paid_at = null;
  }
  return updates;
}
