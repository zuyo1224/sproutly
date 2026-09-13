// lib/round-to.ts roundTo 的行為固定測試。
//
// 為什麼要有這份：app/[slug]/page.tsx 十處字距／行距／字級的小數都走這一支，
// 最容易被順手改壞的是「要跟手寫的 Math.round(x * 1000) / 1000 完全一樣」——
// 這裡把浮點加法的髒尾數、.5 平手、負數三種寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { roundTo } from "./round-to.ts";

describe("roundTo", () => {
  it("小數第三位：把浮點加法的髒尾數收掉", () => {
    assert.equal(roundTo(0.02 + 0.05, 3), 0.07);
    assert.equal(roundTo(0.32 - 0.03, 3), 0.29);
    assert.equal(roundTo(1.6 * 1.05, 3), 1.68);
  });

  it("小數第一位：字級 px 用", () => {
    assert.equal(roundTo(10 * 1.15, 1), 11.5);
    assert.equal(roundTo(10 * 0.85, 1), 8.5);
  });

  it("跟手寫的 Math.round(x * 10^N) / 10^N 逐一相同", () => {
    for (const x of [0.0005, 0.0015, 1.2345, -0.0005, -1.2345, 0.875 * 1.2, 12.34]) {
      assert.equal(roundTo(x, 3), Math.round(x * 1000) / 1000);
      assert.equal(roundTo(x, 1), Math.round(x * 10) / 10);
    }
  });

  it("負數與 0 位小數", () => {
    assert.equal(roundTo(-0.019999999999999997, 3), -0.02);
    assert.equal(roundTo(2.5, 0), 3);
  });
});
