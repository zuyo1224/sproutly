import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALIGN_X_KEYS,
  ALIGN_X_OPTIONS,
  ALIGN_X_SHORT_OPTIONS,
  TRACKING_OPTIONS,
  LEADING_OPTIONS,
  HERO_STYLE_KEYS,
  HERO_IMAGE_SIDES,
  SECTION_KEYS,
  DEFAULT_SECTION_ORDER,
  sanitizeSectionOrder,
  withRequiredSections,
  FONT_WEIGHT_KEYS,
  FONT_WEIGHT_OPTIONS,
  TRACKING_KEYS,
  LEADING_KEYS,
  TEXT_CASE_KEYS,
  TEXT_CASE_OPTIONS,
  PRESET_KEYS,
  FONT_KEYS,
  isPresetKey,
  isFontKey,
  isHeroStyle,
  isHeroImageSide,
  isSectionKey,
} from "./theme-keys.ts";

test("hero 四種版型都算合法，清單外與非字串不算", () => {
  for (const k of HERO_STYLE_KEYS) assert.equal(isHeroStyle(k), true);
  assert.equal(isHeroStyle("grid"), false);
  assert.equal(isHeroStyle(""), false);
  assert.equal(isHeroStyle(undefined), false);
  assert.equal(isHeroStyle(1), false);
});

test("hero 圖位置只有 left / right 兩種，清單外與非字串不算", () => {
  assert.deepEqual([...HERO_IMAGE_SIDES], ["left", "right"]);
  for (const k of HERO_IMAGE_SIDES) assert.equal(isHeroImageSide(k), true);
  assert.equal(isHeroImageSide("top"), false);
  assert.equal(isHeroImageSide("Left"), false);
  assert.equal(isHeroImageSide(""), false);
  assert.equal(isHeroImageSide(undefined), false);
  assert.equal(isHeroImageSide(null), false);
});

test("11 個 section 都算合法，清單外與非字串不算", () => {
  assert.equal(SECTION_KEYS.length, 11);
  for (const k of SECTION_KEYS) assert.equal(isSectionKey(k), true);
  assert.equal(isSectionKey("footer"), false);
  assert.equal(isSectionKey("Hero"), false);
  assert.equal(isSectionKey(null), false);
});

test("兩張清單沒有重複", () => {
  assert.equal(new Set(HERO_STYLE_KEYS).size, HERO_STYLE_KEYS.length);
  assert.equal(new Set(SECTION_KEYS).size, SECTION_KEYS.length);
});

test("預設順序的 6 個都在 11 個之內，且順序照 hero 開頭、visit 收尾", () => {
  for (const k of DEFAULT_SECTION_ORDER) assert.equal(isSectionKey(k), true);
  assert.equal(new Set(DEFAULT_SECTION_ORDER).size, DEFAULT_SECTION_ORDER.length);
  assert.equal(DEFAULT_SECTION_ORDER[0], "hero");
  assert.equal(DEFAULT_SECTION_ORDER.at(-1), "visit");
});

// 這五張清單的「清單外的值不算、按鈕那格的 default 是它自己的一檔」由 theme-layout-choices.test
// 對 isLayoutChoice／pickLayoutChoice 測（存檔與讀回實際走那條路）；這裡只守清單本身的值與順序。
test("水平對齊只有 left / center / right 三種", () => {
  assert.deepEqual([...ALIGN_X_KEYS], ["left", "center", "right"]);
});

test("Hero 文字三張三檔清單：粗細 / 字距 / 行距，字距的 wide 與行距的 relaxed 不互通", () => {
  assert.deepEqual([...FONT_WEIGHT_KEYS], ["normal", "medium", "bold"]);
  assert.deepEqual([...TRACKING_KEYS], ["tight", "normal", "wide"]);
  assert.deepEqual([...LEADING_KEYS], ["tight", "normal", "relaxed"]);
  assert.equal((TRACKING_KEYS as readonly string[]).includes("relaxed"), false);
  assert.equal((LEADING_KEYS as readonly string[]).includes("wide"), false);
});

