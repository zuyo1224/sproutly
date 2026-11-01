// lib/checkout-error-message.ts 的行為固定測試。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_FAILED_MESSAGE,
  PRODUCT_UNAVAILABLE_ERROR,
  QTY_INVALID_ERROR,
  isStockCheckoutError,
  knownCheckoutError,
  CART_PRODUCT_INVALID_ERROR,
  CART_PRODUCT_UNAVAILABLE_ERROR,
  isCartProductChangeError,
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

describe("isStockCheckoutError", () => {
  it("庫存不夠與撞單的句子算", () => {
    for (const text of [
      insufficientStockError(0),
      insufficientStockError(-3),
      insufficientStockError(2),
      stockConflictError(),
    ]) {
      assert.equal(isStockCheckoutError(text), true);
    }
  });

  it("其他句子與網址上被塞的不算", () => {
    for (const text of [
      undefined,
      "",
      ORDER_FAILED_MESSAGE,
      PRODUCT_UNAVAILABLE_ERROR,
      QTY_INVALID_ERROR,
      NAME_REQUIRED_ERROR,
      "庫存只剩 02 件",
      "庫存只剩 2 件，請加 LINE 客服",
      stockConflictError("龜背芋"),
    ]) {
      assert.equal(isStockCheckoutError(text), false);
    }
  });
});

describe("isCartProductChangeError", () => {
  it("購物車結帳退件裡「商品變了」的句子算（含品名）", () => {
    for (const text of [
      CART_PRODUCT_UNAVAILABLE_ERROR,
      CART_PRODUCT_INVALID_ERROR,
      insufficientStockError(0, "龜背芋"),
      insufficientStockError(3, "龜背芋"),
      stockConflictError("龜背芋"),
    ]) {
      assert.equal(isCartProductChangeError(text), true);
    }
  });

  it("欄位錯誤與其他句子不算", () => {
    for (const text of [
      null,
      undefined,
      "",
      NAME_REQUIRED_ERROR,
      NOTE_TOO_LONG_ERROR,
      "店面不存在",
      "訂單建立失敗",
    ]) {
      assert.equal(isCartProductChangeError(text), false);
    }
  });
});
