// lib/stock-restore.ts 的行為固定測試：adjustStock（補回／扣回）、decrementStock（結帳扣庫存）、
// restoreStock（adjustStock 的正向別名）。
//
// 為什麼要有這份：這三支是兩個結帳後端與後台取消／復原共用的唯一庫存口徑，做的是「讀當下
// 庫存 → 只在庫存還是那個值時才寫」的比對更新。改壞的樣子都很安靜：少了「先讀再比對」
// 就回到整欄覆蓋，rollback 會把別的客人剛買走的份憑空補回（賣 5 件收到 8 件的單）；重試
// 次數或退出條件改錯，兩個客人前後腳買同一件會被誤報「剛被搶光」；扣回去若被夾成 0，
// 取消→復原→再取消一輪庫存會多出來。這些都不會噴錯，只會在對帳時才發現。
//
// 這裡不碰 Supabase：做一個假的 admin client，把 from / select / update / eq / maybeSingle
// 這條鏈接起來，讀是查一張 Map、寫是「id 對、stock 也對才改」的比對更新，並記錄每次讀寫。
// 要模擬別的客人插隊，就在「讀完之後、寫之前」用 hook 偷改庫存，讓比對落空。
// 跟其他 lib 測試同一套：node:test + node:assert，import 一律帶 .ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adjustStock, decrementStock, restoreStock } from "./stock-restore.ts";

type Stock = number | null;
type AdminArg = Parameters<typeof adjustStock>[0];

type UpdateLog = { id: string; expectStock: number; setStock: number; matched: boolean };

type FakeDb = {
  stocks: Map<string, Stock>;
  reads: string[];
  updates: UpdateLog[];
  /** 每次讀完後呼叫（帶第幾次讀，從 1 起算），用來模擬別人在空檔裡改了庫存。 */
  afterRead?: (n: number) => void;
  admin: AdminArg;
};

// 模擬 supabase-js 的 query builder：方法都回自己，最後 await 或 maybeSingle 才真的執行。
class FakeQuery {
  private op: "select" | "update" = "select";
  private payload: { stock?: number } = {};
  private filters: Array<[string, unknown]> = [];
  private db: FakeDb;
  constructor(db: FakeDb) {
    this.db = db;
  }

  select() {
    return this;
  }
  update(payload: { stock: number }) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.run());
  }
  // update(...).eq(...).eq(...).select("id") 這條鏈是被直接 await 的，所以要是 thenable。
  then<T>(onFul: (v: { data: unknown }) => T, onRej?: (e: unknown) => T) {
    return Promise.resolve(this.run()).then(onFul, onRej);
  }

  private idFilter(): string {
    const f = this.filters.find(([c]) => c === "id");
    assert.ok(f, "每一條查詢都要帶 id 條件");
    return String(f[1]);
  }

  private run(): { data: unknown } {
    const id = this.idFilter();
    if (this.op === "select") {
      this.db.reads.push(id);
      const has = this.db.stocks.has(id);
      const out = has ? { stock: this.db.stocks.get(id) } : null;
      this.db.afterRead?.(this.db.reads.length);
      return { data: out };
    }
    const stockFilter = this.filters.find(([c]) => c === "stock");
    assert.ok(stockFilter, "比對更新一定要帶 stock 條件，否則就是整欄覆蓋");
    const expectStock = stockFilter[1] as number;
    const setStock = this.payload.stock as number;
    const current = this.db.stocks.get(id);
    const matched = this.db.stocks.has(id) && current === expectStock;
    this.db.updates.push({ id, expectStock, setStock, matched });
    if (matched) this.db.stocks.set(id, setStock);
    return { data: matched ? [{ id }] : [] };
  }
}

function fakeDb(initial: Record<string, Stock>): FakeDb {
  const db: FakeDb = {
    stocks: new Map(Object.entries(initial)),
    reads: [],
    updates: [],
    admin: undefined as unknown as AdminArg,
  };
  const client = {
    from(table: string) {
      assert.equal(table, "sproutly_products");
      return new FakeQuery(db);
    },
  };
  db.admin = client as unknown as AdminArg;
  return db;
}

