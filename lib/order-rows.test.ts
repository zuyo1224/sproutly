// lib/order-rows.ts 的行為固定測試。
//
// 這兩支組出來的物件是「訂單長什麼樣」的唯一定義，寫壞了不會噴錯，只會安靜地存出
// 一張欄位不對的單：狀態開錯客人就看不到「處理中」、快照沒帶到就變成事後改價會回頭
// 動到舊訂單。這裡把欄位名、欄位數、寫死的初始狀態全部釘住，順便釘住「兩條結帳路徑
// 餵不同輸入也只會差在金額／幣別／商品」這件事。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildOrderRow, buildOrderItemRow } from "./order-rows.ts";

const BASE = {
  merchantId: "m1",
  customerId: null,
  customerName: "王小明",
  customerPhone: "0912345678",
  customerEmail: null,
  shippingAddress: null,
  note: null,
  totalCents: 1200,
  currency: "TWD",
  paymentMethod: null,
};

describe("buildOrderRow", () => {
  it("欄位名與欄位數釘住，多一個少一個都算改壞", () => {
    assert.deepEqual(Object.keys(buildOrderRow(BASE)).sort(), [
      "currency",
      "customer_email",
      "customer_id",
      "customer_name",
      "customer_phone",
      "merchant_id",
      "note",
      "payment_method",
      "payment_status",
      "shipping_address",
      "status",
      "total_cents",
    ]);
  });

  it("新單一律 pending + unpaid，呼叫端沒得改", () => {
    const row = buildOrderRow(BASE);
    assert.equal(row.status, "pending");
    assert.equal(row.payment_status, "unpaid");
  });

  it("有登入就帶 customer_id，沒登入是 null（匿名下單照樣成立）", () => {
    assert.equal(buildOrderRow(BASE).customer_id, null);
    assert.equal(
      buildOrderRow({ ...BASE, customerId: "u1" }).customer_id,
      "u1"
    );
  });

  it("選填的那幾格是 null 就照樣存 null，不會被換成空字串", () => {
    const row = buildOrderRow(BASE);
    assert.equal(row.customer_email, null);
    assert.equal(row.shipping_address, null);
    assert.equal(row.note, null);
    assert.equal(row.payment_method, null);
  });

  it("填了的值原封不動搬過去，不做二次處理", () => {
    const row = buildOrderRow({
      ...BASE,
      customerEmail: "a@b.com",
      shippingAddress: "台北市中正區1號",
      note: "配送方式：宅配\n請放管理室",
      paymentMethod: "cash",
      totalCents: 0,
      currency: "USD",
    });
    assert.equal(row.customer_email, "a@b.com");
    assert.equal(row.shipping_address, "台北市中正區1號");
    assert.equal(row.note, "配送方式：宅配\n請放管理室");
    assert.equal(row.payment_method, "cash");
    assert.equal(row.total_cents, 0);
    assert.equal(row.currency, "USD");
  });

  it("同一組收件人資料，兩條結帳路徑只會差在金額與幣別", () => {
    const single = buildOrderRow({ ...BASE, totalCents: 500 });
    const cart = buildOrderRow({ ...BASE, totalCents: 1800 });
    assert.deepEqual(
      { ...single, total_cents: 0 },
      { ...cart, total_cents: 0 }
    );
  });
});

describe("buildOrderItemRow", () => {
  const product = { id: "p1", name: "龜背芋", price_cents: 600 };

  it("欄位名與欄位數釘住", () => {
    assert.deepEqual(
      Object.keys(buildOrderItemRow({ orderId: "o1", product, quantity: 2 })).sort(),
      [
        "name_snapshot",
        "order_id",
        "price_cents_snapshot",
        "product_id",
        "quantity",
      ]
    );
  });

  it("品名與單價存的是下單當下的快照，不是 join 現值", () => {
    const row = buildOrderItemRow({ orderId: "o1", product, quantity: 2 });
    assert.equal(row.product_id, "p1");
    assert.equal(row.name_snapshot, "龜背芋");
    assert.equal(row.price_cents_snapshot, 600);
    assert.equal(row.quantity, 2);
  });

  it("不幫忙算小計：單價存單價，數量存數量", () => {
    const row = buildOrderItemRow({ orderId: "o1", product, quantity: 3 });
    assert.equal(row.price_cents_snapshot, 600);
    assert.equal(row.quantity, 3);
  });

  it("同一張單的多筆明細各自帶自己的商品，order_id 相同", () => {
    const rows = [
      { id: "p1", name: "龜背芋", price_cents: 600 },
      { id: "p2", name: "琴葉榕", price_cents: 900 },
    ].map((p, i) => buildOrderItemRow({ orderId: "o1", product: p, quantity: i + 1 }));
    assert.deepEqual(rows.map((r) => r.order_id), ["o1", "o1"]);
    assert.deepEqual(rows.map((r) => r.product_id), ["p1", "p2"]);
    assert.deepEqual(rows.map((r) => r.name_snapshot), ["龜背芋", "琴葉榕"]);
    assert.deepEqual(rows.map((r) => r.quantity), [1, 2]);
  });
});
