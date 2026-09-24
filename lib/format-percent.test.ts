// lib/format-percent.ts 的行為固定測試：不是全部就不能顯示 100%，不是零就不能顯示 0%。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPercent } from "./format-percent.ts";

describe("formatPercent", () => {
  it("一般情況照四捨五入", () => {
    assert.equal(formatPercent(1, 3), "33%");
    assert.equal(formatPercent(2, 3), "67%");
    assert.equal(formatPercent(1, 2), "50%");
  });

  it("全部才是 100%、零才是 0%", () => {
    assert.equal(formatPercent(5, 5), "100%");
    assert.equal(formatPercent(0, 5), "0%");
  });

  it("差一點全部不會變 100%，只有一點點不會變 0%", () => {
    assert.equal(formatPercent(199, 200), "99%");
    assert.equal(formatPercent(1, 300), "1%");
  });

  it("總數不是正數時回 0%", () => {
    assert.equal(formatPercent(0, 0), "0%");
    assert.equal(formatPercent(3, -1), "0%");
  });
});