describe("adjustStock（比對更新 +delta，rollback 與後台取消／復原共用）", () => {
  it("庫存 5 補回 3 變 8：讀一次、比對舊值 5 寫一次", async () => {
    const db = fakeDb({ p1: 5 });
    await adjustStock(db.admin, "p1", 3);
    assert.equal(db.stocks.get("p1"), 8);
    assert.deepEqual(db.reads, ["p1"]);
    assert.deepEqual(db.updates, [{ id: "p1", expectStock: 5, setStock: 8, matched: true }]);
  });

  it("商品已被刪：讀到空就結束，不寫任何東西也不丟錯", async () => {
    const db = fakeDb({});
    await adjustStock(db.admin, "gone", 3);
    assert.deepEqual(db.reads, ["gone"]);
    assert.deepEqual(db.updates, []);
  });

  it("商家這期間把庫存改成不限量（null）：沒東西要調，不寫", async () => {
    const db = fakeDb({ p1: null });
    await adjustStock(db.admin, "p1", 3);
    assert.equal(db.stocks.get("p1"), null);
    assert.deepEqual(db.updates, []);
  });

  it("delta 可以是負的，而且允許扣成負數（取消復原時老實呈現賣超，不夾 0）", async () => {
    const db = fakeDb({ p1: 1 });
    await adjustStock(db.admin, "p1", -3);
    assert.equal(db.stocks.get("p1"), -2);
  });

  it("別人在讀寫空檔搶先改了庫存：第一次比對落空，重讀後用新值再寫一次", async () => {
    const db = fakeDb({ p1: 5 });
    // 第一次讀完，另一位客人買走 2 件（5 → 3）
    db.afterRead = (n) => {
      if (n === 1) db.stocks.set("p1", 3);
    };
    await adjustStock(db.admin, "p1", 4);
    assert.equal(db.stocks.get("p1"), 7, "要是 3 + 4，不是把舊值 5 + 4 蓋回去");
    assert.equal(db.reads.length, 2);
    assert.deepEqual(
      db.updates.map((u) => [u.expectStock, u.setStock, u.matched]),
      [
        [5, 9, false],
        [3, 7, true],
      ]
    );
  });

  it("連續搶輸五次就放掉：讀寫各五次、不丟錯、庫存留在別人最後寫的值", async () => {
    const db = fakeDb({ p1: 10 });
    db.afterRead = (n) => db.stocks.set("p1", 100 + n);
    await adjustStock(db.admin, "p1", 1);
    assert.equal(db.reads.length, 5);
    assert.equal(db.updates.length, 5);
    assert.ok(db.updates.every((u) => !u.matched));
    assert.equal(db.stocks.get("p1"), 105);
  });

  it("空檔中商品被改成不限量：重試那次讀到 null 就停，不再寫", async () => {
    const db = fakeDb({ p1: 5 });
    db.afterRead = (n) => {
      if (n === 1) db.stocks.set("p1", null);
    };
    await adjustStock(db.admin, "p1", 2);
    assert.equal(db.stocks.get("p1"), null);
    assert.equal(db.updates.length, 1);
    assert.equal(db.reads.length, 2);
  });
});

