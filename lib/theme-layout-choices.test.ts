// lib/theme-layout-choices.ts 的行為固定測試。
//
// 為什麼要有這份：這張表同時餵編輯器存檔（只看 values）與公開頁讀回（values 之外回 fallback），
// 最容易被順手改壞的是「fallback 打錯字不在 values 裡」——tsc 擋不到（fallback 只要求 string），
// 結果是店面永遠畫一個清單外的值。這裡把每格 fallback ∈ values 與 pick 的三種輸入寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LAYOUT_CHOICES,
  LAYOUT_CHOICE_KEYS,
  LAYOUT_COLUMN_CHOICES,
  LAYOUT_COLUMN_KEYS,
  HERO_GAP_OPTIONS,
  HERO_PAD_X_OPTIONS,
  HERO_PAD_Y_OPTIONS,
  HERO_SPLIT_PAD_OPTIONS,
  isLayoutChoice,
  isLayoutColumns,
  pickLayoutChoice,
  pickLayoutColumns,
} from "./theme-layout-choices.ts";
import {
  ALIGN_X_KEYS,
  FONT_WEIGHT_KEYS,
  LEADING_KEYS,
  TEXT_CASE_KEYS,
  TRACKING_KEYS,
} from "./theme-keys.ts";

describe("LAYOUT_CHOICES", () => {
  it("每格的 fallback 都在自己的 values 裡，且 values 沒重複", () => {
    for (const key of LAYOUT_CHOICE_KEYS) {
      const { values, fallback } = LAYOUT_CHOICES[key];
      assert.ok((values as readonly string[]).includes(fallback), `${key} 的 fallback 不在清單內`);
      assert.equal(new Set(values).size, values.length, `${key} 的 values 有重複`);
    }
  });
});

describe("isLayoutChoice / pickLayoutChoice", () => {
  it("清單內的值原樣回", () => {
    assert.equal(isLayoutChoice("heroHeight", "tall"), true);
    assert.equal(pickLayoutChoice("heroHeight", "tall"), "tall");
    assert.equal(pickLayoutChoice("heroSubtitleAlign", "right"), "right");
    assert.equal(pickLayoutChoice("heroCtaWeight", "bold"), "bold");
  });

  it("沒填、壞值、非字串一律回該格 fallback", () => {
    assert.equal(isLayoutChoice("heroHeight", "huge"), false);
    assert.equal(pickLayoutChoice("heroHeight", undefined), "auto");
    assert.equal(pickLayoutChoice("heroHeight", "huge"), "auto");
    assert.equal(pickLayoutChoice("heroHeightMobile", null), "same");
    assert.equal(pickLayoutChoice("buttonRadius", 3), "pill");
    assert.equal(pickLayoutChoice("heroCtaCase", "upper"), "default");
  });
});

describe("Hero 五段文字的對齊／粗細／字距／行距／大小寫那 20 格", () => {
  it("values 就是 theme-keys 的共用清單本身（同一組同一個順序），fallback 對到讀回預設", () => {
    const expect = {
      heroTaglineAlign: [ALIGN_X_KEYS, "left"],
      heroImageFocusX: [ALIGN_X_KEYS, "center"],
      heroSplitTextAlignX: [ALIGN_X_KEYS, "left"],
      heroMinimalAlign: [ALIGN_X_KEYS, "center"],
      heroTextAlignX: [ALIGN_X_KEYS, "center"],
      heroTaglineWeight: [FONT_WEIGHT_KEYS, "normal"],
      heroEyebrowWeight: [FONT_WEIGHT_KEYS, "normal"],
      heroSubtitleWeight: [FONT_WEIGHT_KEYS, "normal"],
      heroBylineWeight: [FONT_WEIGHT_KEYS, "normal"],
      heroTaglineTracking: [TRACKING_KEYS, "normal"],
      heroEyebrowTracking: [TRACKING_KEYS, "normal"],
      heroSubtitleTracking: [TRACKING_KEYS, "normal"],
      heroCtaTracking: [TRACKING_KEYS, "normal"],
      heroBylineTracking: [TRACKING_KEYS, "normal"],
      heroTaglineLeading: [LEADING_KEYS, "normal"],
      heroEyebrowLeading: [LEADING_KEYS, "normal"],
      heroSubtitleLeading: [LEADING_KEYS, "normal"],
      heroBylineLeading: [LEADING_KEYS, "normal"],
      heroEyebrowCase: [TEXT_CASE_KEYS, "upper"],
      heroBylineCase: [TEXT_CASE_KEYS, "upper"],
    } as const;
    assert.equal(Object.keys(expect).length, 20);
    for (const [key, [keys, fallback]] of Object.entries(expect)) {
      const cell = LAYOUT_CHOICES[key as keyof typeof expect];
      assert.deepEqual([...cell.values], [...keys], `${key} 的 values 不是共用清單`);
      assert.equal(cell.fallback, fallback, `${key} 的 fallback 不對`);
    }
    // 存檔端以前的 guard 行為：清單外整格不收；讀回端：清單外回預設
    assert.equal(isLayoutChoice("heroTaglineAlign", "justify"), false);
    assert.equal(pickLayoutChoice("heroTaglineAlign", "justify"), "left");
    assert.equal(pickLayoutChoice("heroEyebrowCase", undefined), "upper");
    assert.equal(pickLayoutChoice("heroBylineLeading", "relaxed"), "relaxed");
  });
});

