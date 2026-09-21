// lib/inline-text-preview.ts 的行為固定測試。
//
// 為什麼要有這份：復原時預覽套字的規則要跟公開頁 render 一致（哪格拆行、沒填顯示什麼），
// 這裡把「讀哪裡」「fallback」「拆行方式」「不是文字格就跳過」四件事寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveInlineTextPreview } from "./inline-text-preview.ts";

const DEFAULTS = {
  collectionsIntro: "告訴我們你的空間，我們幫你選對的那一株。",
  promise: "第一行。\n第二行。",
  featuredTitle: "本月選物",
  featuredEyebrow: null,
};

describe("resolveInlineTextPreview", () => {
  it("tagline 讀 theme.tagline、按全形標點拆行；不是字串就跳過", () => {
    assert.deepEqual(resolveInlineTextPreview({ tagline: "為你的角落，添一株綠。" }, "tagline", DEFAULTS), {
      kind: "lines",
      lines: ["為你的角落，", "添一株綠。"],
    });
    assert.equal(resolveInlineTextPreview({ tagline: null }, "tagline", DEFAULTS), null);
    assert.equal(resolveInlineTextPreview({}, "tagline", DEFAULTS), null);
  });

  it("heroEyebrow／heroSubtitle 讀 theme.layout，沒填套成空字串", () => {
    const theme = { layout: { heroEyebrow: "Plants", heroSubtitle: null } };
    assert.deepEqual(resolveInlineTextPreview(theme, "heroEyebrow", DEFAULTS), { kind: "text", value: "Plants" });
    assert.deepEqual(resolveInlineTextPreview(theme, "heroSubtitle", DEFAULTS), { kind: "text", value: "" });
    assert.deepEqual(resolveInlineTextPreview({}, "heroEyebrow", DEFAULTS), { kind: "text", value: "" });
  });

  it("homepage 字串欄位：有填用填的，空字串／null 退回預設，預設也是 null 就空字串", () => {
    const theme = { homepage: { featuredTitle: "", featuredEyebrow: null, collectionsIntro: "自己寫的。" } };
    assert.deepEqual(resolveInlineTextPreview(theme, "featuredTitle", DEFAULTS), { kind: "text", value: "本月選物" });
    assert.deepEqual(resolveInlineTextPreview(theme, "featuredEyebrow", DEFAULTS), { kind: "text", value: "" });
    assert.deepEqual(resolveInlineTextPreview({ homepage: { featuredTitle: "精選" } }, "featuredTitle", DEFAULTS), {
      kind: "text",
      value: "精選",
    });
  });

  it("collectionsIntro 按全形標點拆行、promise 按換行拆行（去空白丟空行）", () => {
    assert.deepEqual(resolveInlineTextPreview({ homepage: { collectionsIntro: "自己寫的，兩行。" } }, "collectionsIntro", DEFAULTS), {
      kind: "lines",
      lines: ["自己寫的，", "兩行。"],
    });
    assert.deepEqual(resolveInlineTextPreview({ homepage: { promise: " 甲 \r\n\n 乙 " } }, "promise", DEFAULTS), {
      kind: "lines",
      lines: ["甲", "乙"],
    });
    assert.deepEqual(resolveInlineTextPreview({ homepage: { promise: "" } }, "promise", DEFAULTS), {
      kind: "lines",
      lines: ["第一行。", "第二行。"],
    });
  });

  it("不在 homepage 底下的名稱（清單卡片欄位）、非字串的格子、theme 不是物件都跳過", () => {
    assert.equal(resolveInlineTextPreview({ homepage: { testimonials: [] } }, "testimonialQuote", DEFAULTS), null);
    assert.equal(resolveInlineTextPreview({ homepage: { enableAnimation: true } }, "enableAnimation", DEFAULTS), null);
    assert.equal(resolveInlineTextPreview({ homepage: { journalCards: [] } }, "journalCards", DEFAULTS), null);
    assert.equal(resolveInlineTextPreview(null, "featuredTitle", DEFAULTS), null);
    assert.equal(resolveInlineTextPreview({ homepage: [] }, "featuredTitle", DEFAULTS), null);
  });
});
