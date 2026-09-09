// lib/group-orders-by-customer.ts 客人分群三支的行為固定測試。
//
// 為什麼要有這份：客人列表頁與客人匯出 CSV 是同一份名單的兩個出口，都靠這支決定
// 「哪些訂單算同一個人」。改壞的下場是列表一列、匯出兩列，或人頭多算、累計消費被攤薄、
// 該標 VIP／回購的標不上。這裡把「有會員 ID 用會員、否則電話轉純數字併、亂打的原文
// 自成一桶、沒電話丟 unknown、Map 維持插入順序」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  customerGroupKey,
  isAccountGroupKey,
  groupOrdersByCustomer,
} from "./group-orders-by-customer.ts";

describe("customerGroupKey", () => {
  it("有會員 ID 優先用會員，電話再不同也同一桶", () => {
    assert.equal(
      customerGroupKey({ customer_id: "u1", customer_phone: "0912345678" }),
      "account:u1"
    );
    assert.equal(
      customerGroupKey({ customer_id: "u1", customer_phone: "0987654321" }),
      "account:u1"
    );
  });

  it("匿名訂單用電話併，格式不同（連字號、空白、+886、全形）都轉成同一桶", () => {
    const variants = ["0912-345-678", "0912 345 678", "+886912345678", "０９１２３４５６７８"];
    for (const phone of variants) {
      assert.equal(
        customerGroupKey({ customer_id: null, customer_phone: phone }),
        "guest:0912345678",
        phone
      );
    }
  });

  it("電話清完一個數字都沒有就退回原文自成一桶，不跟 unknown 混", () => {
    assert.equal(
      customerGroupKey({ customer_id: null, customer_phone: "abc" }),
      "guest:abc"
    );
  });

  it("沒會員也沒電話丟進 unknown", () => {
    assert.equal(
      customerGroupKey({ customer_id: null, customer_phone: "" }),
      "guest:unknown"
    );
  });
});

describe("isAccountGroupKey", () => {
  it("account: 開頭才算會員", () => {
    assert.equal(isAccountGroupKey("account:u1"), true);
    assert.equal(isAccountGroupKey("guest:0912345678"), false);
    assert.equal(isAccountGroupKey("guest:unknown"), false);
    assert.equal(isAccountGroupKey(""), false);
  });
});

describe("groupOrdersByCustomer", () => {
  it("空清單回空 Map", () => {
    assert.equal(groupOrdersByCustomer([]).size, 0);
  });

  it("同一客人的訂單併到同一桶，桶內維持原順序，桶的順序照第一次出現", () => {
    const orders = [
      { id: 1, customer_id: null, customer_phone: "0912-345-678" },
      { id: 2, customer_id: "u1", customer_phone: "" },
      { id: 3, customer_id: null, customer_phone: "0912345678" },
      { id: 4, customer_id: null, customer_phone: "" },
      { id: 5, customer_id: "u1", customer_phone: "0999" },
    ];
    const groups = groupOrdersByCustomer(orders);
    assert.deepEqual([...groups.keys()], ["guest:0912345678", "account:u1", "guest:unknown"]);
    assert.deepEqual(groups.get("guest:0912345678")!.map((o) => o.id), [1, 3]);
    assert.deepEqual(groups.get("account:u1")!.map((o) => o.id), [2, 5]);
    assert.deepEqual(groups.get("guest:unknown")!.map((o) => o.id), [4]);
  });

  it("回傳的是原本的訂單物件（不是複製），其他欄位都還在", () => {
    const order = { id: 9, customer_id: "u2", customer_phone: "", total_cents: 500 };
    const groups = groupOrdersByCustomer([order]);
    assert.equal(groups.get("account:u2")![0], order);
  });
});
