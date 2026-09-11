import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALIGN_X_KEYS,
  HERO_STYLE_KEYS,
  HERO_IMAGE_SIDES,
  SECTION_KEYS,
  DEFAULT_SECTION_ORDER,
  FONT_WEIGHT_KEYS,
  TRACKING_KEYS,
  LEADING_KEYS,
  TEXT_CASE_KEYS,
  PRESET_KEYS,
  FONT_KEYS,
  isAlignX,
  isFontWeight,
  isTracking,
  isLeading,
  isTextCase,
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

test("水平對齊只有 left / center / right 三種，清單外與非字串不算", () => {
  assert.deepEqual([...ALIGN_X_KEYS], ["left", "center", "right"]);
  for (const k of ALIGN_X_KEYS) assert.equal(isAlignX(k), true);
  assert.equal(isAlignX("inherit"), false);
  assert.equal(isAlignX("justify"), false);
  assert.equal(isAlignX("Left"), false);
  assert.equal(isAlignX(""), false);
  assert.equal(isAlignX(undefined), false);
  assert.equal(isAlignX(null), false);
});

test("Hero 文字三張三檔清單：粗細 / 字距 / 行距，清單外與非字串不算", () => {
  assert.deepEqual([...FONT_WEIGHT_KEYS], ["normal", "medium", "bold"]);
  assert.deepEqual([...TRACKING_KEYS], ["tight", "normal", "wide"]);
  assert.deepEqual([...LEADING_KEYS], ["tight", "normal", "relaxed"]);
  for (const k of FONT_WEIGHT_KEYS) assert.equal(isFontWeight(k), true);
  for (const k of TRACKING_KEYS) assert.equal(isTracking(k), true);
  for (const k of LEADING_KEYS) assert.equal(isLeading(k), true);
  // 按鈕粗細的 "default" 不在清單裡，是 heroCtaWeight 那格自己多的一檔
  assert.equal(isFontWeight("default"), false);
  assert.equal(isFontWeight("light"), false);
  // 字距的 wide 與行距的 relaxed 不能互通
  assert.equal(isTracking("relaxed"), false);
  assert.equal(isLeading("wide"), false);
  assert.equal(isTracking("Tight"), false);
  assert.equal(isLeading(""), false);
  assert.equal(isFontWeight(undefined), false);
  assert.equal(isTracking(null), false);
});

test("Hero 小標 / byline 大小寫三檔：upper / capitalize / none，按鈕那格的 default 不算", () => {
  assert.deepEqual([...TEXT_CASE_KEYS], ["upper", "capitalize", "none"]);
  for (const k of TEXT_CASE_KEYS) assert.equal(isTextCase(k), true);
  // heroCtaCase 的 "default"（照各版型原本）是那格自己的一檔，不在這張清單
  assert.equal(isTextCase("default"), false);
  assert.equal(isTextCase("uppercase"), false);
  assert.equal(isTextCase("lower"), false);
  assert.equal(isTextCase("Upper"), false);
  assert.equal(isTextCase(""), false);
  assert.equal(isTextCase(undefined), false);
  assert.equal(isTextCase(null), false);
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
