// lib/fetch-order-items.ts 的行為固定測試。
//
// 為什麼要有這份：訂單匯出 CSV 與客人的訂單紀錄都靠這支把品項湊回每張單。它要同時顧兩條
// 互不相干的上限——訂單編號每 100 筆切一批（管查詢網址長度），每一批再用 fetchAllRows
// 翻頁撈到不滿 1000 列（管 Supabase 單次回傳上限）。以前只顧了前一條，品項一多 CSV 的
// 「商品」欄就默默空白。這裡不碰 Supabase，用一個假的查詢串接器記錄每次查了哪些 id、
// 下了什麼排序、問了哪一段範圍，把「切批」「翻頁」「排序切點」「結果不漏不重」寫死。
//
// 跟 fetch-all-rows.test.ts 同一套：Node 內建 node:test + node:assert，import 寫 ./fetch-order-items.ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchOrderItems } from "./fetch-order-items.ts";

type Item = {
  id: string;
  order_id: string;
  name_snapshot: string;
  quantity: number;
  price_cents_snapshot: number;
};

type Call = {
  table: string;
  columns: string;
  inColumn: string;
  ids: string[];
  orders: Array<[string, boolean]>;
  range: [number, number];
};

// 假的 supabase client：只實作 fetchOrderItems 用到的那條鏈
// from → select → in → order → order → range，range 時照 in 的 id 篩、照 order 排、照範圍切。
function fakeClient(items: Item[]) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Partial<Call> & { orders: Array<[string, boolean]> } = {
        table,
        orders: [],
      };
      const builder = {
        select(columns: string) {
          call.columns = columns;
          return builder;
        },
        in(column: string, ids: string[]) {
          call.inColumn = column;
          call.ids = [...ids];
          return builder;
        },
        order(column: string, opts: { ascending: boolean }) {
          call.orders.push([column, opts.ascending]);
          return builder;
        },
        async range(from: number, to: number) {
          call.range = [from, to];
          calls.push(call as Call);
          const wanted = new Set(call.ids);
          const rows = items
            .filter((it) => wanted.has(it.order_id))
            .sort(
              (a, b) =>
                a.order_id.localeCompare(b.order_id) || a.id.localeCompare(b.id)
            )
            .slice(from, to + 1);
          return { data: rows };
        },
      };
      return builder;
    },
  };
  return { client: client as never, calls };
}

const pad = (n: number) => String(n).padStart(4, "0");
const orderId = (n: number) => `order-${pad(n)}`;

// 每張單各 perOrder 個品項，品項 id 帶單號與序號，排序結果可預期。
function makeItems(orderCount: number, perOrder: number): Item[] {
  const out: Item[] = [];
  for (let o = 0; o < orderCount; o++) {
    for (let k = 0; k < perOrder; k++) {
      out.push({
        id: `item-${pad(o)}-${pad(k)}`,
        order_id: orderId(o),
        name_snapshot: `商品 ${k}`,
        quantity: 1,
        price_cents_snapshot: 100,
      });
    }
  }
  return out;
}

const strip = (r: Item) => ({
  order_id: r.order_id,
  name_snapshot: r.name_snapshot,
  quantity: r.quantity,
  price_cents_snapshot: r.price_cents_snapshot,
});

describe("fetchOrderItems（id 每 100 筆一批、每批翻頁撈齊）", () => {
  it("沒有訂單編號時一次都不查，回空陣列", async () => {
    const { client, calls } = fakeClient(makeItems(3, 2));
    assert.deepEqual(await fetchOrderItems(client, []), []);
    assert.equal(calls.length, 0);
  });

  it("一小批：查品項表、只要四個欄位、order_id 再 id 兩層升冪當切點、範圍 0..999", async () => {
    const items = makeItems(5, 3);
    const ids = Array.from({ length: 5 }, (_, i) => orderId(i));
    const { client, calls } = fakeClient(items);
    const out = await fetchOrderItems(client, ids);

    assert.equal(calls.length, 1);
    const [c] = calls;
    assert.equal(c.table, "sproutly_order_items");
    assert.equal(c.columns, "order_id, name_snapshot, quantity, price_cents_snapshot");
    assert.equal(c.inColumn, "order_id");
    assert.deepEqual(c.ids, ids);
    assert.deepEqual(c.orders, [
      ["order_id", true],
      ["id", true],
    ]);
    assert.deepEqual(c.range, [0, 999]);
    // 假表會把整列（含 id）回給它；這裡只比呼叫端真正用得到的欄位
    assert.deepEqual(out.map((r) => strip(r as Item)), items.map(strip));
  });

  it("250 個編號切成 100／100／50 三批，順序照原清單、不重不漏", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => orderId(i));
    const { client, calls } = fakeClient(makeItems(250, 1));
    const out = await fetchOrderItems(client, ids);

    assert.deepEqual(
      calls.map((c) => c.ids.length),
      [100, 100, 50]
    );
    assert.deepEqual(calls.flatMap((c) => c.ids), ids);
    assert.ok(calls.every((c) => c.range[0] === 0 && c.range[1] === 999));
    assert.equal(out.length, 250);
  });

  it("剛好 100 個編號只算一批，不會多送一次空的 in()", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => orderId(i));
    const { client, calls } = fakeClient(makeItems(100, 1));
    await fetchOrderItems(client, ids);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].ids.length, 100);
  });

  it("一批品項超過 1000 列時繼續翻頁撈齊（這是當初 CSV 商品欄空白的那個病）", async () => {
    // 100 張單 × 23 項 = 2300 列，一批就破 1000
    const items = makeItems(100, 23);
    const ids = Array.from({ length: 100 }, (_, i) => orderId(i));
    const { client, calls } = fakeClient(items);
    const out = await fetchOrderItems(client, ids);

    assert.deepEqual(
      calls.map((c) => c.range),
      [
        [0, 999],
        [1000, 1999],
        [2000, 2999],
      ]
    );
    // 每一頁都是同一批 id、同一套排序
    assert.ok(calls.every((c) => c.ids.length === 100 && c.orders.length === 2));
    assert.equal(out.length, 2300);
    assert.deepEqual(out.map((r) => strip(r as Item)), items.map(strip));
  });

  it("翻頁與切批疊在一起：第二批也各自從 0 開始翻", async () => {
    // 150 張單 × 10 項：第一批 100 單＝1000 列（剛好一頁要再問一次），第二批 50 單＝500 列
    const ids = Array.from({ length: 150 }, (_, i) => orderId(i));
    const { client, calls } = fakeClient(makeItems(150, 10));
    const out = await fetchOrderItems(client, ids);

    assert.deepEqual(
      calls.map((c) => [c.ids.length, ...c.range]),
      [
        [100, 0, 999],
        [100, 1000, 1999],
        [50, 0, 999],
      ]
    );
    assert.equal(out.length, 1500);
  });
});
