// lib/theme-patch-summary.ts summarizeThemePatch 的行為固定測試。
//
// 為什麼要有這份：這支是商家按「套用」前唯一看得到的「AI 到底要改什麼」。列漏一個
// 欄位（編輯器那份以前就漏了 heroImageSide）商家會在「沒解析到欄位」的摘要旁按下
// 套用、然後畫面真的變了；把空字串當沒改則商家「幫我把副標清掉」會看到沒解析到。
// 這裡把「每個欄位都會列」「文案空字串也算變動」「顏色空字串不算」「兩套標籤只差
// 字面、列的欄位一模一樣」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COMPACT_PATCH_LABELS,
  FULL_PATCH_LABELS,
  NO_PATCH_TEXT,
  summarizeThemePatch,
  type ThemePatch,
} from "./theme-patch-summary.ts";

const FULL_PATCH: ThemePatch = {
  primary: "#2C2C2C",
  accent: "#1F5F3F",
  tagline: "慢一點，也沒關係",
  layout: {
    heroStyle: "split",
    heroEyebrow: "植物選物",
    heroSubtitle: "每一盆都親手照顧過",
    heroImageSide: "left",
    sectionOrder: ["hero", "collections", "visit"],
  },
  homepage: {
    promise: "我們只賣自己也會養的植物",
    collectionsIntro: "這一季的選物",
    visitTitle: "來店裡坐坐",
  },
};

describe("summarizeThemePatch", () => {
  it("沒有 patch 或不是物件回「（無變動）」", () => {
    assert.equal(summarizeThemePatch(undefined, FULL_PATCH_LABELS, 60), NO_PATCH_TEXT);
    assert.equal(
      summarizeThemePatch("split" as unknown as ThemePatch, FULL_PATCH_LABELS, 60),
      NO_PATCH_TEXT,
    );
  });

  it("空物件回該套標籤的 empty 那句", () => {
    assert.equal(summarizeThemePatch({}, FULL_PATCH_LABELS, 60), "（沒解析到要改的欄位）");
    assert.equal(summarizeThemePatch({}, COMPACT_PATCH_LABELS, 50), "（沒解析到欄位）");
  });

  it("全欄位 patch 用設定頁標籤逐行列出、順序固定", () => {
    assert.equal(
      summarizeThemePatch(FULL_PATCH, FULL_PATCH_LABELS, 60),
      [
        "主色 → #2C2C2C",
        "Accent → #1F5F3F",
        "Tagline → 慢一點，也沒關係",
        "Hero 樣式 → split",
        "Hero Eyebrow → 植物選物",
        "Hero 副標 → 每一盆都親手照顧過",
        "Hero 圖位置 → left",
        "Section 順序 → hero,collections,visit",
        "Promise → 我們只賣自己也會養的植物",
        "選物 intro → 這一季的選物",
        "Visit 標題 → 來店裡坐坐",
      ].join("\n"),
    );
  });

  it("兩套標籤列的欄位數與順序一模一樣，只差字面", () => {
    const full = summarizeThemePatch(FULL_PATCH, FULL_PATCH_LABELS, 60).split("\n");
    const compact = summarizeThemePatch(FULL_PATCH, COMPACT_PATCH_LABELS, 50).split("\n");
    assert.equal(full.length, 11);
    assert.equal(compact.length, 11);
    // 箭頭右邊的值逐行相同
    assert.deepEqual(
      full.map((l) => l.split(" → ")[1]),
      compact.map((l) => l.split(" → ")[1]),
    );
  });

  it("只改 heroImageSide 也會列出來，不會變成「沒解析到」", () => {
    const patch: ThemePatch = { layout: { heroImageSide: "right" } };
    assert.equal(summarizeThemePatch(patch, FULL_PATCH_LABELS, 60), "Hero 圖位置 → right");
    assert.equal(summarizeThemePatch(patch, COMPACT_PATCH_LABELS, 50), "圖位置 → right");
  });

  it("文案欄位給空字串算變動（商家要清掉），顏色與樣式給空字串不算", () => {
    assert.equal(
      summarizeThemePatch(
        { tagline: "", layout: { heroSubtitle: "" }, homepage: { promise: "" } },
        FULL_PATCH_LABELS,
        60,
      ),
      "Tagline → \nHero 副標 → \nPromise → ",
    );
    assert.equal(
      summarizeThemePatch(
        { primary: "", accent: "", layout: { heroStyle: "", heroImageSide: "", sectionOrder: [] } },
        FULL_PATCH_LABELS,
        60,
      ),
      "（沒解析到要改的欄位）",
    );
  });

  it("文案照 maxLen 截短補 …，顏色與 sectionOrder 不截", () => {
    const patch: ThemePatch = {
      primary: "#2C2C2C",
      tagline: "一二三四五六七八",
      layout: { sectionOrder: ["hero", "collections", "featured", "journal"] },
    };
    assert.equal(
      summarizeThemePatch(patch, COMPACT_PATCH_LABELS, 5),
      "主色 → #2C2C2C\nTagline → 一二三四五…\n順序 → hero,collections,featured,journal",
    );
  });
});
