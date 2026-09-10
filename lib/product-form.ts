// 後台商品表單的「讀欄位＋擋錯值」單一來源。
//
// 新增商品（createProduct）與編輯商品（updateProduct）各自抄了一份逐字相同的
// 開頭：讀同樣五個欄位、同樣先擋空品名再擋空價格、再同樣依序跑字數上限／價格／
// 庫存三道檢查。現在沒錯，問題在下次改：之後要加一個欄位（例如商品編號）、或
// 調一句錯誤訊息，得記得兩個檔都改，漏一個的結果是「從新增進來」跟「從編輯進來」
// 對同一筆輸入講的話不一樣，而且不報錯，要等商家自己撞到才發現。
//
// 這支只做純字串進、值出，不碰 DB、不碰上傳、不做跳轉——呼叫端拿到錯誤訊息後
// 各自 redirect 回自己那頁（新增頁與編輯頁的網址不同，那部分留在呼叫端）。
import {
  MAX_PRICE_YUAN,
  MAX_STOCK,
  MAX_PRODUCT_NAME_LEN,
  MAX_PRODUCT_DESC_LEN,
} from "./product-limits.ts";
import { formString, formStringOrNull } from "./form-fields.ts";

// 價格／庫存上限的數字本體在 lib/product-limits（表單的 max 屬性也吃同一份），
// 這裡負責在伺服器端真正擋下、丟中文訊息。
export function parsePrice(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("價格必須是非負數");
  if (n > MAX_PRICE_YUAN) {
    throw new Error(
      `價格最多 ${MAX_PRICE_YUAN.toLocaleString("zh-TW")} 元，確認一下是不是多打了幾個 0`
    );
  }
  return n;
}

export function parseStock(raw: string): number | null {
  if (raw === "") return null;
  const n = Number(raw);
  // 必須是非負整數：庫存欄只在瀏覽器端靠 <input type="number" step="1"> 擋小數，
  // 那層驗證能被繞過（停用 JS 直接送表單、或行動裝置數字鍵盤本來就打得出小數點）。
  // 沒有這條，"5.5" 會通過這裡、一路送進 DB 的 integer 欄位，Postgres 直接丟出
  // 「invalid input syntax for type integer」這種原始錯誤字串給商家看，看不懂哪裡錯。
  // 跟 lib/product-quantity 的 isValidQty（Number.isInteger 同時擋 NaN／小數／負數）
  // 同一個態度，這裡在插入前就攔下、換成看得懂的中文訊息。
  if (!Number.isInteger(n) || n < 0) throw new Error("庫存必須是非負整數或留空");
  if (n > MAX_STOCK) {
    throw new Error(`庫存最多 ${MAX_STOCK.toLocaleString("zh-TW")} 件，確認一下是不是多打了幾個 0`);
  }
  return n;
}

// 品名／描述的字數上限，跟價格／庫存同一套：數字在 lib/product-limits（表單的 maxLength
// 也吃同一份），這裡在伺服器端真正擋下。空品名的檢查在 readProductForm 裡（那句訊息跟
// 其他必填欄位同一組），這裡只管「太長」。
export function assertTextLimits(name: string, description: string | null) {
  if (name.length > MAX_PRODUCT_NAME_LEN) {
    throw new Error(`商品名稱最多 ${MAX_PRODUCT_NAME_LEN} 個字，長一點的說明放到描述欄`);
  }
  if (description && description.length > MAX_PRODUCT_DESC_LEN) {
    throw new Error(`商品描述最多 ${MAX_PRODUCT_DESC_LEN.toLocaleString("zh-TW")} 個字`);
  }
}

export type ProductFormValues = {
  name: string;
  description: string | null;
  /** 元，尚未換算成分；呼叫端用 lib/format-price 的 yuanToCents 轉 */
  price: number;
  /** null 代表「不管這件的庫存」，不是 0 */
  stock: number | null;
  isActive: boolean;
};

export type ProductFormResult =
  | { ok: true; value: ProductFormValues }
  | { ok: false; error: string };

/**
 * 讀商品表單的文字欄位並擋掉錯值。圖片（上傳檔與貼上的網址）不在這裡，
 * 那部分新增與編輯本來就不一樣。
 *
 * 檢查順序刻意固定：先空品名、再空價格，最後才是字數／價格／庫存三道，
 * 商家一次填錯多格時看到的是同一句話，不會因為進來的路不同而換一句。
 */
export function readProductForm(formData: FormData): ProductFormResult {
  const name = formString(formData, "name");
  const description = formStringOrNull(formData, "description");
  const priceRaw = formString(formData, "price");
  const stockRaw = formString(formData, "stock");
  const isActive = formData.get("is_active") === "on";

  if (!name) return { ok: false, error: "請填商品名稱" };
  if (!priceRaw) return { ok: false, error: "請填價格" };

  try {
    assertTextLimits(name, description);
    return {
      ok: true,
      value: {
        name,
        description,
        price: parsePrice(priceRaw),
        stock: parseStock(stockRaw),
        isActive,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "輸入錯誤" };
  }
}
