// lib/customer-tags.ts 分群門檻與優先序的行為固定測試。
//
// 客人列表頁（表格列、手機卡、摘要）與匯出 CSV 都吃這支決定一位客人掛 VIP 還是回購。
// 改壞不會噴錯，只會讓同一位客人在畫面上是 VIP、在下載的 CSV 裡卻不是，兩份名單對不上，
// 商家拿去發優惠時才發現。這裡把門檻值、邊界的「含等於」、以及「VIP 蓋過回購」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  VIP_THRESHOLD_CENTS,
  REPEAT_ORDER_THRESHOLD,
  isVipCustomer,
  isReturningCustomer,
  customerTier,
} from "./customer-tags.ts";

describe("門檻值本身", () => {
  it("VIP 是 200000 分（NT$ 2,000）、回購是 2 筆", () => {
    assert.equal(VIP_THRESHOLD_CENTS, 200000);
    assert.equal(REPEAT_ORDER_THRESHOLD, 2);
  });
});

describe("isVipCustomer", () => {
  it("剛好等於門檻算 VIP", () => {
    assert.equal(isVipCustomer(VIP_THRESHOLD_CENTS), true);
  });

  it("差一分不算", () => {
    assert.equal(isVipCustomer(VIP_THRESHOLD_CENTS - 1), false);
  });

  it("超過門檻算", () => {
    assert.equal(isVipCustomer(VIP_THRESHOLD_CENTS + 1), true);
    assert.equal(isVipCustomer(9_999_999), true);
  });

  it("0 與負數（退款到變負）不算", () => {
    assert.equal(isVipCustomer(0), false);
    assert.equal(isVipCustomer(-500000), false);
  });
});

describe("isReturningCustomer", () => {
  it("剛好 2 筆算回購", () => {
    assert.equal(isReturningCustomer(REPEAT_ORDER_THRESHOLD), true);
  });

  it("只下過 1 筆或 0 筆不算", () => {
    assert.equal(isReturningCustomer(1), false);
    assert.equal(isReturningCustomer(0), false);
  });

  it("多筆一樣算", () => {
    assert.equal(isReturningCustomer(50), true);
  });
});

describe("customerTier 排他優先序", () => {
  it("兩個都符合只回 vip（VIP 蓋過回購）", () => {
    assert.equal(customerTier(VIP_THRESHOLD_CENTS, 10), "vip");
  });

  it("只有金額到、筆數只有一筆，仍是 vip", () => {
    assert.equal(customerTier(VIP_THRESHOLD_CENTS, 1), "vip");
  });

  it("只有筆數到、金額沒到，是 returning", () => {
    assert.equal(customerTier(100, REPEAT_ORDER_THRESHOLD), "returning");
  });

  it("都沒到回 null（不是空字串、也不是 undefined）", () => {
    assert.equal(customerTier(100, 1), null);
  });

  it("剛好在兩個邊界上：金額差一分、筆數剛好到，落在 returning", () => {
    assert.equal(customerTier(VIP_THRESHOLD_CENTS - 1, REPEAT_ORDER_THRESHOLD), "returning");
  });

  it("回傳值只會是三種其中之一", () => {
    const seen = new Set(
      [
        [0, 0],
        [100, 2],
        [200000, 0],
        [999999, 99],
      ].map(([cents, count]) => customerTier(cents, count)),
    );
    for (const v of seen) assert.ok(v === "vip" || v === "returning" || v === null);
  });
});
