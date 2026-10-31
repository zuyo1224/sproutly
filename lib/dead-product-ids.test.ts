// lib/dead-product-ids.ts deadProductIds 的行為固定測試。
//
// 為什麼要有這份：購物車、收藏、最近看過三處清幽靈商品都吃這一支，最容易被順手改壞的是
// 「整批回空不清正常 UUID」這道安全閥，以及「非 UUID 不論回幾筆都清」這個例外。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deadProductIds } from "./dead-product-ids.ts";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("deadProductIds", () => {
  it("有撈回東西時，沒撈回的 UUID 算下架", () => {
    assert.deepEqual(deadProductIds([A, B], [A]), [B]);
  });

  it("全部撈回時一個都不清", () => {
    assert.deepEqual(deadProductIds([A, B], [B, A]), []);
  });

  it("整批回空時正常 UUID 留著不動（安全閥）", () => {
    assert.deepEqual(deadProductIds([A, B], []), []);
  });

  it("非 UUID 不論回幾筆都清（含空字串、含逗號）", () => {
    assert.deepEqual(deadProductIds(["abc", A, "", "x,y"], []), [
      "abc",
      "",
      "x,y",
    ]);
    assert.deepEqual(deadProductIds(["abc", A], [A]), ["abc"]);
  });

  it("保留原本順序、空清單回空", () => {
    assert.deepEqual(deadProductIds([B, "z", A], [A]), [B, "z"]);
    assert.deepEqual(deadProductIds([], [A]), []);
  });
});
