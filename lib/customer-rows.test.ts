// lib/customer-rows.ts 客人名單彙總與排序的行為固定測試。
//
// 為什麼要有這份：客人列表頁與客人匯出 CSV 吃同一份彙總與排序，改壞的下場是兩個出口
// 同時錯（姓名取錯筆、已付金額混進未付、排序方向反了）。這裡把「姓名取最近一筆、首末次
// 下單、只算 paid 的已付、會員／匿名判定、四種排序、白名單退回 recent」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerRows,
  customerFilterQuery,
  isCustomerFilterActive,
  parseCustomerFilters,
  parseCustomerSort,
  sortCustomerRows,
} from "./customer-rows.ts";

function order(o: Partial<Parameters<typeof buildCustomerRows>[0][number]>) {
  return {
    customer_id: null,
    customer_name: "客人",
    customer_email: null,
    customer_phone: "0912345678",
    total_cents: 0,
    payment_status: "unpaid",
    created_at: "2026-01-01T00:00:00Z",
    ...o,
  };
}

describe("parseCustomerSort", () => {
  it("白名單內原樣回傳", () => {
    for (const k of ["recent", "spend", "orders", "first"]) {
      assert.equal(parseCustomerSort(k), k);
    }
  });
  it("空、null、不認得的都退回 recent", () => {
    assert.equal(parseCustomerSort(null), "recent");
    assert.equal(parseCustomerSort(undefined), "recent");
    assert.equal(parseCustomerSort(""), "recent");
    assert.equal(parseCustomerSort("SPEND"), "recent");
  });
});

describe("buildCustomerRows", () => {
  it("同一位客人彙總：姓名取最近一筆、首末次、已付只算 paid", () => {
    const rows = buildCustomerRows([
      order({ customer_name: "新名字", total_cents: 300, payment_status: "paid", created_at: "2026-03-01T00:00:00Z" }),
      order({ customer_name: "舊名字", total_cents: 500, created_at: "2026-01-01T00:00:00Z" }),
      order({ customer_name: "中間", total_cents: 200, payment_status: "paid", created_at: "2026-02-01T00:00:00Z" }),
    ]);
    assert.equal(rows.length, 1);
    const r = rows[0];
    assert.equal(r.name, "新名字");
    assert.equal(r.orderCount, 3);
    assert.equal(r.paidCount, 2);
    assert.equal(r.totalCents, 1000);
    assert.equal(r.paidCents, 500);
    assert.equal(r.firstOrderAt, "2026-01-01T00:00:00Z");
    assert.equal(r.lastOrderAt, "2026-03-01T00:00:00Z");
    assert.equal(r.identityType, "guest");
    assert.equal(r.customerId, null);
  });

  it("會員帶 customerId、匿名不帶；沒姓名顯示 —", () => {
    const rows = buildCustomerRows([
      order({ customer_id: "u1", customer_phone: "0911111111" }),
      order({ customer_name: "", customer_phone: "0922222222" }),
    ]);
    assert.deepEqual(
      rows.map((r) => [r.key, r.identityType, r.customerId, r.name]),
      [
        ["account:u1", "account", "u1", "客人"],
        ["guest:0922222222", "guest", null, "—"],
      ]
    );
  });

  it("沒訂單回空陣列", () => {
    assert.deepEqual(buildCustomerRows([]), []);
  });
});

describe("sortCustomerRows", () => {
  const rows = () =>
    buildCustomerRows([
      order({ customer_phone: "0900000001", total_cents: 100, created_at: "2026-02-01T00:00:00Z" }),
      order({ customer_phone: "0900000002", total_cents: 900, created_at: "2026-01-01T00:00:00Z" }),
      order({ customer_phone: "0900000002", total_cents: 100, created_at: "2026-01-05T00:00:00Z" }),
      order({ customer_phone: "0900000003", total_cents: 500, created_at: "2026-03-01T00:00:00Z" }),
    ]);
  const phones = (rs: { phone: string }[]) => rs.map((r) => r.phone.slice(-1));

  it("recent：最近下單新到舊", () => {
    assert.deepEqual(phones(sortCustomerRows(rows(), "recent")), ["3", "1", "2"]);
  });
  it("spend：累計高到低", () => {
    assert.deepEqual(phones(sortCustomerRows(rows(), "spend")), ["2", "3", "1"]);
  });
  it("orders：筆數多到少，同筆數比最近下單新到舊", () => {
    assert.deepEqual(phones(sortCustomerRows(rows(), "orders")), ["2", "3", "1"]);
  });
  it("同值不看插入順序：累計相同比最近下單，再相同比 key", () => {
    const tied = (reverse: boolean) => {
      const os = [
        order({ customer_phone: "0900000001", total_cents: 500, created_at: "2026-01-01T00:00:00Z" }),
        order({ customer_phone: "0900000002", total_cents: 500, created_at: "2026-02-01T00:00:00Z" }),
        order({ customer_phone: "0900000003", total_cents: 500, created_at: "2026-02-01T00:00:00Z" }),
      ];
      return buildCustomerRows(reverse ? os.reverse() : os);
    };
    for (const sort of ["spend", "orders", "recent"] as const) {
      assert.deepEqual(phones(sortCustomerRows(tied(false), sort)), ["2", "3", "1"]);
      assert.deepEqual(phones(sortCustomerRows(tied(true), sort)), ["2", "3", "1"]);
    }
    // first：首次下單舊到新，同時間的 2、3 比 key
    assert.deepEqual(phones(sortCustomerRows(tied(true), "first")), ["1", "2", "3"]);
  });
  it("first：首次下單舊到新", () => {
    assert.deepEqual(phones(sortCustomerRows(rows(), "first")), ["2", "1", "3"]);
  });
  it("就地排序、回傳同一個陣列", () => {
    const rs = rows();
    assert.equal(sortCustomerRows(rs, "spend"), rs);
    assert.deepEqual(phones(rs), ["2", "3", "1"]);
  });
});

describe("parseCustomerFilters / isCustomerFilterActive / customerFilterQuery", () => {
  it("q 去前後空白、sort 走白名單，缺值退預設", () => {
    assert.deepEqual(parseCustomerFilters({ q: "  王  ", sort: "spend" }), { q: "王", sort: "spend" });
    assert.deepEqual(parseCustomerFilters({ q: null, sort: "bogus" }), { q: "", sort: "recent" });
    assert.deepEqual(parseCustomerFilters({}), { q: "", sort: "recent" });
  });
  it("有搜尋或排序不是 recent 才算篩選，純空白搜尋不算", () => {
    assert.equal(isCustomerFilterActive(parseCustomerFilters({ q: "   " })), false);
    assert.equal(isCustomerFilterActive(parseCustomerFilters({ q: "王" })), true);
    assert.equal(isCustomerFilterActive(parseCustomerFilters({ sort: "orders" })), true);
  });
  it("預設值不帶，任一項有值才進查詢字串", () => {
    assert.equal(customerFilterQuery(parseCustomerFilters({})), "");
    assert.equal(customerFilterQuery(parseCustomerFilters({ q: "王 小明" })), "q=%E7%8E%8B+%E5%B0%8F%E6%98%8E");
    assert.equal(customerFilterQuery(parseCustomerFilters({ q: "a", sort: "first" })), "q=a&sort=first");
  });
});
