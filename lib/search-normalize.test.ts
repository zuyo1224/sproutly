// lib/search-normalize.ts 搜尋文字正規化的行為固定測試。
//
// 為什麼要有這份：商品、客人、訂單三個搜尋入口都吃這支，中文輸入法打出的全形英數
// （ｄａｎｎｙ、５號盆）要跟資料裡的半形對得上。之前只透過各入口間接用到，這裡直接
// 把「全形英數與符號轉半形、全形空白轉半形、轉小寫、中文不動」寫死，改壞一處三個
// 入口一起搜不到。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchText } from "./search-normalize.ts";

describe("normalizeSearchText", () => {
  it("全形英文轉半形再轉小寫", () => {
    assert.equal(normalizeSearchText("ｄａｎｎｙ"), "danny");
    assert.equal(normalizeSearchText("ＭＯＮＳＴＥＲＡ"), "monstera");
  });

  it("全形數字與符號轉半形", () => {
    assert.equal(normalizeSearchText("５號盆"), "5號盆");
    assert.equal(normalizeSearchText("ａ＠ｂ．ｃｏｍ"), "a@b.com");
    assert.equal(normalizeSearchText("！～"), "!~");
  });

  it("全形空白轉半形空白", () => {
    assert.equal(normalizeSearchText("龜背芋　大盆"), "龜背芋 大盆");
  });

  it("半形大寫轉小寫，中文與已是半形的字不動", () => {
    assert.equal(normalizeSearchText("Danny"), "danny");
    assert.equal(normalizeSearchText("太和工房"), "太和工房");
    assert.equal(normalizeSearchText("tr55 保溫瓶"), "tr55 保溫瓶");
  });

  it("空字串回空字串", () => {
    assert.equal(normalizeSearchText(""), "");
  });
});
