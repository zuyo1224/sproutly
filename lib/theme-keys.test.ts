import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALIGN_X_KEYS,
  HERO_STYLE_KEYS,
  HERO_IMAGE_SIDES,
  SECTION_KEYS,
  DEFAULT_SECTION_ORDER,
  isAlignX,
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
