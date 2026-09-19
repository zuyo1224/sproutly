// lib/clamp.ts clamp 的行為固定測試。
//
// 為什麼要有這份：theme-scale／hero-image-bounds／product-quantity 八支命名 clamp
// 都改吃這一支，最容易被順手改壞的是「要跟原本手寫的 Math.max(min, Math.min(max, v))
// 完全一樣」——這裡把邊界、NaN 穿透、±Infinity 夾到邊界三種寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clamp } from "./clamp.ts";

describe("clamp", () => {
  it("範圍內原樣回、超出夾到邊界、邊界本身不動", () => {
    assert.equal(clamp(1.5, 1, 2.5), 1.5);
    assert.equal(clamp(0.2, 1, 2.5), 1);
    assert.equal(clamp(9, 1, 2.5), 2.5);
    assert.equal(clamp(1, 1, 2.5), 1);
    assert.equal(clamp(2.5, 1, 2.5), 2.5);
  });

  it("NaN 進來還是 NaN 出去（有限數的守門在呼叫端）", () => {
    assert.ok(Number.isNaN(clamp(NaN, 0, 1)));
  });

  it("±Infinity 夾到邊界", () => {
    assert.equal(clamp(Infinity, 3, 12), 12);
    assert.equal(clamp(-Infinity, 3, 12), 3);
  });

  it("跟兩種手寫順序逐一相同", () => {
    for (const v of [-5, 0, 0.5, 0.75, 1, 2.5, 3, 3.01, 99, 100, NaN, Infinity, -Infinity]) {
      for (const [min, max] of [[0, 1], [0.5, 3], [0.75, 3], [1, 99], [3, 12]]) {
        const a = Math.max(min, Math.min(max, v));
        const b = Math.min(max, Math.max(min, v));
        assert.ok(Object.is(clamp(v, min, max), a) && Object.is(a, b), `${v} in [${min},${max}]`);
      }
    }
  });
});
