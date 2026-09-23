// lib/fetch-customer-orders.ts 的行為固定測試。
//
// 為什麼要有這份：客人列表頁與客人 CSV 匯出都靠這支撈「這家店全部未取消訂單」，
// 訂單筆數、累計消費、VIP／回購標籤全從這裡算。以前一次 .select() 撈整家店、又沒下排序，
// 超過 1000 單就默默少單、而且少哪幾張每次浮動。這裡不碰 Supabase，用假的查詢串接器
// 把「只查這家店」「排除取消單」「created_at 再 id 兩層升冪當切點」「翻頁撈齊」寫死。
//
// 跟 fetch-order-items.test.ts 同一套：Node 內建 node:test + node:assert，import 寫 ./fetch-customer-orders.ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchCustomerOrders } from "./fetch-customer-orders.ts";

type Row = {
  id: string;
  merchant_id: string;
  status: string;
  created_at: string;
};

type Call = {
  table: string;
  columns: string;
  eq: Array<[string, string]>;
  neq: Array<[string, string]>;
  orders: Array<[string, boolean]>;
  range: [number, number];
};

// 假的 supabase client：只實作 fetchCustomerOrders 用到的那條鏈
// from → select → eq → neq → order → order → range，range 時照 eq／neq 篩、照 created_at+id 排、照範圍切。
function fakeClient(rows: Row[]) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Partial<Call> & Pick<Call, "eq" | "neq" | "orders"> = {
        table,
        eq: [],
        neq: [],
        orders: [],
      };
      const builder = {
        select(columns: string) {
          call.columns = columns;
          return builder;
        },
        eq(column: string, value: string) {
          call.eq.push([column, value]);
          return builder;
        },
        neq(column: string, value: string) {
          call.neq.push([column, value]);
          return builder;
        },
        order(column: string, opts: { ascending: boolean }) {
          call.orders.push([column, opts.ascending]);
          return builder;
        },
        async range(from: number, to: number) {
          call.range = [from, to];
          calls.push(call as Call);
          const data = rows
            .filter((r) =>
              call.eq.every(([c, v]) => r[c as keyof Row] === v)
            )
            .filter((r) =>
              call.neq.every(([c, v]) => r[c as keyof Row] !== v)
            )
            .sort(
              (a, b) =>
                a.created_at.localeCompare(b.created_at) ||
                a.id.localeCompare(b.id)
            )
            .slice(from, to + 1);
          return { data };
        },
      };
      return builder;
    },
  };
  return { client: client as never, calls };
}

const pad = (n: number) => String(n).padStart(5, "0");

// n 張單，每 3 張共用同一個 created_at（逼出「同時間靠 id 定順序」），狀態依 statusOf 決定。
function makeOrders(
  n: number,
  merchantId: string,
  statusOf: (i: number) => string = () => "paid"
): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `order-${merchantId}-${pad(i)}`,
    merchant_id: merchantId,
    status: statusOf(i),
    created_at: `2026-01-01T00:00:${pad(Math.floor(i / 3))}Z`,
  }));
}

describe("fetchCustomerOrders（整家店未取消訂單，翻頁撈齊）", () => {
  it("查訂單表、欄位固定、只這家店、排除 cancelled、created_at 再 id 升冪、範圍 0..999", async () => {
    const { client, calls } = fakeClient(makeOrders(5, "m1"));
    await fetchCustomerOrders(client, "m1");

    assert.equal(calls.length, 1);
    const [c] = calls;
    assert.equal(c.table, "sproutly_orders");
    assert.equal(
      c.columns,
      "id, customer_id, customer_name, customer_email, customer_phone, total_cents, currency, payment_status, status, created_at"
    );
    assert.deepEqual(c.eq, [["merchant_id", "m1"]]);
    assert.deepEqual(c.neq, [["status", "cancelled"]]);
    assert.deepEqual(c.orders, [
      ["created_at", true],
      ["id", true],
    ]);
    assert.deepEqual(c.range, [0, 999]);
  });

  it("別家店的單與取消單都不會混進來，其餘照時間排好", async () => {
    const mine = makeOrders(10, "m1", (i) => (i % 4 === 0 ? "cancelled" : "paid"));
    const others = makeOrders(10, "m2");
    const { client } = fakeClient([...others, ...mine].reverse());
    const out = await fetchCustomerOrders(client, "m1");

    const expected = mine.filter((r) => r.status !== "cancelled").map((r) => r.id);
    assert.deepEqual(
      out.map((r) => r.id),
      expected
    );
  });

  it("超過 1000 單時繼續翻頁撈齊，不重不漏（這是當初標籤忽有忽無的那個病）", async () => {
    const orders = makeOrders(2500, "m1");
    const { client, calls } = fakeClient(orders);
    const out = await fetchCustomerOrders(client, "m1");

    assert.deepEqual(
      calls.map((c) => c.range),
      [
        [0, 999],
        [1000, 1999],
        [2000, 2999],
      ]
    );
    // 每一頁都是同一套篩選與排序
    assert.ok(
      calls.every(
        (c) => c.eq.length === 1 && c.neq.length === 1 && c.orders.length === 2
      )
    );
    assert.deepEqual(
      out.map((r) => r.id),
      orders.map((r) => r.id)
    );
  });

  it("一張單都沒有時回空陣列，只查一次", async () => {
    const { client, calls } = fakeClient(makeOrders(3, "m2"));
    assert.deepEqual(await fetchCustomerOrders(client, "m1"), []);
    assert.equal(calls.length, 1);
  });
});