describe("decrementStock（結帳扣庫存，重讀重試防超賣）", () => {
  it("庫存 10 買 3：ok、真的扣了、剩 7，比對的是讀到的 10", async () => {
    const db = fakeDb({ p1: 10 });
    const r = await decrementStock(db.admin, "p1", 3);
    assert.deepEqual(r, { ok: true, decremented: true });
    assert.equal(db.stocks.get("p1"), 7);
    assert.deepEqual(db.updates, [{ id: "p1", expectStock: 10, setStock: 7, matched: true }]);
  });

  it("剛好買光（3 買 3）也算成功，剩 0", async () => {
    const db = fakeDb({ p1: 3 });
    const r = await decrementStock(db.admin, "p1", 3);
    assert.deepEqual(r, { ok: true, decremented: true });
    assert.equal(db.stocks.get("p1"), 0);
  });

  it("商品這期間被刪：當成沒貨退回（insufficient、stock 0），不寫", async () => {
    const db = fakeDb({});
    const r = await decrementStock(db.admin, "gone", 1);
    assert.deepEqual(r, { ok: false, reason: "insufficient", stock: 0 });
    assert.deepEqual(db.updates, []);
  });

  it("不限量（null）：ok 但 decremented 是 false，沒東西可扣也不寫", async () => {
    const db = fakeDb({ p1: null });
    const r = await decrementStock(db.admin, "p1", 5);
    assert.deepEqual(r, { ok: true, decremented: false });
    assert.deepEqual(db.updates, []);
  });

  it("庫存不夠（2 買 3）：insufficient 帶當下剩量 2，不寫", async () => {
    const db = fakeDb({ p1: 2 });
    const r = await decrementStock(db.admin, "p1", 3);
    assert.deepEqual(r, { ok: false, reason: "insufficient", stock: 2 });
    assert.equal(db.stocks.get("p1"), 2);
    assert.deepEqual(db.updates, []);
  });

  it("庫存 0 買 1：insufficient 帶 0（不是當成不限量）", async () => {
    const db = fakeDb({ p1: 0 });
    const r = await decrementStock(db.admin, "p1", 1);
    assert.deepEqual(r, { ok: false, reason: "insufficient", stock: 0 });
  });

  it("兩個客人前後腳買：比對落空一次後重讀，庫存還夠就照樣成功，不再誤報搶光", async () => {
    const db = fakeDb({ p1: 10 });
    db.afterRead = (n) => {
      if (n === 1) db.stocks.set("p1", 9); // 另一位先扣走 1
    };
    const r = await decrementStock(db.admin, "p1", 3);
    assert.deepEqual(r, { ok: true, decremented: true });
    assert.equal(db.stocks.get("p1"), 6, "9 - 3，不是 10 - 3");
    assert.equal(db.reads.length, 2);
    assert.deepEqual(
      db.updates.map((u) => [u.expectStock, u.setStock, u.matched]),
      [
        [10, 7, false],
        [9, 6, true],
      ]
    );
  });

  it("重讀後發現真的不夠了：insufficient 帶的是重讀到的剩量", async () => {
    const db = fakeDb({ p1: 10 });
    db.afterRead = (n) => {
      if (n === 1) db.stocks.set("p1", 1);
    };
    const r = await decrementStock(db.admin, "p1", 3);
    assert.deepEqual(r, { ok: false, reason: "insufficient", stock: 1 });
    assert.equal(db.stocks.get("p1"), 1);
  });

  it("重讀後商品變不限量：ok 但 decremented false", async () => {
    const db = fakeDb({ p1: 10 });
    db.afterRead = (n) => {
      if (n === 1) db.stocks.set("p1", null);
    };
    const r = await decrementStock(db.admin, "p1", 3);
    assert.deepEqual(r, { ok: true, decremented: false });
  });

  it("連續搶輸五次：回 conflict、讀寫各五次、庫存沒被動到", async () => {
    const db = fakeDb({ p1: 50 });
    db.afterRead = (n) => db.stocks.set("p1", 50 - n);
    const r = await decrementStock(db.admin, "p1", 1);
    assert.deepEqual(r, { ok: false, reason: "conflict" });
    assert.equal(db.reads.length, 5);
    assert.equal(db.updates.length, 5);
    assert.ok(db.updates.every((u) => !u.matched));
    assert.equal(db.stocks.get("p1"), 45, "只有 hook 動過，decrementStock 沒寫進去");
  });

  it("搶輸四次第五次成功：仍算 ok，不會因為重試過就退回", async () => {
    const db = fakeDb({ p1: 50 });
    db.afterRead = (n) => {
      if (n <= 4) db.stocks.set("p1", 50 - n);
    };
    const r = await decrementStock(db.admin, "p1", 2);
    assert.deepEqual(r, { ok: true, decremented: true });
    assert.equal(db.stocks.get("p1"), 44);
    assert.equal(db.updates.length, 5);
  });
});

describe("restoreStock（結帳失敗補回，qty 為正、方向是加）", () => {
  it("扣了 2 件後補回：5 → 7，走的是同一套比對更新", async () => {
    const db = fakeDb({ p1: 5 });
    await restoreStock(db.admin, "p1", 2);
    assert.equal(db.stocks.get("p1"), 7);
    assert.deepEqual(db.updates, [{ id: "p1", expectStock: 5, setStock: 7, matched: true }]);
  });

  it("空檔中別的客人買走的份不會被補回來：以當下值為準加，不是寫回舊值", async () => {
    // 情境：下單前 5、扣 2 剩 3、別人再買 3 剩 0、這張單失敗要補回 2 → 正確是 2，不是 5
    const db = fakeDb({ p1: 0 });
    await restoreStock(db.admin, "p1", 2);
    assert.equal(db.stocks.get("p1"), 2);
  });
});