describe("LAYOUT_COLUMN_CHOICES", () => {
  it("每格的 fallback 都在自己的 values 裡，且 values 沒重複", () => {
    for (const key of LAYOUT_COLUMN_KEYS) {
      const { values, fallback } = LAYOUT_COLUMN_CHOICES[key];
      assert.ok((values as readonly number[]).includes(fallback), `${key} 的 fallback 不在清單內`);
      assert.equal(new Set(values).size, values.length, `${key} 的 values 有重複`);
    }
  });

  it("清單內的欄數原樣回，慢讀只收 2/3", () => {
    assert.equal(isLayoutColumns("featuredColumns", 4), true);
    assert.equal(pickLayoutColumns("featuredColumns", 2), 2);
    assert.equal(pickLayoutColumns("journalColumns", 2), 2);
    assert.equal(isLayoutColumns("journalColumns", 4), false);
    assert.equal(pickLayoutColumns("journalColumns", 4), 3);
  });

  it("沒填、壞值、字串數字一律回該格 fallback", () => {
    assert.equal(pickLayoutColumns("featuredColumns", undefined), 3);
    assert.equal(pickLayoutColumns("statsColumns", null), 4);
    assert.equal(pickLayoutColumns("galleryColumns", 5), 3);
    assert.equal(pickLayoutColumns("collectionsColumns", "3"), 3);
    assert.equal(isLayoutColumns("testimonialsColumns", "3"), false);
    assert.equal(pickLayoutColumns("testimonialsColumns", NaN), 3);
  });
});

describe("HERO_GAP_OPTIONS／HERO_PAD_X_OPTIONS／HERO_PAD_Y_OPTIONS／HERO_SPLIT_PAD_OPTIONS", () => {
  it("四張按鈕表的 v 各跟 LAYOUT_CHOICES 對應欄位的合法值同一組同一個順序，中檔都是「跟預設」，label 有字且不重複", () => {
    for (const [options, key] of [
      [HERO_GAP_OPTIONS, "heroSplitGap"],
      [HERO_GAP_OPTIONS, "heroMagazineTextGap"],
      [HERO_GAP_OPTIONS, "heroMinimalGap"],
      [HERO_GAP_OPTIONS, "heroTextGap"],
      [HERO_PAD_X_OPTIONS, "heroMagazinePadX"],
      [HERO_PAD_X_OPTIONS, "heroMinimalWidth"],
      [HERO_PAD_X_OPTIONS, "heroMinimalPadX"],
      [HERO_PAD_Y_OPTIONS, "heroMinimalPadding"],
      [HERO_PAD_Y_OPTIONS, "heroTextPadding"],
      [HERO_SPLIT_PAD_OPTIONS, "heroSplitTextPadding"],
      [HERO_SPLIT_PAD_OPTIONS, "heroSplitMobilePadY"],
    ] as const) {
      assert.deepEqual(options.map((o) => o.v), [...LAYOUT_CHOICES[key].values]);
      assert.equal(options[1].v, "normal");
      assert.equal(options[1].label, "跟預設");
      const labels = options.map((o) => o.label);
      for (const l of labels) assert.ok(l.length > 0);
      assert.equal(new Set(labels).size, labels.length);
    }
    // 兩格手機版是「same 補在表前面」：表本身之外的值只剩 same
    assert.deepEqual(["same", ...HERO_PAD_X_OPTIONS.map((o) => o.v)], [...LAYOUT_CHOICES.heroMinimalPadXMobile.values]);
    assert.deepEqual(["same", ...HERO_PAD_Y_OPTIONS.map((o) => o.v)], [...LAYOUT_CHOICES.heroMinimalPaddingMobile.values]);
  });
});
