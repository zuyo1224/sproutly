// lib/is-plain-object.ts isPlainObject 的行為固定測試。
//
// 為什麼要有這份：resolveTheme 與 AI patch 過濾共用這一支決定「要不要把值當物件讀」。
// 最容易被順手改壞的是兩條：null 不能過（typeof null 是 "object"）、陣列不能過
// （過了 Object.entries 會把索引當鍵收進 theme）。這裡把這兩條與常見型別寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPlainObject } from "./is-plain-object.ts";

describe("isPlainObject", () => {
  it("一般物件（含空物件）算", () => {
    assert.equal(isPlainObject({}), true);
    assert.equal(isPlainObject({ preset: "aesop" }), true);
    assert.equal(isPlainObject(Object.create(null)), true);
  });

  it("null 與 undefined 不算", () => {
    assert.equal(isPlainObject(null), false);
    assert.equal(isPlainObject(undefined), false);
  });

  it("陣列不算（避免索引被當成鍵）", () => {
    assert.equal(isPlainObject([]), false);
    assert.equal(isPlainObject([{ x: 1 }]), false);
  });

  it("字串、數字、布林、函式不算", () => {
    assert.equal(isPlainObject("aesop"), false);
    assert.equal(isPlainObject(0), false);
    assert.equal(isPlainObject(true), false);
    assert.equal(isPlainObject(() => {}), false);
  });
});
