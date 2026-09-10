// lib/date-compare.ts 兩支排序比較器的行為固定測試。
//
// 客人列表頁與匯出 CSV 共三處排序（訂單依 created_at 升、客人依 firstOrderAt 升、
// 依 lastOrderAt 降）都吃這兩支。升降序寫反不會噴錯，只會讓「最近下單」那欄變成
// 最久沒來的那位排最前面，商家看不出是排序壞了。這裡把方向、時區寫法與相等寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareIsoAsc, compareIsoDesc } from "./date-compare.ts";

const EARLY = "2026-01-01T00:00:00.000Z";
const LATE = "2026-06-01T00:00:00.000Z";

describe("compareIsoAsc（舊到新）", () => {
  it("舊的排前面：負數", () => {
    assert.ok(compareIsoAsc(EARLY, LATE) < 0);
  });

  it("新的在前要往後移：正數", () => {
    assert.ok(compareIsoAsc(LATE, EARLY) > 0);
  });

  it("同一個時間回 0", () => {
    assert.equal(compareIsoAsc(EARLY, EARLY), 0);
  });

  it("整串 sort 出來是舊到新", () => {
    const list = [LATE, EARLY, "2026-03-15T12:00:00.000Z"];
    assert.deepEqual([...list].sort(compareIsoAsc), [
      EARLY,
      "2026-03-15T12:00:00.000Z",
      LATE,
    ]);
  });
});

describe("compareIsoDesc（新到舊）", () => {
  it("方向跟升序相反", () => {
    assert.ok(compareIsoDesc(EARLY, LATE) > 0);
    assert.ok(compareIsoDesc(LATE, EARLY) < 0);
  });

  it("同一個時間回 0", () => {
    assert.equal(compareIsoDesc(LATE, LATE), 0);
  });

  it("整串 sort 出來是新到舊", () => {
    const list = [EARLY, LATE, "2026-03-15T12:00:00.000Z"];
    assert.deepEqual([...list].sort(compareIsoDesc), [
      LATE,
      "2026-03-15T12:00:00.000Z",
      EARLY,
    ]);
  });
});

describe("時間寫法與精度", () => {
  it("帶時區位移與同一時刻的 Z 寫法視為相等", () => {
    assert.equal(compareIsoAsc("2026-01-01T08:00:00+08:00", "2026-01-01T00:00:00.000Z"), 0);
    assert.equal(compareIsoDesc("2026-01-01T08:00:00+08:00", "2026-01-01T00:00:00.000Z"), 0);
  });

  it("差一毫秒也分得出來（Supabase 的 created_at 同秒多筆靠這個穩定）", () => {
    assert.ok(compareIsoAsc("2026-01-01T00:00:00.001Z", "2026-01-01T00:00:00.002Z") < 0);
  });

  it("只給日期沒給時間也能比", () => {
    assert.ok(compareIsoAsc("2026-01-01", "2026-01-02") < 0);
  });
});

describe("壞值", () => {
  it("有一邊解不出時間就回 NaN（不會靜靜當成相等）", () => {
    assert.ok(Number.isNaN(compareIsoAsc("不是時間", LATE)));
    assert.ok(Number.isNaN(compareIsoAsc(LATE, "")));
    assert.ok(Number.isNaN(compareIsoDesc("不是時間", LATE)));
  });
});
