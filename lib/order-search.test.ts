// lib/order-search.ts 後台訂單關鍵字搜尋的行為固定測試。
//
// 為什麼要有這份：訂單列表頁與匯出 route 吃同一條規則，兩邊對不上就會「列表搜得到、
// 匯出卻被濾掉」。這裡把「含數字或 , ( ) 改走記憶體比對」「% _ 要轉義」「全形多一組
// 半形條件」「電話怎麼打都找得到」「欄位是 null 不會炸」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyOrderSearch,
  matchesOrderSearch,
  needsMemoryOrderSearch,
} from "./order-search.ts";

// 只記下收到的 or 字串，模擬 PostgREST filter builder 回傳自己。
function fakeQuery() {
  const calls: string[] = [];
  const q = {
    or(filter: string) {
      calls.push(filter);
      return q;
    },
  };
  return { q, calls };
}

describe("needsMemoryOrderSearch", () => {
  it("純文字（姓名、Email）走資料庫比對", () => {
    assert.equal(needsMemoryOrderSearch("danny"), false);
    assert.equal(needsMemoryOrderSearch("王小明"), false);
    assert.equal(needsMemoryOrderSearch("a@b.com"), false);
  });

  it("含數字（含全形數字）改走記憶體比對", () => {
    assert.equal(needsMemoryOrderSearch("0912"), true);
    assert.equal(needsMemoryOrderSearch("０９１２"), true);
  });

  it("含逗號、括號（含全形）改走記憶體比對，免得查詢被拆爛", () => {
    assert.equal(needsMemoryOrderSearch("Wang, Danny"), true);
    assert.equal(needsMemoryOrderSearch("王小明(阿明)"), true);
    assert.equal(needsMemoryOrderSearch("王小明（阿明）"), true);
    assert.equal(needsMemoryOrderSearch("王，小明"), true);
  });
});

describe("applyOrderSearch", () => {
  it("中文原文只組一組姓名／電話／Email 條件", () => {
    const { q, calls } = fakeQuery();
    applyOrderSearch(q, "王小明");
    assert.deepEqual(calls, [
      "customer_name.ilike.%王小明%,customer_phone.ilike.%王小明%,customer_email.ilike.%王小明%",
    ]);
  });

  it("% 和 _ 要轉義，不被當萬用字元", () => {
    const { q, calls } = fakeQuery();
    applyOrderSearch(q, "a_b%");
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes("customer_name.ilike.%a\\_b\\%%"));
  });

  it("全形打字多一組轉半形的條件，原文那組照樣保留", () => {
    const { q, calls } = fakeQuery();
    applyOrderSearch(q, "ｄａｎｎｙ");
    const parts = calls[0].split(",");
    assert.equal(parts.length, 6);
    assert.ok(parts.includes("customer_name.ilike.%ｄａｎｎｙ%"));
    assert.ok(parts.includes("customer_name.ilike.%danny%"));
  });

  it("全形％＿轉半形後一樣被轉義", () => {
    const { q, calls } = fakeQuery();
    applyOrderSearch(q, "５０％");
    assert.ok(calls[0].includes("customer_name.ilike.%50\\%%"));
  });

  it("回傳同一個查詢物件，可以繼續串", () => {
    const { q } = fakeQuery();
    assert.equal(applyOrderSearch(q, "danny"), q);
  });
});

describe("matchesOrderSearch", () => {
  const order = {
    customer_name: "Danny 陳",
    customer_phone: "0912-345-678",
    customer_email: "Danny@Example.com",
  };
  const blank = { customer_name: null, customer_phone: null, customer_email: null };

  it("姓名、Email 任一含關鍵字就中，大小寫不分", () => {
    assert.equal(matchesOrderSearch(order, "danny"), true);
    assert.equal(matchesOrderSearch(order, "example.com"), true);
    assert.equal(matchesOrderSearch(order, "林"), false);
  });

  it("電話格式不同也搜得到：純數字、空白、+886、全形", () => {
    assert.equal(matchesOrderSearch(order, "0912345678"), true);
    assert.equal(matchesOrderSearch(order, "0912 345 678"), true);
    assert.equal(matchesOrderSearch(order, "+886912345678"), true);
    assert.equal(matchesOrderSearch(order, "０９１２３４５"), true);
    assert.equal(matchesOrderSearch(order, "0933"), false);
  });

  it("全形英文搜得到半形資料", () => {
    assert.equal(matchesOrderSearch(order, "ＤＡＮＮＹ"), true);
  });

  it("姓名、電話、Email 都是 null 不炸，也不亂中", () => {
    assert.equal(matchesOrderSearch(blank, "danny"), false);
    assert.equal(matchesOrderSearch(blank, "0912"), false);
  });

  it("含逗號的姓名在記憶體比對搜得到", () => {
    const comma = { ...order, customer_name: "Wang, Danny" };
    assert.equal(matchesOrderSearch(comma, "wang, d"), true);
  });
});