test("Hero 小標 / byline 大小寫三檔：upper / capitalize / none，沒有按鈕那格的 default", () => {
  assert.deepEqual([...TEXT_CASE_KEYS], ["upper", "capitalize", "none"]);
  assert.equal((TEXT_CASE_KEYS as readonly string[]).includes("default"), false);
});

test("風格底五種與字體六種都算合法，清單外、大小寫不同與非字串不算", () => {
  assert.deepEqual([...PRESET_KEYS], ["editorial", "plant-zen", "nordic", "aesop", "modern"]);
  for (const k of PRESET_KEYS) assert.equal(isPresetKey(k), true);
  assert.equal(isPresetKey("Aesop"), false);
  assert.equal(isPresetKey("plant_zen"), false);
  assert.equal(isPresetKey(""), false);
  assert.equal(isPresetKey(undefined), false);

  assert.deepEqual([...FONT_KEYS], ["cormorant", "playfair", "inter", "noto", "noto-serif", "lora"]);
  for (const k of FONT_KEYS) assert.equal(isFontKey(k), true);
  assert.equal(isFontKey("Inter"), false);
  assert.equal(isFontKey("noto_serif"), false);
  assert.equal(isFontKey(null), false);
  assert.equal(isFontKey(1), false);
});

test("編輯器對齊三顆按鈕的選項表（長字／短字兩張）都跟 ALIGN_X_KEYS 同一組值同一個順序，label 都有字且不重複", () => {
  for (const options of [ALIGN_X_OPTIONS, ALIGN_X_SHORT_OPTIONS]) {
    assert.deepEqual(options.map((o) => o.v), [...ALIGN_X_KEYS]);
    const labels = options.map((o) => o.label);
    for (const l of labels) assert.ok(l.length > 0);
    assert.equal(new Set(labels).size, labels.length);
  }
});

test("編輯器字距／行距／粗細／大小寫三顆按鈕的選項表各跟 TRACKING_KEYS／LEADING_KEYS／FONT_WEIGHT_KEYS／TEXT_CASE_KEYS 同一組值同一個順序，label 都有字且不重複", () => {
  for (const [options, keys] of [
    [TRACKING_OPTIONS, TRACKING_KEYS],
    [LEADING_OPTIONS, LEADING_KEYS],
    [FONT_WEIGHT_OPTIONS, FONT_WEIGHT_KEYS],
    [TEXT_CASE_OPTIONS, TEXT_CASE_KEYS],
  ] as const) {
    assert.deepEqual(options.map((o) => o.v), [...keys]);
    const labels = options.map((o) => o.label);
    for (const l of labels) assert.ok(l.length > 0);
    assert.equal(new Set(labels).size, labels.length);
  }
});

test("sanitizeSectionOrder：不是陣列當空、只留合法 key、重複留第一次；傳 DEFAULT_SECTION_ORDER 當 allowed 時可加區塊會被濾掉", () => {
  assert.deepEqual(sanitizeSectionOrder(undefined), []);
  assert.deepEqual(sanitizeSectionOrder("hero,visit"), []);
  assert.deepEqual(
    sanitizeSectionOrder(["visit", "nope", 3, "hero", "visit", "faq", ""]),
    ["visit", "hero", "faq"],
  );
  assert.deepEqual(
    sanitizeSectionOrder(["faq", "visit", "testimonials", "hero"], DEFAULT_SECTION_ORDER),
    ["visit", "hero"],
  );
});

test("withRequiredSections：基本 6 個沒列到的照 DEFAULT_SECTION_ORDER 順序補在後面、已有的不動位置、可加區塊不會被補進來也不會被拿掉", () => {
  assert.deepEqual(withRequiredSections([]), [...DEFAULT_SECTION_ORDER]);
  assert.deepEqual(
    withRequiredSections(["visit", "faq", "hero"]),
    ["visit", "faq", "hero", "collections", "featured", "journal", "promise"],
  );
  const full = withRequiredSections([...DEFAULT_SECTION_ORDER].reverse());
  assert.deepEqual(full, [...DEFAULT_SECTION_ORDER].reverse());
  assert.ok(!full.includes("testimonials"));
});
