// lib/sum-order-cents.ts sumOrderCents 的行為固定測試。
//
// 首頁四張指標、訂單列表、客人列表、客人匯出至少八處的「這批單一共多少錢」都走這支。
// 很小，但改壞（例如有人改成加 subtotal_cents）八處一起錯，且營收數字看起來仍像個數字。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sumOrderCents } from "./sum-order-cents.ts";

describe("sumOrderCents", () => {
  it("空陣列回 0", () => {
    assert.equal(sumOrderCents([]), 0);
  });

  it("逐筆加總 total_cents，其他欄位不影響", () => {
    const orders = [
      { total_cents: 100, subtotal_cents: 999 },
      { total_cents: 250, subtotal_cents: 999 },
      { total_cents: 0 },
    ];
    assert.equal(sumOrderCents(orders), 350);
  });

  it("不動傳入的陣列", () => {
    const orders = [{ total_cents: 1 }, { total_cents: 2 }];
    sumOrderCents(orders);
    assert.deepEqual(orders, [{ total_cents: 1 }, { total_cents: 2 }]);
  });
});
