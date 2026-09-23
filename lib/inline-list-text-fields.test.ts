// lib/inline-list-text-fields.ts 清單卡片改字「畫面第幾張 → 原始第幾筆」的行為固定測試。
//
// 為什麼要有這份：編輯器收到雙擊改字、預覽 iframe 收到復原／重做，都靠這支把畫面上的
// data-edit-index 對回 theme 清單的原始位置。對錯一格的下場是「改 FAQ 第 2 條，字卻寫進
// 第 3 條」而且不報錯。這裡把 FAQ 跳過空列、越界回 -1、查表不吃原型鏈、首頁卡片沒存過
// 內容退回預設組寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INLINE_HOMEPAGE_CARD_TEXT_FIELDS,
  INLINE_LAYOUT_LIST_TEXT_FIELDS,
  faqItemValid,
  lookupInlineField,
  resolveHomepageCardBase,
  resolveListIndex,
} from "./inline-list-text-fields.ts";

describe("faqItemValid（跟公開頁 validFaqItems 同條件）", () => {
  it("問與答都有字才算一列", () => {
    assert.equal(faqItemValid({ question: "Q", answer: "A" }), true);
  });
  it("只有問、只有答、全空白都不算", () => {
    assert.equal(faqItemValid({ question: "Q", answer: "" }), false);
    assert.equal(faqItemValid({ question: "", answer: "A" }), false);
    assert.equal(faqItemValid({ question: "  ", answer: "　\n " }), false);
  });
  it("欄位缺少或不是字串時不炸", () => {
    assert.equal(faqItemValid({}), false);
    assert.equal(faqItemValid({ question: 1, answer: 2 }), true);
  });
});

describe("resolveListIndex", () => {
  const list = [{ a: 1 }, { a: 2 }, { a: 3 }];

  it("沒有 isValid 時畫面第 i 張就是原始第 i 筆", () => {
    assert.equal(resolveListIndex(list, 0), 0);
    assert.equal(resolveListIndex(list, 2), 2);
  });

  it("越界、負數、非整數一律回 -1", () => {
    assert.equal(resolveListIndex(list, 3), -1);
    assert.equal(resolveListIndex(list, -1), -1);
    assert.equal(resolveListIndex(list, 1.5), -1);
    assert.equal(resolveListIndex(list, Number.NaN), -1);
    assert.equal(resolveListIndex([], 0), -1);
  });

  it("FAQ 中間夾空列時，畫面第 1 條對回跳過空列後的原始位置", () => {
    const faq = [
      { question: "運費？", answer: "滿千免運" },
      { question: "只填了問", answer: "" },
      { question: "", answer: "" },
      { question: "可以自取嗎？", answer: "可以" },
      { question: "退換貨？", answer: "七天內" },
    ];
    assert.equal(resolveListIndex(faq, 0, faqItemValid), 0);
    assert.equal(resolveListIndex(faq, 1, faqItemValid), 3);
    assert.equal(resolveListIndex(faq, 2, faqItemValid), 4);
    assert.equal(resolveListIndex(faq, 3, faqItemValid), -1);
  });

  it("有 isValid 時越界、負數也回 -1", () => {
    const faq = [{ question: "Q", answer: "A" }];
    assert.equal(resolveListIndex(faq, -1, faqItemValid), -1);
    assert.equal(resolveListIndex(faq, 0.5, faqItemValid), -1);
  });
});

describe("lookupInlineField", () => {
  it("表裡有的名稱回對應設定", () => {
    assert.deepEqual(lookupInlineField(INLINE_LAYOUT_LIST_TEXT_FIELDS, "statLabel"), {
      list: "stats",
      key: "label",
    });
    assert.deepEqual(lookupInlineField(INLINE_HOMEPAGE_CARD_TEXT_FIELDS, "collectionCardTitle"), {
      list: "collectionItems",
      key: "title",
    });
  });

  it("不在表裡、或是物件原型上的名稱回 undefined", () => {
    assert.equal(lookupInlineField(INLINE_LAYOUT_LIST_TEXT_FIELDS, "heroTitle"), undefined);
    assert.equal(lookupInlineField(INLINE_LAYOUT_LIST_TEXT_FIELDS, "toString"), undefined);
    assert.equal(lookupInlineField(INLINE_LAYOUT_LIST_TEXT_FIELDS, "__proto__"), undefined);
  });

  it("FAQ 兩格帶 isValid，其他清單不帶", () => {
    for (const [field, spec] of Object.entries(INLINE_LAYOUT_LIST_TEXT_FIELDS)) {
      assert.equal(spec.isValid === faqItemValid, spec.list === "faqItems", field);
    }
  });
});

describe("resolveHomepageCardBase", () => {
  const defaults = [{ title: "預設一" }, { title: "預設二" }];

  it("存過內容就用存的那組", () => {
    const saved = [{ title: "自己的" }];
    assert.equal(resolveHomepageCardBase(saved, defaults), saved);
  });

  it("沒存過、存成空陣列、存成非陣列都退回預設組", () => {
    assert.equal(resolveHomepageCardBase(undefined, defaults), defaults);
    assert.equal(resolveHomepageCardBase(null, defaults), defaults);
    assert.equal(resolveHomepageCardBase([], defaults), defaults);
    assert.equal(resolveHomepageCardBase({ 0: { title: "x" } }, defaults), defaults);
  });
});
