// 後台訂單詳情頁（app/dashboard/stores/[slug]/orders/[orderId]）紅色提醒框能顯示哪些句子。
//
// 詳情頁的 ?error= 是任何人都能改的網址參數，以前照原樣顯示在 Sproutly 後台頁上：
// 有人可以做一條 /dashboard/stores/某店/orders/某單?error=這筆客人已退款，請改匯到某帳號
// 的連結傳給商家，商家登入後看到的就像平台自己的提醒。頁面改成只顯示 updateOrderStatus
// （同目錄 actions.ts）真的會帶回來的句子，其他當沒有提醒。
import { DB_ERROR_TEXTS } from "./db-error-message.ts";

export const ORDER_CHANGED_ELSEWHERE_ERROR =
  "訂單剛被更新過（可能在別的視窗），請重新確認再操作";

const KNOWN_TEXTS = new Set<string>([ORDER_CHANGED_ELSEWHERE_ERROR, ...DB_ERROR_TEXTS]);

export function knownOrderDetailError(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return KNOWN_TEXTS.has(text) ? text : undefined;
}
