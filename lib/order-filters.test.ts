// lib/order-filters.ts 訂單篩選參數解析的行為固定測試。
//
// 為什麼要有這份：訂單列表頁與訂單匯出 CSV 吃同一份解析，改壞的下場是兩個出口同時錯
// （亂填的網址參數被當真去查 DB、搜尋前後空白沒去掉、「有沒有篩選」判斷漏一項導致匯出
// 檔名沒加註）。這裡把「白名單內照收、白名單外與空值退 all、q 去空白、四項任一有值才算篩選」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_RANGE_KEYS,
  ORDER_RANGE_LABELS,
  isOrderFilterActive,
  parseOrderFilters,
} from "./order-filters.ts";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "./order-labels.ts";

describe("parseOrderFilters", () => {
  it("白名單內的值照收，q 去前後空白", () => {
    assert.deepEqual(
      parseOrderFilters({ status: "shipped", pay: "unpaid", range: "month", q: "  王小明 " }),
      { status: "shipped", pay: "unpaid", range: "month", q: "王小明" }
    );
  });

  it("沒帶參數（列表頁的 undefined、匯出 route 的 null）一律退 all 與空字串", () => {
    const empty = { status: "all", pay: "all", range: "all", q: "" };
    assert.deepEqual(parseOrderFilters({}), empty);
    assert.deepEqual(
      parseOrderFilters({ status: null, pay: null, range: null, q: null }),
      empty
    );
  });

  it("白名單外的值退 all，不會被拿去查 DB", () => {
    assert.deepEqual(
      parseOrderFilters({ status: "hacked", pay: "PAID", range: "year", q: "" }),
      { status: "all", pay: "all", range: "all", q: "" }
    );
  });

  it("明寫 all 就是 all", () => {
    const f = parseOrderFilters({ status: "all", pay: "all", range: "all" });
    assert.equal(f.status, "all");
    assert.equal(f.pay, "all");
    assert.equal(f.range, "all");
  });

  it("每個訂單狀態、付款狀態、時間區間都收得進來", () => {
    for (const status of ORDER_STATUSES) {
      assert.equal(parseOrderFilters({ status }).status, status);
    }
    for (const pay of PAYMENT_STATUSES) {
      assert.equal(parseOrderFilters({ pay }).pay, pay);
    }
    for (const range of ["today", "week", "month"]) {
      assert.equal(parseOrderFilters({ range }).range, range);
    }
  });
});

describe("isOrderFilterActive", () => {
  it("全部 all 且沒搜尋才算沒篩選；四項任一有值就算", () => {
    const none = parseOrderFilters({});
    assert.equal(isOrderFilterActive(none), false);
    assert.equal(isOrderFilterActive({ ...none, status: "pending" }), true);
    assert.equal(isOrderFilterActive({ ...none, pay: "paid" }), true);
    assert.equal(isOrderFilterActive({ ...none, range: "today" }), true);
    assert.equal(isOrderFilterActive({ ...none, q: "0912" }), true);
  });

  it("只打空白的搜尋去掉後不算篩選", () => {
    assert.equal(isOrderFilterActive(parseOrderFilters({ q: "   " })), false);
  });
});

describe("ORDER_RANGE_KEYS", () => {
  it("白名單就是標籤表的 key，順序今天／本週／本月，每個都有中文標籤", () => {
    assert.deepEqual(ORDER_RANGE_KEYS, ["today", "week", "month"]);
    for (const key of ORDER_RANGE_KEYS) {
      assert.ok(ORDER_RANGE_LABELS[key], `${key} 缺標籤`);
      assert.equal(parseOrderFilters({ range: key }).range, key);
    }
  });
});
