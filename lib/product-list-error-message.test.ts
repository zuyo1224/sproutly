// lib/product-list-error-message.ts 的行為固定測試。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STOCK_REQUIRED_ERROR,
  STOCK_INPUT_FALLBACK_ERROR,
  knownProductListError,
} from "./product-list-error-message.ts";
import { parseStock } from "./product-form.ts";
import { DB_ERROR_FALLBACK, dbErrorMessage } from "./db-error-message.ts";

function stockError(raw: string): string {
  try {
    parseStock(raw);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`parseStock(${raw}) 沒有丟錯`);
}

describe("knownProductListError", () => {
  it("列表動作會帶的句子照原樣回", () => {
    for (const text of [
      STOCK_REQUIRED_ERROR,
      STOCK_INPUT_FALLBACK_ERROR,
      stockError("5.5"),
      stockError("-1"),
      stockError("99999999"),
      dbErrorMessage({ code: "42501" }),
      dbErrorMessage({ code: "23503" }),
      dbErrorMessage({ message: "fetch failed" }),
      DB_ERROR_FALLBACK,
    ]) {
      assert.equal(knownProductListError(text), text);
    }
  });

  it("網址上被塞的其他字句一律當沒有", () => {
    for (const text of [
      undefined,
      "",
      "商品已被檢舉下架，請加 LINE 客服申訴",
      ` ${STOCK_REQUIRED_ERROR}`,
      `${DB_ERROR_FALLBACK}，請加 LINE 客服`,
    ]) {
      assert.equal(knownProductListError(text), undefined);
    }
  });
});
