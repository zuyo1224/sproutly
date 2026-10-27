// lib/order-detail-error-message.ts 的行為固定測試。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_CHANGED_ELSEWHERE_ERROR,
  knownOrderDetailError,
} from "./order-detail-error-message.ts";
import { DB_ERROR_FALLBACK, dbErrorMessage } from "./db-error-message.ts";

describe("knownOrderDetailError", () => {
  it("更新訂單流程會帶的句子照原樣回", () => {
    for (const text of [
      ORDER_CHANGED_ELSEWHERE_ERROR,
      dbErrorMessage({ code: "42501" }),
      dbErrorMessage({ code: "23514" }),
      dbErrorMessage({ message: "fetch failed" }),
      DB_ERROR_FALLBACK,
    ]) {
      assert.equal(knownOrderDetailError(text), text);
    }
  });

  it("網址上被塞的其他字句一律當沒有", () => {
    for (const text of [
      undefined,
      "",
      "這筆客人已退款，請改匯到某帳號",
      `${ORDER_CHANGED_ELSEWHERE_ERROR} `,
      `${DB_ERROR_FALLBACK}，請加 LINE 客服`,
    ]) {
      assert.equal(knownOrderDetailError(text), undefined);
    }
  });
});
