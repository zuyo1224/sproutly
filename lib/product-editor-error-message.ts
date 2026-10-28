// 後台新增商品頁（products/new）與編輯商品頁（products/[id]/edit）紅色提醒框能顯示哪些句子。
//
// 兩頁的 ?error= 是任何人都能改的網址參數，以前照原樣顯示在 Sproutly 後台頁上：有人可以
// 做一條 /dashboard/stores/某店/products/new?error=此商品涉及違規，請加 LINE 客服補件 的連結
// 傳給商家，商家登入後看到的就像平台自己的提醒。頁面改成只顯示同目錄 actions.ts 的
// createProduct、updateProduct、duplicateProduct 真的會帶回來的句子，其他當沒有提醒。
import { DB_ERROR_TEXTS } from "./db-error-message.ts";
import {
  PRODUCT_NAME_REQUIRED_ERROR,
  PRICE_REQUIRED_ERROR,
  PRICE_INVALID_ERROR,
  PRICE_TOO_LARGE_ERROR,
  PRODUCT_NAME_TOO_LONG_ERROR,
  PRODUCT_DESC_TOO_LONG_ERROR,
  PRODUCT_FORM_FALLBACK_ERROR,
  STOCK_NOT_INTEGER_ERROR,
  STOCK_TOO_LARGE_ERROR,
} from "./product-form.ts";
import { MAX_IMAGE_URL_LEN } from "./product-limits.ts";
import {
  IMAGE_UPLOAD_FAILED_ERROR,
  NOT_IMAGE_CONTENT_ERROR,
  UNSUPPORTED_IMAGE_ERROR,
} from "./upload-image-type.ts";

export const IMAGE_PROCESS_FALLBACK_ERROR = "圖片處理失敗";
export const IMAGE_URL_TOO_LONG_ERROR = `圖片網址最多 ${MAX_IMAGE_URL_LEN} 個字`;
export const IMAGE_URL_NOT_HTTPS_ERROR =
  "圖片網址要是 https:// 開頭的完整網址（例如 https://example.com/photo.jpg），這串店面不會放這張圖";
export const DUPLICATE_FAILED_ERROR = "複製失敗，再試一次";

const KNOWN_TEXTS = new Set<string>([
  PRODUCT_NAME_REQUIRED_ERROR,
  PRICE_REQUIRED_ERROR,
  PRICE_INVALID_ERROR,
  PRICE_TOO_LARGE_ERROR,
  PRODUCT_NAME_TOO_LONG_ERROR,
  PRODUCT_DESC_TOO_LONG_ERROR,
  PRODUCT_FORM_FALLBACK_ERROR,
  STOCK_NOT_INTEGER_ERROR,
  STOCK_TOO_LARGE_ERROR,
  UNSUPPORTED_IMAGE_ERROR,
  NOT_IMAGE_CONTENT_ERROR,
  IMAGE_UPLOAD_FAILED_ERROR,
  IMAGE_PROCESS_FALLBACK_ERROR,
  IMAGE_URL_TOO_LONG_ERROR,
  IMAGE_URL_NOT_HTTPS_ERROR,
  DUPLICATE_FAILED_ERROR,
  ...DB_ERROR_TEXTS,
]);

export function knownProductEditorError(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return KNOWN_TEXTS.has(text) ? text : undefined;
}
