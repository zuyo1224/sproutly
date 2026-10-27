// lib/checkout-error-message.ts 的行為固定測試。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_FAILED_MESSAGE,
  PRODUCT_UNAVAILABLE_ERROR,
  QTY_INVALID_ERROR,
  knownCheckoutError,
} from "./checkout-error-message.ts";
import { NAME_REQUIRED_ERROR, NOTE_TOO_LONG_ERROR } from "./checkout-fields.ts";
import { shippingDetailError } from "./order-labels.ts";
import { insufficientStockError, stockConflictError } from "./product-stock.ts";

describe("knownCheckoutError", () => {
  it("下單流程會帶的句子照原樣回", () => {
    for (const text of [
      ORDER_FAILED_MESSAGE,
      PRODUCT_UNAVAILABLE_ERROR,
      QTY_INVALID_ERROR,
      NAME_REQUIRED_ERROR,
      NOTE_TOO_LONG_ERROR,
      shippingDetailError("cvs_family", null, null)!,
      shippingDetailError("home_delivery", null, null)!,
      insufficientStockError(0),
      insufficientStockError(-3),
      insufficientStockError(2),
      insufficientStockError(120),
      stockConflictError(),
    ]) {
      assert.equal(knownCheckoutError(text), text);
    }
  });

  it("網址上被塞的其他字句一律當沒有", () => {
    for (const text of [
      undefined,
      "",
      "請先匯款到 012-3456789，再回來下單",
      "庫存只剩 0 件",
      "庫存只剩 02 件",
      "庫存只剩 -1 件",
      "庫存只剩 2 件，請加 LINE 客服",
      `${ORDER_FAILED_MESSAGE} `,
      stockConflictError("龜背芋"),
    ]) {
      assert.equal(knownCheckoutError(text), undefined);
    }
  });
});
