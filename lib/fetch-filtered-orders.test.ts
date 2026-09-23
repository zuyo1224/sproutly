// lib/fetch-filtered-orders.ts 的行為固定測試。
//
// 為什麼要有這份：訂單列表頁與訂單匯出 CSV 都靠這支照篩選撈訂單，「匯出 = 眼前所見」
// 就壓在它身上。這裡不碰 Supabase，用假的查詢串接器記錄每次下了哪些條件、排序、範圍，
// 把「全部不加條件」「各維度各下一條」「搜尋分流 DB／記憶體」「翻頁」寫死。
//
// 跟 fetch-order-items.test.ts 同一套：Node 內建 node:test + node:assert。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchFilteredOrders } from "./fetch-filtered-orders.ts";
import { parseOrderFilters } from "./order-filters.ts";

type Row = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
};

type Call = {
  table: string;
  columns: string;
  eqs: Array<[string, string]>;
  ors: string[];
  gtes: Array<[string, string]>;
  orders: Array<[string, boolean]>;
  range: [number, number];
};

// 假的 supabase client：記錄條件，range 時照範圍切 rows（不真的套條件，條件另外比對）。
function fakeClient(rows: Row[]) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = {
        table,
        columns: "",
        eqs: [],
        ors: [],
        gtes: [],
        orders: [],
        range: [0, 0],
      };
      const builder = {
        select(columns: string) {
          call.columns = columns;
          return builder;
        },
        eq(column: string, value: string) {
          call.eqs.push([column, value]);
          return builder;
        },
        or(filter: string) {
          call.ors.push(filter);
          return builder;
        },
        gte(column: string, value: string) {
          call.gtes.push([column, value]);
          return builder;
        },
        order(column: string, opts: { ascending: boolean }) {
          call.orders.push([column, opts.ascending]);
          return builder;
        },
        async range(from: number, to: number) {
          call.range = [from, to];
          calls.push(call);
          return { data: rows.slice(from, to + 1) };
        },
      };
      return builder;
    },
  };
  return { client: client as never, calls };
}

const row = (id: string, name: string, phone: string): Row => ({
  id,
  customer_name: name,
  customer_phone: phone,
  customer_email: null,
});

describe("fetchFilteredOrders（列表頁與匯出共用的照篩選撈訂單）", () => {
  it("沒篩選：只鎖店家、新到舊再比 id，不加其他條件", async () => {
    const rows = [row("a", "王小明", "0912345678")];
    const { client, calls } = fakeClient(rows);
    const out = await fetchFilteredOrders(client, "m1", parseOrderFilters({}));

    assert.equal(calls.length, 1);
    const [c] = calls;
    assert.equal(c.table, "sproutly_orders");
    assert.equal(c.columns, "*");
    assert.deepEqual(c.eqs, [["merchant_id", "m1"]]);
    assert.deepEqual(c.ors, []);
    assert.deepEqual(c.gtes, []);
    assert.deepEqual(c.orders, [
      ["created_at", false],
      ["id", false],
    ]);
    assert.deepEqual(c.range, [0, 999]);
    assert.deepEqual(out, rows);
  });

  it("狀態、付款、時間各下一條，純文字搜尋交給 DB ilike", async () => {
    const { client, calls } = fakeClient([]);
    await fetchFilteredOrders(
      client,
      "m1",
      parseOrderFilters({ status: "shipped", pay: "unpaid", range: "today", q: "王" })
    );
    const [c] = calls;
    assert.deepEqual(c.eqs, [
      ["merchant_id", "m1"],
      ["status", "shipped"],
      ["payment_status", "unpaid"],
    ]);
    assert.equal(c.ors.length, 1);
    assert.ok(c.ors[0].includes("customer_name.ilike.%王%"));
    assert.equal(c.gtes.length, 1);
    assert.equal(c.gtes[0][0], "created_at");
    assert.ok(!Number.isNaN(Date.parse(c.gtes[0][1])));
  });

  it("搜尋含數字時不交給 DB，撈回來在記憶體比（電話格式不同也對得上）", async () => {
    const rows = [
      row("a", "王小明", "0912-345-678"),
      row("b", "李大華", "0987654321"),
    ];
    const { client, calls } = fakeClient(rows);
    const out = await fetchFilteredOrders(
      client,
      "m1",
      parseOrderFilters({ q: "0912345678" })
    );
    assert.deepEqual(calls[0].ors, []);
    assert.deepEqual(out.map((o) => o.id), ["a"]);
  });

  it("訂單超過 1000 筆時翻頁撈齊", async () => {
    const rows = Array.from({ length: 1500 }, (_, i) =>
      row(`o${i}`, "客人", "")
    );
    const { client, calls } = fakeClient(rows);
    const out = await fetchFilteredOrders(client, "m1", parseOrderFilters({}));
    assert.deepEqual(
      calls.map((c) => c.range),
      [
        [0, 999],
        [1000, 1999],
      ]
    );
    assert.equal(out.length, 1500);
  });
});
