// lib/availability-schema.ts 餵 Google 的庫存標示行為固定測試。
//
// 為什麼要有這份：商品詳情頁與逛街頁 ItemList 的 offers.availability 全走這一支，
// 而且它刻意共用 product-stock 的 isSoldOut 與 LOW_STOCK_THRESHOLD。這裡把三段式
// 對應寫死，另外鎖「門檻跟畫面『剩 N』提示同一個數字」，兩邊改壞其一馬上看得到。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  availabilityForSchema,
  LOW_STOCK_THRESHOLD,
} from "./availability-schema.ts";
import {
  LOW_STOCK_THRESHOLD as STOCK_THRESHOLD,
  isLowStock,
  isSoldOut,
} from "./product-stock.ts";

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";
const LIMITED = "https://schema.org/LimitedAvailability";

describe("availabilityForSchema", () => {
  it("沒設庫存（null／undefined）當常備品 InStock", () => {
    assert.equal(availabilityForSchema(null), IN_STOCK);
    assert.equal(availabilityForSchema(undefined), IN_STOCK);
  });

  it("0 與負數（超賣）都是 OutOfStock", () => {
    assert.equal(availabilityForSchema(0), OUT_OF_STOCK);
    assert.equal(availabilityForSchema(-3), OUT_OF_STOCK);
  });

  it("剩 1 到門檻件是 LimitedAvailability", () => {
    for (let n = 1; n <= LOW_STOCK_THRESHOLD; n++) {
      assert.equal(availabilityForSchema(n), LIMITED, `stock=${n}`);
    }
  });

  it("超過門檻是 InStock", () => {
    assert.equal(availabilityForSchema(LOW_STOCK_THRESHOLD + 1), IN_STOCK);
    assert.equal(availabilityForSchema(100), IN_STOCK);
  });

  it("值一律是完整的 https://schema.org/ 網址，不是裸字", () => {
    for (const s of [null, 0, 1, 50]) {
      assert.match(availabilityForSchema(s), /^https:\/\/schema\.org\/[A-Za-z]+$/);
    }
  });
});

describe("跟 product-stock 同一口徑", () => {
  it("re-export 的門檻跟 product-stock 是同一個數字", () => {
    assert.equal(LOW_STOCK_THRESHOLD, STOCK_THRESHOLD);
  });

  it("-5 到 20 每個庫存數，Google 標示跟畫面的售完／剩 N 判斷逐一對得上", () => {
    for (let n = -5; n <= 20; n++) {
      const got = availabilityForSchema(n);
      if (isSoldOut(n)) assert.equal(got, OUT_OF_STOCK, `stock=${n}`);
      else if (isLowStock(n)) assert.equal(got, LIMITED, `stock=${n}`);
      else assert.equal(got, IN_STOCK, `stock=${n}`);
    }
  });
});
