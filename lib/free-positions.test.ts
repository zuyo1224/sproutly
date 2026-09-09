// lib/free-positions.ts 自由定位 key 表的行為固定測試。
//
// 為什麼要有這份：同一個 key 同時出現在公開頁 data-edit-drag、拖完存進 DB 的
// freePositions、render 時的 lookup 三處，字串對不上任何一邊拖動就整條斷、
// 而且不會噴錯（只是拖了沒反應或位置存了不生效）。另外 -v2 換代是靠「舊 key
// 不再被認得」把 beta 期殘留座標作廢，如果誰把某個 key 改回舊名、或 legacy
// 清單漏了某個舊 key，殘留座標又會在 SSR 把元素 absolute 到怪位置。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FREE_POS_KEYS,
  stripLegacyFreePositions,
  SECTION_DRAG_ELEMENT,
} from "./free-positions.ts";

describe("FREE_POS_KEYS", () => {
  it("每個 key 都不重複（兩個元素共用一個 key 會互相蓋座標）", () => {
    const vals = Object.values(FREE_POS_KEYS);
    assert.equal(new Set(vals).size, vals.length);
  });

  it("停用風波那批六個一定帶 -v2，其餘一定不帶", () => {
    const v2: string[] = [
      FREE_POS_KEYS.collectionIntro,
      FREE_POS_KEYS.featuredTitle,
      FREE_POS_KEYS.journalIntro,
      FREE_POS_KEYS.promiseCard,
      FREE_POS_KEYS.visitCard,
      FREE_POS_KEYS.testimonialsTitle,
    ];
    for (const k of v2) assert.ok(k.endsWith("-v2"), `${k} 該帶 -v2`);
    const plain = Object.values(FREE_POS_KEYS).filter((k) => !v2.includes(k));
    for (const k of plain) assert.ok(!k.endsWith("-v2"), `${k} 不該帶 -v2`);
  });

  it("hero-tagline 從頭沒停用過，維持原 key", () => {
    assert.equal(FREE_POS_KEYS.heroTagline, "hero-tagline");
  });

  it("key 只用小寫英數與連字號（要塞進 data- 屬性）", () => {
    for (const k of Object.values(FREE_POS_KEYS)) {
      assert.match(k, /^[a-z0-9-]+$/);
    }
  });
});

describe("stripLegacyFreePositions", () => {
  const pos = { x: 0.5, y: 0.5 };

  it("把停用世代的七個舊 key 全部拿掉", () => {
    const fp = {
      "collection-intro": pos,
      "featured-title": pos,
      "featured-h2": pos,
      "journal-intro": pos,
      "promise-card": pos,
      "visit-card": pos,
      "testimonials-title": pos,
    };
    assert.deepEqual(stripLegacyFreePositions(fp), {});
  });

  it("現行的每個 key 都留著，一個都不會被誤刪", () => {
    const fp: Record<string, { x: number; y: number }> = {};
    for (const k of Object.values(FREE_POS_KEYS)) fp[k] = pos;
    assert.deepEqual(stripLegacyFreePositions(fp), fp);
  });

  it("新舊混在一起只刪舊的", () => {
    const got = stripLegacyFreePositions({
      "promise-card": { x: 0.1, y: 0.1 },
      [FREE_POS_KEYS.promiseCard]: { x: 0.9, y: 0.9 },
      "hero-tagline": pos,
    });
    assert.deepEqual(got, {
      [FREE_POS_KEYS.promiseCard]: { x: 0.9, y: 0.9 },
      "hero-tagline": pos,
    });
  });

  it("認不得的其他 key 不動（不是白名單，只黑名單舊 key）", () => {
    const got = stripLegacyFreePositions({ "some-future-key": pos });
    assert.deepEqual(got, { "some-future-key": pos });
  });

  it("回新物件，原本那份不被改到", () => {
    const fp = { "promise-card": pos, "hero-tagline": pos };
    const got = stripLegacyFreePositions(fp);
    assert.notEqual(got, fp);
    assert.deepEqual(fp, { "promise-card": pos, "hero-tagline": pos });
  });

  it("空物件回空物件", () => {
    assert.deepEqual(stripLegacyFreePositions({}), {});
  });
});

describe("SECTION_DRAG_ELEMENT", () => {
  it("表裡每個 key 都是 FREE_POS_KEYS 裡真的存在的值", () => {
    const known = new Set<string>(Object.values(FREE_POS_KEYS));
    for (const [section, entry] of Object.entries(SECTION_DRAG_ELEMENT)) {
      assert.ok(entry, `${section} 沒有 entry`);
      assert.ok(known.has(entry.key), `${section} 指到不存在的 key ${entry.key}`);
    }
  });

  it("hero 不在表裡（hero 版位 UI 在自己的 panel）", () => {
    assert.equal(SECTION_DRAG_ELEMENT.hero, undefined);
  });

  it("每個區段都有非空的人話 label", () => {
    for (const entry of Object.values(SECTION_DRAG_ELEMENT)) {
      assert.ok(entry && entry.label.trim().length > 0);
    }
  });

  it("兩個區段不會指到同一個 key", () => {
    const keys = Object.values(SECTION_DRAG_ELEMENT).map((e) => e!.key);
    assert.equal(new Set(keys).size, keys.length);
  });
});
