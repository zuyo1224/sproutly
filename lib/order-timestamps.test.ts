// lib/order-timestamps.ts 的行為固定測試：orderStatusUpdates（出貨時間章）、
// orderPaymentUpdates（付款時間章）。
//
// 為什麼要有這份：這兩支決定 sproutly_orders 的 shipped_at / paid_at 什麼時候被寫、被擦。
// 改壞的樣子全都不會噴錯，只會在商家對帳時才發現：少了「值有變才寫」，詳情頁存一次檔就
// 把早就出貨的單的出貨時間蓋成今天；少了「已蓋過就不再蓋」，列表那顆按鈕連按兩下、或
// 退款後再標一次已付款，原本的時間被改寫；擦章那兩條的狀態名單寫錯，誤按出貨改回待確認
// 之後單子上還掛著一個假的出貨時間，或反過來把已完成單的出貨時間清掉。
// 蓋章時刻用參數傳進來，測試才盯得住寫進去的是不是那個時刻而不是「大概是現在」。
// 跟其他 lib 測試同一套：node:test + node:assert，import 一律帶 .ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orderStatusUpdates, orderPaymentUpdates } from "./order-timestamps.ts";

const NOW = "2026-09-10T03:00:00.000Z";
const EARLIER = "2026-09-01T10:00:00.000Z";

describe("orderStatusUpdates", () => {
  it("值沒變回空物件，呼叫端據此判斷這次什麼都不用寫", () => {
    assert.deepEqual(
      orderStatusUpdates({ status: "shipped", shipped_at: EARLIER }, "shipped", NOW),
      {}
    );
  });

  it("切進已出貨、還沒蓋過章：寫狀態並蓋上這一刻", () => {
    assert.deepEqual(
      orderStatusUpdates({ status: "confirmed", shipped_at: null }, "shipped", NOW),
      { status: "shipped", shipped_at: NOW }
    );
  });

  it("切到其他狀態不碰出貨時間", () => {
    assert.deepEqual(
      orderStatusUpdates({ status: "pending", shipped_at: null }, "confirmed", NOW),
      { status: "confirmed" }
    );
    assert.deepEqual(
      orderStatusUpdates({ status: "shipped", shipped_at: EARLIER }, "completed", NOW),
      { status: "completed" }
    );
  });

  it("已完成／已取消保留出貨章：貨確實出過", () => {
    assert.deepEqual(
      orderStatusUpdates({ status: "shipped", shipped_at: EARLIER }, "cancelled", NOW),
      { status: "cancelled" }
    );
  });

  it("誤按出貨後改回待確認／已確認：把錯蓋的章擦掉", () => {
    assert.deepEqual(
      orderStatusUpdates({ status: "shipped", shipped_at: EARLIER }, "pending", NOW),
      { status: "pending", shipped_at: null }
    );
    assert.deepEqual(
      orderStatusUpdates({ status: "shipped", shipped_at: EARLIER }, "confirmed", NOW),
      { status: "confirmed", shipped_at: null }
    );
  });

  it("本來就沒章就不必擦，不多寫一個 null 欄位", () => {
    assert.deepEqual(
      orderStatusUpdates({ status: "confirmed", shipped_at: null }, "pending", NOW),
      { status: "pending" }
    );
  });

  it("從已取消復原回流程中：狀態要換，出貨章照原規則處理", () => {
    assert.deepEqual(
      orderStatusUpdates({ status: "cancelled", shipped_at: EARLIER }, "confirmed", NOW),
      { status: "confirmed", shipped_at: null }
    );
  });
});

describe("orderPaymentUpdates", () => {
  it("值沒變回空物件", () => {
    assert.deepEqual(
      orderPaymentUpdates({ payment_status: "paid", paid_at: EARLIER }, "paid", NOW),
      {}
    );
  });

  it("切進已付款、還沒蓋過章：寫狀態並蓋上這一刻", () => {
    assert.deepEqual(
      orderPaymentUpdates({ payment_status: "unpaid", paid_at: null }, "paid", NOW),
      { payment_status: "paid", paid_at: NOW }
    );
  });

  it("付過又退款、現在再標一次已付款：保留原本的付款時間", () => {
    assert.deepEqual(
      orderPaymentUpdates({ payment_status: "refunded", paid_at: EARLIER }, "paid", NOW),
      { payment_status: "paid" }
    );
  });

  it("誤按已付款後改回未付款：擦掉付款章", () => {
    assert.deepEqual(
      orderPaymentUpdates({ payment_status: "paid", paid_at: EARLIER }, "unpaid", NOW),
      { payment_status: "unpaid", paid_at: null }
    );
  });

  it("改成已退款保留付款章：錢確實付過，只是退回去了", () => {
    assert.deepEqual(
      orderPaymentUpdates({ payment_status: "paid", paid_at: EARLIER }, "refunded", NOW),
      { payment_status: "refunded" }
    );
  });

  it("本來就沒章的單改成未付款，不多寫一個 null 欄位", () => {
    assert.deepEqual(
      orderPaymentUpdates({ payment_status: "refunded", paid_at: null }, "unpaid", NOW),
      { payment_status: "unpaid" }
    );
  });
});

// 兩支合起來看：詳情頁的表單每次同時送狀態與付款，兩份結果併成一筆更新。
// 這裡固定住「只改其中一邊時，另一邊一個欄位都不會被帶進去」——這正是原本三處各抄一份
// 時最容易改壞的地方（存個付款就順手把出貨時間蓋成今天）。
describe("兩支併用（詳情頁同時送兩個欄位的情況）", () => {
  it("只動付款：出貨相關欄位一個都不進 updates", () => {
    const current = {
      status: "shipped",
      shipped_at: EARLIER,
      payment_status: "unpaid",
      paid_at: null,
    };
    const updates = {
      ...orderStatusUpdates(current, "shipped", NOW),
      ...orderPaymentUpdates(current, "paid", NOW),
    };
    assert.deepEqual(updates, { payment_status: "paid", paid_at: NOW });
  });

  it("兩邊都動：兩份章各自照自己的規則蓋", () => {
    const current = {
      status: "confirmed",
      shipped_at: null,
      payment_status: "unpaid",
      paid_at: null,
    };
    const updates = {
      ...orderStatusUpdates(current, "shipped", NOW),
      ...orderPaymentUpdates(current, "paid", NOW),
    };
    assert.deepEqual(updates, {
      status: "shipped",
      shipped_at: NOW,
      payment_status: "paid",
      paid_at: NOW,
    });
  });

  it("兩邊都沒動：整筆空的，呼叫端會直接跳過這次更新", () => {
    const current = {
      status: "completed",
      shipped_at: EARLIER,
      payment_status: "paid",
      paid_at: EARLIER,
    };
    const updates = {
      ...orderStatusUpdates(current, "completed", NOW),
      ...orderPaymentUpdates(current, "paid", NOW),
    };
    assert.deepEqual(updates, {});
  });
});
