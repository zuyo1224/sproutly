// lib/page-section-toggles.ts 的固定測試。
//
// 為什麼要有這份：設定頁 checkbox、存檔端、公開頁讀回三處都改吃這張表，「預設開的格沒存就開、
// 預設關的格存了 true 才開」跟「表單只認 on」這兩條寫死在這裡，表哪格改預設這裡先知道。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PAGE_SECTION_TOGGLES,
  readPageSectionToggles,
  resolvePageSectionToggles,
} from "./page-section-toggles.ts";

describe("PAGE_SECTION_TOGGLES", () => {
  it("五格、key 與表單欄位名各不重複、欄位名照 section_<key> 命名", () => {
    assert.equal(PAGE_SECTION_TOGGLES.length, 5);
    assert.equal(new Set(PAGE_SECTION_TOGGLES.map((t) => t.key)).size, 5);
    assert.equal(new Set(PAGE_SECTION_TOGGLES.map((t) => t.formName)).size, 5);
    for (const t of PAGE_SECTION_TOGGLES) assert.equal(t.formName, `section_${t.key}`);
    // 只有頁尾社群連結預設關（跟改表前 _theme.ts 的 `=== true` 一致）
    assert.deepEqual(
      PAGE_SECTION_TOGGLES.filter((t) => !t.defaultOn).map((t) => t.key),
      ["social"],
    );
  });
});

describe("readPageSectionToggles", () => {
  it("只認 on；沒帶、空字串、其他字都是 false", () => {
    const fd = new FormData();
    fd.set("section_about", "on");
    fd.set("section_contact", "");
    fd.set("section_hours", "true");
    fd.set("section_social", "on");
    assert.deepEqual(readPageSectionToggles(fd), {
      about: true,
      contact: false,
      hours: false,
      faq: false,
      social: true,
    });
  });
});

describe("resolvePageSectionToggles", () => {
  it("空物件走預設：四格開、社群關", () => {
    assert.deepEqual(resolvePageSectionToggles({}), {
      about: true,
      contact: true,
      hours: true,
      faq: true,
      social: false,
    });
  });

  it("預設開的格只有存 false 才關；預設關的格只有存 true 才開（其他型別當沒填）", () => {
    const r = resolvePageSectionToggles({
      about: false,
      contact: "false",
      hours: 0,
      faq: null,
      social: "true",
    });
    assert.deepEqual(r, { about: false, contact: true, hours: true, faq: true, social: false });
    assert.equal(resolvePageSectionToggles({ social: true }).social, true);
    assert.equal(resolvePageSectionToggles({ social: 1 }).social, false);
  });
});
