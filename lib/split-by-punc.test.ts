// lib/split-by-punc.ts 的行為固定測試。
//
// 為什麼要有這份：公開頁主標拆行跟編輯器預覽套字都吃這一支，最容易被順手改壞的是
// 「標點留在行尾」跟「空白／空行處理」——這裡把切點、trim、空字串三種寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splitByPunc } from "./split-by-punc.ts";

describe("splitByPunc", () => {
  it("切在全形標點後面、標點留在該行尾", () => {
    assert.deepEqual(splitByPunc("為你的角落，添一株綠。"), ["為你的角落，", "添一株綠。"]);
    assert.deepEqual(splitByPunc("一、二、三！四？"), ["一、", "二、", "三！", "四？"]);
  });

  it("沒標點就整句一行；半形標點不切", () => {
    assert.deepEqual(splitByPunc("慢慢長大的綠"), ["慢慢長大的綠"]);
    assert.deepEqual(splitByPunc("Hello, world."), ["Hello, world."]);
  });

  it("行首尾空白（含雙擊改字後 innerText 帶回的換行）去掉、空行丟掉", () => {
    assert.deepEqual(splitByPunc("為你的角落，\n添一株綠。"), ["為你的角落，", "添一株綠。"]);
    assert.deepEqual(splitByPunc("  只有空白  "), ["只有空白"]);
    assert.deepEqual(splitByPunc(""), []);
    assert.deepEqual(splitByPunc("。"), ["。"]);
  });
});
