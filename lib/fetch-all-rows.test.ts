// lib/fetch-all-rows.ts 的行為固定測試。
//
// 為什麼要有這份：Supabase 一次查詢最多回約 1000 列，客人列表、匯出品項這類「整家店一次 select」
// 的查詢資料量一超過就默默少算（b21488f、7f9d6d0 都是這個病），fetchAllRows 是把「翻頁到撈齊」
// 收成一支的解法。它的正確性全在三件事：每頁的 from / to 怎麼算、什麼時候停、頁與頁怎麼接。
// 這裡不碰 Supabase，用一個假的 queryPage 記錄每次被問的範圍、回固定切好的資料，把「剛好一頁
// 要再問一次」「不滿一頁就停」「data 是 null 當空頁」這些邊界寫死。
//
// 跟 image-url.test.ts 同一套：Node 內建 node:test + node:assert，import 寫 ./fetch-all-rows.ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchAllRows } from "./fetch-all-rows.ts";

const PAGE = 1000;

// 造 n 列「id 由 0 遞增」的假資料，再做一個照 from..to 切片、並記錄每次被問範圍的 queryPage。
function fakeTable(n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: Array<[number, number]> = [];
  const queryPage = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1) };
  };
  return { rows, calls, queryPage };
}

describe("fetchAllRows（一頁頁翻到不滿一頁為止）", () => {
  it("第一頁不滿 1000 列就只問一次，範圍是 0..999", async () => {
    const t = fakeTable(37);
    const out = await fetchAllRows(t.queryPage);
    assert.deepEqual(out, t.rows);
    assert.deepEqual(t.calls, [[0, PAGE - 1]]);
  });

  it("完全沒資料時回空陣列，也只問一次", async () => {
    const t = fakeTable(0);
    assert.deepEqual(await fetchAllRows(t.queryPage), []);
    assert.deepEqual(t.calls, [[0, PAGE - 1]]);
  });

  it("剛好滿 1000 列不能就此停下，要再問下一頁確認沒有了", async () => {
    const t = fakeTable(PAGE);
    const out = await fetchAllRows(t.queryPage);
    assert.equal(out.length, PAGE);
    assert.deepEqual(t.calls, [
      [0, PAGE - 1],
      [PAGE, 2 * PAGE - 1],
    ]);
  });

  it("跨多頁時逐頁往後問、資料照順序接起來、一列不漏不重", async () => {
    const t = fakeTable(2 * PAGE + 500);
    const out = await fetchAllRows(t.queryPage);
    assert.equal(out.length, 2 * PAGE + 500);
    assert.deepEqual(
      out.map((r) => r.id),
      t.rows.map((r) => r.id),
    );
    assert.deepEqual(t.calls, [
      [0, PAGE - 1],
      [PAGE, 2 * PAGE - 1],
      [2 * PAGE, 3 * PAGE - 1],
    ]);
  });

  it("data 是 null（Supabase 出錯時的回法）當作空頁：停止翻頁、已撈到的照樣回", async () => {
    let n = 0;
    const out = await fetchAllRows<{ id: number }>(async () => {
      n += 1;
      if (n === 1) return { data: Array.from({ length: PAGE }, (_, i) => ({ id: i })) };
      return { data: null };
    });
    assert.equal(out.length, PAGE);
    assert.equal(n, 2);
  });

  it("接受回 PromiseLike 的 queryPage（Supabase 的 query builder 是 thenable 不是真 Promise）", async () => {
    // 只暴露 then、不是 Promise 實例，型別借 Promise 的 then 簽名免得自己重抄一遍
    const thenable = (rows: { id: number }[]): PromiseLike<{ data: { id: number }[] | null }> => {
      const p = Promise.resolve({ data: rows });
      return { then: p.then.bind(p) };
    };
    const out = await fetchAllRows<{ id: number }>(() => thenable([{ id: 1 }, { id: 2 }]));
    assert.deepEqual(out, [{ id: 1 }, { id: 2 }]);
  });
});
