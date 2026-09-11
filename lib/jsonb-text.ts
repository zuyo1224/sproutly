// 讀 sproutly_merchants 的 business_hours／faq 這兩格 jsonb 裡的文字。
//
// 為什麼要有這層：這兩格在 DB 是 jsonb，設定頁存檔時包成 { text: "..." }（沒填存 null）。
// 讀取端本來各自手抄 `typeof x === "object" && x !== null ? (x as { text?: string }).text ?? "" : ""`，
// 首頁、聯絡頁、關於頁、全站頁尾、後台總覽、設定頁共七處一模一樣；日後換存法只要改這裡。
//
// 判斷走 isPlainObject（null／陣列都當沒填），text 不是字串（手改 DB 塞了數字）也當沒填，
// 不然關於頁拿去 .split 會當場炸。回傳一律是字串，呼叫端要不要 trim 自己決定。
import { isPlainObject } from "./is-plain-object.ts";

export function jsonbText(v: unknown): string {
  if (!isPlainObject(v)) return "";
  return typeof v.text === "string" ? v.text : "";
}
