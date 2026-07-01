/**
 * 把一批訂單的 total_cents 逐筆加總（回傳分為單位的整數）。
 *
 * 「這批單一共多少錢」的加總 `.reduce((sum, o) => sum + o.total_cents, 0)`
 * 原本散在首頁四張指標、訂單列表、客人列表、客人匯出至少八處各抄一份。
 * 收成單一來源，「加總的是 total_cents 這個欄位」的語意只寫一次。
 *
 * 呼叫端若手上是可能為 null 的陣列（例如 Supabase 回來的 `allOrders?`），
 * 傳 `list ?? []` 進來即可，本函式不做 null 判斷，空陣列自然回 0。
 */
export function sumOrderCents(
  orders: readonly { total_cents: number }[]
): number {
  return orders.reduce((sum, o) => sum + o.total_cents, 0);
}
