// lib/product-limits.ts 的行為固定測試。
//
// 這幾個數字是「瀏覽器端 max／maxLength」與「Server Action 退回」兩層共用的同一份。
// 有人只改一邊的話，商家會遇到「輸入框讓我打、按儲存被退回」或反過來的對不上——
// 這種錯只有在打到剛好那個長度時才出現，平常測不到。這裡把值與相互關係寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PRICE_YUAN,
  MAX_STOCK,
  MAX_PRODUCT_NAME_LEN,
  MAX_PRODUCT_DESC_LEN,
  MAX_IMAGE_URL_LEN,
} from "./product-limits.ts";
import { MAX_STORE_NAME_LEN } from "./store-limits.ts";

describe("值本身", () => {
  it("價格上限一千萬元、庫存上限一百萬件", () => {
    assert.equal(MAX_PRICE_YUAN, 10_000_000);
    assert.equal(MAX_STOCK, 1_000_000);
  });

  it("品名 100 字、描述 2000 字、貼圖網址 2048 字", () => {
    assert.equal(MAX_PRODUCT_NAME_LEN, 100);
    assert.equal(MAX_PRODUCT_DESC_LEN, 2000);
    assert.equal(MAX_IMAGE_URL_LEN, 2048);
  });

  it("全部是正整數（直接當 input 的 max／maxLength 用）", () => {
    for (const v of [
      MAX_PRICE_YUAN,
      MAX_STOCK,
      MAX_PRODUCT_NAME_LEN,
      MAX_PRODUCT_DESC_LEN,
      MAX_IMAGE_URL_LEN,
    ]) {
      assert.ok(Number.isInteger(v) && v > 0);
    }
  });
});

describe("跟 DB 欄位型別的關係", () => {
  it("價格換成分之後仍在 postgres integer 範圍內", () => {
    assert.ok(MAX_PRICE_YUAN * 100 < 2_147_483_647);
  });

  it("庫存也在 integer 範圍內", () => {
    assert.ok(MAX_STOCK < 2_147_483_647);
  });
});

describe("字數上限彼此的關係", () => {
  it("品名比店名寬一點（長品名放得下）", () => {
    assert.ok(MAX_PRODUCT_NAME_LEN > MAX_STORE_NAME_LEN);
  });

  it("描述比品名寬得多", () => {
    assert.ok(MAX_PRODUCT_DESC_LEN > MAX_PRODUCT_NAME_LEN);
  });
});
