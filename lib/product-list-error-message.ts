// 後台商品列表頁（app/dashboard/stores/[slug]/products）紅色提醒框能顯示哪些句子。
//
// 列表頁的 ?error= 是任何人都能改的網址參數，以前截到 200 字後照原樣顯示在 Sproutly
// 後台頁上：有人可以做一條 /dashboard/stores/某店/products?error=商品已被檢舉下架，請加 LINE 客服申訴
// 的連結傳給商家，商家登入後看到的就像平台自己的提醒。頁面改成只顯示同目錄 actions.ts
// 的列表動作（改庫存、上下架、調順序、刪除）真的會帶回來的句子，其他當沒有提醒。
import { DB_ERROR_TEXTS } from "./db-error-message.ts";
import { STOCK_NOT_INTEGER_ERROR, STOCK_TOO_LARGE_ERROR } from "./product-form.ts";

export const STOCK_REQUIRED_ERROR =
  "請填庫存數字。要改成不管這件的庫存，請進商品編輯頁把庫存清空";
export const STOCK_INPUT_FALLBACK_ERROR = "庫存輸入錯誤";

const KNOWN_TEXTS = new Set<string>([
  STOCK_REQUIRED_ERROR,
  STOCK_INPUT_FALLBACK_ERROR,
  STOCK_NOT_INTEGER_ERROR,
  STOCK_TOO_LARGE_ERROR,
  ...DB_ERROR_TEXTS,
]);

export function knownProductListError(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return KNOWN_TEXTS.has(text) ? text : undefined;
}
