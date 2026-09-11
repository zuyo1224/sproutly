// lib/truncate-text.ts truncateText 的行為固定測試。
//
// 為什麼要有這份：AI 助手兩個介面共用這一支把「改了什麼」的摘要截短。它很小，
// 但有兩條容易被順手改壞的界線：剛好等於上限不能截（否則每句摘要尾巴都多一個 …，
// 看起來像沒講完）、截點落在 emoji 中間不能切壞（切壞了摘要末尾出現問號方塊，
// 商家會以為 AI 回了亂碼）。這裡把這兩條與「上限 0、空字串」的邊界寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { truncateText } from "./truncate-text.ts";

describe("truncateText", () => {
  it("不超過上限原樣回傳，不補 …", () => {
    assert.equal(truncateText("療癒你的角落", 50), "療癒你的角落");
    assert.equal(truncateText("", 50), "");
  });

  it("剛好等於上限不截、多一個字就截", () => {
    assert.equal(truncateText("abcde", 5), "abcde");
    assert.equal(truncateText("abcdef", 5), "abcde…");
  });

  it("超過上限只留前 max 個字並補一個 …", () => {
    assert.equal(truncateText("一二三四五六七八九十", 4), "一二三四…");
    assert.equal(truncateText("hello world", 5), "hello…");
  });

  it("emoji 算一個字，截點落在 emoji 上不會切成半個", () => {
    // 🌱 在 UTF-16 裡佔兩個單位；照 .length 算 max=3 會從中間切開
    assert.equal(truncateText("ab🌱cd", 3), "ab🌱…");
    assert.equal(truncateText("🌱🌿🍀", 2), "🌱🌿…");
    assert.equal(truncateText("🌱🌿🍀", 3), "🌱🌿🍀");
  });

  it("上限 0 時只剩一個 …（空字串仍回空）", () => {
    assert.equal(truncateText("abc", 0), "…");
    assert.equal(truncateText("", 0), "");
  });
});
