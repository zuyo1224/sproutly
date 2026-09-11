// lib/jsonb-text.ts jsonbText 的行為固定測試。
//
// 為什麼要有這份：business_hours／faq 七個讀取端全靠這一支，最怕的是「沒填」的各種樣子
// （null、沒有 text 鍵、text 不是字串）有一種漏出去變成 undefined 或數字，關於頁拿去
// .split 就炸。這裡把有填／沒填的邊界寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsonbText } from "./jsonb-text.ts";

describe("jsonbText", () => {
  it("{ text } 有字串就原樣回（不 trim，交給呼叫端）", () => {
    assert.equal(jsonbText({ text: "週一至週五 10:00-18:00" }), "週一至週五 10:00-18:00");
    assert.equal(jsonbText({ text: "  " }), "  ");
    assert.equal(jsonbText({ text: "" }), "");
  });

  it("null／undefined（設定頁沒填存 null）回空字串", () => {
    assert.equal(jsonbText(null), "");
    assert.equal(jsonbText(undefined), "");
  });

  it("物件但沒有 text 鍵、或 text 不是字串，回空字串", () => {
    assert.equal(jsonbText({}), "");
    assert.equal(jsonbText({ hours: "10-18" }), "");
    assert.equal(jsonbText({ text: 123 }), "");
    assert.equal(jsonbText({ text: null }), "");
  });

  it("陣列、字串、數字這些不是物件的值回空字串", () => {
    assert.equal(jsonbText([{ text: "x" }]), "");
    assert.equal(jsonbText("10:00-18:00"), "");
    assert.equal(jsonbText(0), "");
  });
});
