// lib/theme-scale.ts 編輯器 slider 上下限的行為固定測試。
//
// 為什麼要有這份：Hero 縮放、字體倍率、精選張數的範圍是 slider、存檔 sanitize、
// 公開頁 resolve 三處共用的唯一口徑。以前各抄三份，放寬一處漏另一處就會
// 「slider 拉得到、存檔又夾回去」。這裡把每組的 MIN／MAX 跟 clamp 的邊界寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HERO_ZOOM_MIN,
  HERO_ZOOM_MAX,
  HERO_FONT_SCALE_MIN,
  HERO_FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FEATURED_COUNT_MIN,
  FEATURED_COUNT_MAX,
  clampHeroZoom,
  clampHeroFontScale,
  clampFontScale,
  clampFeaturedCount,
  clampFreePos,
} from "./theme-scale.ts";

describe("常數本身", () => {
  it("四組範圍都是 MIN < MAX，且跟 slider 目前標的值一樣", () => {
    assert.deepEqual(
      [HERO_ZOOM_MIN, HERO_ZOOM_MAX],
      [1.0, 2.5]
    );
    assert.deepEqual(
      [HERO_FONT_SCALE_MIN, HERO_FONT_SCALE_MAX],
      [0.6, 1.8]
    );
    assert.deepEqual([FONT_SCALE_MIN, FONT_SCALE_MAX], [0.8, 1.3]);
    assert.deepEqual([FEATURED_COUNT_MIN, FEATURED_COUNT_MAX], [3, 12]);
  });

  it("預設值 1.0（zoom／字體倍率）落在範圍內，不會一存就被夾動", () => {
    assert.equal(clampHeroZoom(1.0), 1.0);
    assert.equal(clampHeroFontScale(1.0), 1.0);
    assert.equal(clampFontScale(1.0), 1.0);
  });
});

describe("三支倍率 clamp", () => {
  const cases: Array<[string, (v: number) => number, number, number]> = [
    ["clampHeroZoom", clampHeroZoom, HERO_ZOOM_MIN, HERO_ZOOM_MAX],
    ["clampHeroFontScale", clampHeroFontScale, HERO_FONT_SCALE_MIN, HERO_FONT_SCALE_MAX],
    ["clampFontScale", clampFontScale, FONT_SCALE_MIN, FONT_SCALE_MAX],
  ];

  for (const [name, fn, min, max] of cases) {
    it(`${name}：範圍內原樣回、邊界值留下、超出夾到邊界`, () => {
      const mid = (min + max) / 2;
      assert.equal(fn(mid), mid);
      assert.equal(fn(min), min);
      assert.equal(fn(max), max);
      assert.equal(fn(min - 0.01), min);
      assert.equal(fn(max + 0.01), max);
      assert.equal(fn(-100), min);
      assert.equal(fn(100), max);
    });

    it(`${name}：小數不取整（倍率允許 1.25 這種值）`, () => {
      const v = min + (max - min) * 0.37;
      assert.equal(fn(v), v);
    });
  }
});

describe("clampFeaturedCount", () => {
  it("範圍內整數原樣回、邊界留下", () => {
    assert.equal(clampFeaturedCount(6), 6);
    assert.equal(clampFeaturedCount(3), 3);
    assert.equal(clampFeaturedCount(12), 12);
  });

  it("超出夾到 3／12", () => {
    assert.equal(clampFeaturedCount(0), 3);
    assert.equal(clampFeaturedCount(-5), 3);
    assert.equal(clampFeaturedCount(13), 12);
    assert.equal(clampFeaturedCount(999), 12);
  });

  it("小數先 floor 再夾：6.9 是 6、2.9 夾到 3、12.5 夾到 12", () => {
    assert.equal(clampFeaturedCount(6.9), 6);
    assert.equal(clampFeaturedCount(2.9), 3);
    assert.equal(clampFeaturedCount(12.5), 12);
  });
});

describe("clampFreePos", () => {
  it("0-1 內原樣回，含 0 與 1 本身", () => {
    assert.equal(clampFreePos(0), 0);
    assert.equal(clampFreePos(1), 1);
    assert.equal(clampFreePos(0.5), 0.5);
    assert.equal(clampFreePos(0.123456), 0.123456);
  });

  it("拖出畫面外夾回邊緣", () => {
    assert.equal(clampFreePos(-0.2), 0);
    assert.equal(clampFreePos(1.7), 1);
  });
});
