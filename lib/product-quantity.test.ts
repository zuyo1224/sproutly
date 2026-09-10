// lib/product-quantity.ts 的行為固定測試。
//
// 兩個結帳後端「不信任前端傳來的數量」那層驗證只認這支。放寬了就等於讓改過的請求
// 用 qty: -5 或 0.5 進來（金額算出來是負的或小數分）；收緊了則是選得到的數量結帳
// 被拒。這裡把 1-99 的上下限與「只收整數」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QTY_MIN, QTY_MAX, isValidQty } from "./product-quantity.ts";

describe("上下限本身", () => {
  it("是 1 到 99", () => {
    assert.equal(QTY_MIN, 1);
    assert.equal(QTY_MAX, 99);
  });
});

describe("isValidQty 範圍", () => {
  it("兩端剛好合法（含等於）", () => {
    assert.equal(isValidQty(QTY_MIN), true);
    assert.equal(isValidQty(QTY_MAX), true);
  });

  it("中間值合法", () => {
    assert.equal(isValidQty(7), true);
  });

  it("0 與負數不合法", () => {
    assert.equal(isValidQty(0), false);
    assert.equal(isValidQty(-1), false);
    assert.equal(isValidQty(-5), false);
  });

  it("超過上限不合法", () => {
    assert.equal(isValidQty(QTY_MAX + 1), false);
    assert.equal(isValidQty(9999), false);
  });
});

describe("isValidQty 非整數與非數字", () => {
  it("小數不合法（算出來會是小數分）", () => {
    assert.equal(isValidQty(1.5), false);
    assert.equal(isValidQty(0.5), false);
  });

  it("NaN 與正負無限大不合法", () => {
    assert.equal(isValidQty(NaN), false);
    assert.equal(isValidQty(Infinity), false);
    assert.equal(isValidQty(-Infinity), false);
  });

  it("數字字串不合法（不做隱式轉型，前端得送數字）", () => {
    assert.equal(isValidQty("3"), false);
    assert.equal(isValidQty("3 件"), false);
  });

  it("null／undefined／布林／物件／陣列一律不合法", () => {
    assert.equal(isValidQty(null), false);
    assert.equal(isValidQty(undefined), false);
    assert.equal(isValidQty(true), false);
    assert.equal(isValidQty({}), false);
    assert.equal(isValidQty([1]), false);
  });
});
