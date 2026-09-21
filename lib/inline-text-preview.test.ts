// lib/inline-text-preview.ts 的行為固定測試。
//
// 為什麼要有這份：復原時預覽套字的規則要跟公開頁 render 一致（哪格拆行、沒填顯示什麼），
// 這裡把「讀哪裡」「fallback」「拆行方式」「不是文字格就跳過」四件事寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveInlineListTextPreview, resolveInlineTextPreview } from "./inline-text-preview.ts";

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

const CARD_DEFAULTS = {
  journalCards: [
    { eyebrow: "Care", title: "預設一", excerpt: "預設摘要一" },
    { eyebrow: "Space", title: "預設二", excerpt: "預設摘要二" },
  ],
  collectionItems: [
    { key: "desk", title: "書桌", subtitle: "預設副標" },
    { key: "window", title: "窗邊", subtitle: "" },
  ],
};

describe("resolveInlineListTextPreview", () => {
  it("好評／數字／相簿：畫面第 i 張就是原始第 i 筆，沒填的 key 套成空字串，超出清單回 null", () => {
    const theme = {
      layout: {
        testimonials: [{ quote: "甲", author: "A" }, { quote: "乙", author: "B", role: "老客人" }],
        stats: [{ value: "120", label: "株" }],
        gallery: [{ url: "https://x/1.jpg", caption: "一" }, { url: "https://x/2.jpg" }],
      },
    };
    assert.deepEqual(resolveInlineListTextPreview(theme, "testimonialQuote", 1, CARD_DEFAULTS), { kind: "text", value: "乙" });
    assert.deepEqual(resolveInlineListTextPreview(theme, "testimonialRole", 0, CARD_DEFAULTS), { kind: "text", value: "" });
    assert.deepEqual(resolveInlineListTextPreview(theme, "statLabel", 0, CARD_DEFAULTS), { kind: "text", value: "株" });
    assert.deepEqual(resolveInlineListTextPreview(theme, "galleryCaption", 1, CARD_DEFAULTS), { kind: "text", value: "" });
    assert.equal(resolveInlineListTextPreview(theme, "statValue", 1, CARD_DEFAULTS), null);
    assert.equal(resolveInlineListTextPreview(theme, "statValue", -1, CARD_DEFAULTS), null);
  });

  it("FAQ：畫面第 i 條跳過空問空答對回原始第幾筆；答案按換行切段（不去空白不丟空段）", () => {
    const theme = {
      layout: {
        faqItems: [
          { question: "", answer: "沒問題的答" },
          { question: "怎麼澆水", answer: "少量多次。\n\n看土乾了再澆。" },
          { question: "空答", answer: "  " },
          { question: "運費", answer: "滿千免運" },
        ],
      },
    };
    assert.deepEqual(resolveInlineListTextPreview(theme, "faqQuestion", 0, CARD_DEFAULTS), { kind: "text", value: "怎麼澆水" });
    assert.deepEqual(resolveInlineListTextPreview(theme, "faqAnswer", 0, CARD_DEFAULTS), {
      kind: "paragraphs",
      paragraphs: ["少量多次。", "看土乾了再澆。"],
    });
    assert.deepEqual(resolveInlineListTextPreview(theme, "faqQuestion", 1, CARD_DEFAULTS), { kind: "text", value: "運費" });
    assert.equal(resolveInlineListTextPreview(theme, "faqQuestion", 2, CARD_DEFAULTS), null);
  });

  it("慢讀卡／選物卡：沒存過內容用預設整組對 index，存過就用存的", () => {
    assert.deepEqual(resolveInlineListTextPreview({ homepage: { journalCards: [] } }, "journalCardTitle", 1, CARD_DEFAULTS), {
      kind: "text",
      value: "預設二",
    });
    assert.deepEqual(resolveInlineListTextPreview({ homepage: {} }, "collectionCardSubtitle", 0, CARD_DEFAULTS), {
      kind: "text",
      value: "預設副標",
    });
    const saved = { homepage: { journalCards: [{ eyebrow: "Story", title: "自己寫的", excerpt: "" }] } };
    assert.deepEqual(resolveInlineListTextPreview(saved, "journalCardTitle", 0, CARD_DEFAULTS), { kind: "text", value: "自己寫的" });
    assert.equal(resolveInlineListTextPreview(saved, "journalCardTitle", 1, CARD_DEFAULTS), null);
  });

  it("不是清單卡片欄位、清單不是陣列、theme 不是物件都回 null", () => {
    assert.equal(resolveInlineListTextPreview({ layout: { testimonials: [] } }, "featuredTitle", 0, CARD_DEFAULTS), null);
    assert.equal(resolveInlineListTextPreview({ layout: { testimonials: "x" } }, "testimonialQuote", 0, CARD_DEFAULTS), null);
    assert.equal(resolveInlineListTextPreview({ layout: { stats: [null] } }, "statValue", 0, CARD_DEFAULTS), null);
    assert.equal(resolveInlineListTextPreview(null, "statValue", 0, CARD_DEFAULTS), null);
  });
});
