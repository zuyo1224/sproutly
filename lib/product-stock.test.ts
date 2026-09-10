// lib/product-stock.ts 缺貨判斷五支的行為固定測試。
//
// 為什麼要有這份：首頁精選、shop、商品詳情、收藏、Cmd+K、最近看過、結帳頁、JSON-LD
// 的「售完／剩 N／夾庫存／售完沉底」全走這一份。以前各頁各抄一份還寫得不一樣（有的
// 只認 === 0，負庫存顯示有貨、對 Google 卻標 OutOfStock）。這裡把「null 永遠有貨、
// <= 0 含負數算售完、剩 1-3 亮提示、結帳夾到庫存、排序穩定只把售完往後挪」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isSoldOut,
  isLowStock,
  LOW_STOCK_THRESHOLD,
  stockAriaSuffix,
  clampToStock,
  bySoldOutLast,
  insufficientStockError,
} from "./product-stock.ts";

describe("isSoldOut", () => {
  it("null／undefined 是沒在管庫存，永遠有貨", () => {
    assert.equal(isSoldOut(null), false);
    assert.equal(isSoldOut(undefined), false);
  });

  it("0 與負數（超賣）都算售完，正數有貨", () => {
    assert.equal(isSoldOut(0), true);
    assert.equal(isSoldOut(-2), true);
    assert.equal(isSoldOut(1), false);
    assert.equal(isSoldOut(100), false);
  });
});

describe("isLowStock", () => {
  it("門檻是 3", () => {
    assert.equal(LOW_STOCK_THRESHOLD, 3);
  });

  it("剩 1 到門檻（含）才亮，超過門檻、售完、沒在管都不亮", () => {
    assert.equal(isLowStock(1), true);
    assert.equal(isLowStock(3), true);
    assert.equal(isLowStock(4), false);
    assert.equal(isLowStock(0), false);
    assert.equal(isLowStock(-1), false);
    assert.equal(isLowStock(null), false);
    assert.equal(isLowStock(undefined), false);
  });
});

describe("stockAriaSuffix", () => {
  it("售完念已售完，剩 N 念件數，有貨或沒在管回空字串", () => {
    assert.equal(stockAriaSuffix(0), "，已售完");
    assert.equal(stockAriaSuffix(-3), "，已售完");
    assert.equal(stockAriaSuffix(2), "，剩 2 件");
    assert.equal(stockAriaSuffix(10), "");
    assert.equal(stockAriaSuffix(null), "");
  });
});

describe("clampToStock", () => {
  it("沒在管庫存照要的量給，不算被夾", () => {
    assert.deepEqual(clampToStock(null, 5), { effectiveQty: 5, soldOut: false, clamped: false });
    assert.deepEqual(clampToStock(undefined, 5), { effectiveQty: 5, soldOut: false, clamped: false });
  });

  it("庫存夠就照要的量給", () => {
    assert.deepEqual(clampToStock(10, 5), { effectiveQty: 5, soldOut: false, clamped: false });
    assert.deepEqual(clampToStock(5, 5), { effectiveQty: 5, soldOut: false, clamped: false });
  });

  it("要的量超過庫存夾到庫存，標 clamped", () => {
    assert.deepEqual(clampToStock(3, 5), { effectiveQty: 3, soldOut: false, clamped: true });
  });

  it("售完（0 或負數）effectiveQty 是 0、標 soldOut、不標 clamped", () => {
    assert.deepEqual(clampToStock(0, 5), { effectiveQty: 0, soldOut: true, clamped: false });
    assert.deepEqual(clampToStock(-2, 5), { effectiveQty: 0, soldOut: true, clamped: false });
  });
});

describe("bySoldOutLast", () => {
  it("售完的整批沉到最後，有貨與售完各自維持原順序", () => {
    const list = [
      { name: "a", stock: 0 },
      { name: "b", stock: 5 },
      { name: "c", stock: null },
      { name: "d", stock: -1 },
      { name: "e", stock: 1 },
    ];
    const sorted = [...list].sort(bySoldOutLast);
    assert.deepEqual(sorted.map((x) => x.name), ["b", "c", "e", "a", "d"]);
  });

  it("兩個都有貨或都售完時回 0（穩定排序不動）", () => {
    assert.equal(bySoldOutLast({ stock: 1 }, { stock: null }), 0);
    assert.equal(bySoldOutLast({ stock: 0 }, { stock: -5 }), 0);
    assert.ok(bySoldOutLast({ stock: 0 }, { stock: 1 }) > 0);
    assert.ok(bySoldOutLast({ stock: 1 }, { stock: 0 }) < 0);
  });
});

// 客人買不到那一刻唯一會看到的一句話：講錯（例如冒出「庫存只剩 -2 件」）就是把資料庫的
// 壞資料直接貼到客人臉上，講得跟另一個入口不一樣則是同一間店兩種口氣。這裡把「售完講
// 哪句、剩 N 講哪句、帶不帶品名、負庫存算售完」寫死，三個呼叫端共用同一份。
describe("insufficientStockError", () => {
  it("不帶品名時售完講「商品已售完」，剩 N 講件數", () => {
    assert.equal(insufficientStockError(0), "商品已售完");
    assert.equal(insufficientStockError(2), "庫存只剩 2 件");
    assert.equal(insufficientStockError(1), "庫存只剩 1 件");
  });

  it("帶品名時把品名放在句首，購物車一次好幾件才知道是哪一件", () => {
    assert.equal(insufficientStockError(0, "龜背芋"), "「龜背芋」已售完");
    assert.equal(insufficientStockError(2, "龜背芋"), "「龜背芋」庫存只剩 2 件");
  });

  it("超賣扣成負數一律講售完，不會冒出「庫存只剩 -2 件」", () => {
    assert.equal(insufficientStockError(-2), "商品已售完");
    assert.equal(insufficientStockError(-2, "龜背芋"), "「龜背芋」已售完");
  });

  it("品名是空字串或 null 時當沒帶，退回不帶品名的句子", () => {
    assert.equal(insufficientStockError(0, ""), "商品已售完");
    assert.equal(insufficientStockError(2, null), "庫存只剩 2 件");
    assert.equal(insufficientStockError(2, undefined), "庫存只剩 2 件");
  });

  it("售完的判斷走 isSoldOut，跟全站缺貨定義同一條", () => {
    for (const stock of [0, -1, -99]) {
      assert.equal(isSoldOut(stock), true);
      assert.ok(insufficientStockError(stock).endsWith("已售完"));
    }
  });
});
