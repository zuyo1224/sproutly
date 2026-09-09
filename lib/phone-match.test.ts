// lib/phone-match.ts 客人電話比對口徑的行為固定測試。
//
// 為什麼要有這份：查訂單頁拿「編號＋電話」核對身份，訂單上存的是客人當時打的原文，
// 格式一變（連字號、空白、+886、全形）就對不上，客人拿對的資料也被說查無訂單。
// 之前只透過 group-orders-by-customer 間接測到 samePhone，這裡直接把 phoneDigits
// 的正規化規則與 samePhone「空對空不算相符」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { phoneDigits, samePhone } from "./phone-match.ts";

describe("phoneDigits", () => {
  it("null／undefined／空字串回空字串", () => {
    assert.equal(phoneDigits(null), "");
    assert.equal(phoneDigits(undefined), "");
    assert.equal(phoneDigits(""), "");
  });

  it("只留數字：連字號、空白、括號、點全部丟", () => {
    assert.equal(phoneDigits("0912-345-678"), "0912345678");
    assert.equal(phoneDigits("0912 345 678"), "0912345678");
    assert.equal(phoneDigits("(02) 2345.6789"), "0223456789");
  });

  it("全形數字轉半形", () => {
    assert.equal(phoneDigits("０９１２３４５６７８"), "0912345678");
    assert.equal(phoneDigits("０９１２-３４５-６７８"), "0912345678");
  });

  it("+886 國碼還原成本地 0 開頭", () => {
    assert.equal(phoneDigits("+886912345678"), "0912345678");
    assert.equal(phoneDigits("+886 912 345 678"), "0912345678");
    assert.equal(phoneDigits("886912345678"), "0912345678");
  });

  it("886 只在最前面才當國碼，號碼中段的 886 不動", () => {
    assert.equal(phoneDigits("0988612345"), "0988612345");
  });

  it("只剩字母或符號、沒半個數字：回空字串", () => {
    assert.equal(phoneDigits("abc"), "");
    assert.equal(phoneDigits("---"), "");
  });
});

describe("samePhone", () => {
  it("同一支不同寫法都相符", () => {
    assert.equal(samePhone("0912-345-678", "0912345678"), true);
    assert.equal(samePhone("+886912345678", "0912 345 678"), true);
    assert.equal(samePhone("０９１２３４５６７８", "0912-345-678"), true);
  });

  it("數字不同就不相符，差一碼也不行", () => {
    assert.equal(samePhone("0912345678", "0912345679"), false);
    assert.equal(samePhone("0912345678", "091234567"), false);
  });

  it("空對空不算相符：沒填電話的訂單不能被空查詢撈到", () => {
    assert.equal(samePhone("", ""), false);
    assert.equal(samePhone(null, null), false);
    assert.equal(samePhone(undefined, ""), false);
    assert.equal(samePhone("---", "abc"), false);
  });

  it("一邊空一邊有也不相符", () => {
    assert.equal(samePhone("0912345678", ""), false);
    assert.equal(samePhone(null, "0912345678"), false);
  });
});
