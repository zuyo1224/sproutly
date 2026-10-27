// 單品結帳頁（app/[slug]/checkout）紅色提醒框能顯示哪些句子。
//
// 結帳頁的 ?error= 是任何人都能改的網址參數，以前照原樣顯示在掛著店名的結帳頁上：
// 有人可以做一條 /某店/checkout?product_id=…&error=請先匯款到某帳號 的連結傳給客人，
// 看起來就像那家店自己的結帳提醒。頁面改成只顯示 placeOrder（同目錄 actions.ts）
// 真的會帶回來的句子，其他當沒有提醒。
import {
  ADDRESS_TOO_LONG_ERROR,
  EMAIL_TOO_LONG_ERROR,
  NAME_REQUIRED_ERROR,
  NAME_TOO_LONG_ERROR,
  NOTE_TOO_LONG_ERROR,
  PAYMENT_REQUIRED_ERROR,
  PHONE_NO_DIGITS_ERROR,
  PHONE_REQUIRED_ERROR,
  PHONE_TOO_LONG_ERROR,
  SHIPPING_REQUIRED_ERROR,
  STORE_TOO_LONG_ERROR,
} from "./checkout-fields.ts";
import { shippingDetailError } from "./order-labels.ts";
import { QTY_MAX, QTY_MIN } from "./product-quantity.ts";
import { insufficientStockError, stockConflictError } from "./product-stock.ts";

export const ORDER_FAILED_MESSAGE = "訂單沒有送出成功，請稍後再試一次";
export const QTY_INVALID_ERROR = `數量必須是 ${QTY_MIN}-${QTY_MAX}`;
export const PRODUCT_UNAVAILABLE_ERROR = "商品已下架";

const KNOWN_TEXTS = new Set<string>(
  [
    QTY_INVALID_ERROR,
    PRODUCT_UNAVAILABLE_ERROR,
    ORDER_FAILED_MESSAGE,
    // checkoutFieldsError 可能回的每一句
    NAME_REQUIRED_ERROR,
    NAME_TOO_LONG_ERROR,
    PHONE_REQUIRED_ERROR,
    PHONE_TOO_LONG_ERROR,
    PHONE_NO_DIGITS_ERROR,
    EMAIL_TOO_LONG_ERROR,
    PAYMENT_REQUIRED_ERROR,
    SHIPPING_REQUIRED_ERROR,
    shippingDetailError("cvs_711", null, null),
    shippingDetailError("home_delivery", null, null),
    STORE_TOO_LONG_ERROR,
    ADDRESS_TOO_LONG_ERROR,
    NOTE_TOO_LONG_ERROR,
    // 庫存（單品那條不帶品名）
    insufficientStockError(0),
    stockConflictError(),
  ].filter((t): t is string => Boolean(t))
);

// 「庫存只剩 N 件」的 N 是當下庫存，逐一列不完；拆出數字再用同一支函式組一次，
// 組出來一字不差才算數（擋掉 0、負數、前導 0 這些 placeOrder 不會帶的寫法）。
const STOCK_LEFT_RE = /^庫存只剩 (\d{1,9}) 件$/;

export function knownCheckoutError(text: string | undefined): string | undefined {
  if (!text) return undefined;
  if (KNOWN_TEXTS.has(text)) return text;
  const m = STOCK_LEFT_RE.exec(text);
  if (m && insufficientStockError(Number(m[1])) === text) return text;
  return undefined;
}
