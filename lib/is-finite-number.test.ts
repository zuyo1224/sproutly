// lib/is-finite-number.ts isFiniteNumber 的行為固定測試。
//
// 為什麼要有這份：resolveTheme 與編輯器存檔共用這一支決定「要不要把值當數字丟進 clamp」。
// 最容易被順手改壞的是兩條：NaN／Infinity 不能過（typeof 是 "number" 但夾進 clamp
// 會出 NaN 樣式）、字串 "1.5" 不能過（這裡不轉型）。這裡把這兩條與常見型別寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isFiniteNumber } from "./is-finite-number.ts";

describe("isFiniteNumber", () => {
  it("一般數字（含 0、負數、小數）算", () => {
    assert.equal(isFiniteNumber(0), true);
    assert.equal(isFiniteNumber(-3), true);
    assert.equal(isFiniteNumber(1.5), true);
  });

  it("NaN 與正負無限大不算", () => {
    assert.equal(isFiniteNumber(NaN), false);
    assert.equal(isFiniteNumber(Infinity), false);
    assert.equal(isFiniteNumber(-Infinity), false);
  });

  it("不是 number 型別的一律不算（不做轉型）", () => {
    assert.equal(isFiniteNumber("1.5"), false);
    assert.equal(isFiniteNumber(null), false);
    assert.equal(isFiniteNumber(undefined), false);
    assert.equal(isFiniteNumber(true), false);
    assert.deepEqual(isFiniteNumber([1]), false);
  });
});
