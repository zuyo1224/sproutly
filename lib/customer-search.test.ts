// lib/customer-search.ts 客人列表關鍵字比對的行為固定測試。
//
// 為什麼要有這份：客人列表頁與匯出 CSV 吃同一條規則，兩邊對不上就會「列表搜得到、
// 匯出卻被濾掉」。這裡把「姓名／Email／電話任一中就算」「Email 是 null 不會炸」
// 「電話怎麼打都找得到」「全形打字也搜得到」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchesCustomerSearch } from "./customer-search.ts";

const danny = { name: "Danny 陳", email: "Danny@Example.com", phone: "0912-345-678" };
const noEmail = { name: "林小姐", email: null, phone: "02 2345 6789" };

describe("matchesCustomerSearch", () => {
  it("姓名含關鍵字就中，大小寫不分", () => {
    assert.equal(matchesCustomerSearch(danny, "danny"), true);
    assert.equal(matchesCustomerSearch(danny, "陳"), true);
  });

  it("Email 含關鍵字就中，大小寫不分", () => {
    assert.equal(matchesCustomerSearch(danny, "example.com"), true);
  });

  it("Email 是 null 當空字串，不炸", () => {
    assert.equal(matchesCustomerSearch(noEmail, "林"), true);
    assert.equal(matchesCustomerSearch(noEmail, "example"), false);
  });

  it("電話原文照打搜得到", () => {
    assert.equal(matchesCustomerSearch(danny, "0912-345"), true);
  });

  it("電話格式不同也搜得到：純數字搜有連字號的、有空白的", () => {
    assert.equal(matchesCustomerSearch(danny, "0912345678"), true);
    assert.equal(matchesCustomerSearch(noEmail, "23456789"), true);
  });

  it("全形英數搜得到半形資料", () => {
    assert.equal(matchesCustomerSearch(danny, "ｄａｎｎｙ"), true);
    assert.equal(matchesCustomerSearch(danny, "０９１２３４５６７８"), true);
  });

  it("搜的字沒半個數字時不走電話數字比對", () => {
    assert.equal(matchesCustomerSearch(noEmail, "王"), false);
  });

  it("都沒中就不中", () => {
    assert.equal(matchesCustomerSearch(danny, "0987"), false);
    assert.equal(matchesCustomerSearch(danny, "王"), false);
  });
});
