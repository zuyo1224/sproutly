// lib/section-style-schema.ts 三支函式的行為固定測試。
//
// 為什麼要有這份：這支是每個區段「元素級樣式覆寫」讀寫兩層共用的唯一清洗口徑——公開頁
// _theme 讀回 DB 的 sectionStyles、編輯器 actions 存檔前、編輯器每一步 patch 疊到 undo
// history，全走這裡。壞法跟 hex-color 一樣安靜：sanitize 多丟一欄，商家設好的值存得進去
// 卻讀不回來（畫面沒反應）；少丟一欄，殘留的垃圾值直接進 DB；patch 把「等同沒設定」的值
// 當真值留下，「有沒有自訂」這件事就看不準（editor 那顆重設鈕、公開頁「沒讀到就不套」都
// 靠 key 在不在判斷）。另外 SECTION_STYLE_NEUTRAL_VALUES 是手寫表，跟 SECTION_STYLE_ENUMS
// 沒有型別上的綁定；有人在 enum 改名一個值忘了改這張表，那一欄的重設就永遠清不掉——這裡
// 用一條測試把兩張表對起來。
//
// 用 Node 內建的 node:test + node:assert，跟其他 lib 測試同一套；import 帶 .ts 副檔名
// 是 lib 全檔慣例（Node 剝型別時不補副檔名）。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SECTION_STYLE_ENUMS,
  SECTION_STYLE_NEUTRAL_VALUES,
  SECTION_STYLE_COLOR_FIELDS,
  applySectionStylePatch,
  sanitizeSectionStyle,
  sanitizeSectionStyles,
  type SectionStyle,
} from "./section-style-schema.ts";

describe("SECTION_STYLE_NEUTRAL_VALUES 與 SECTION_STYLE_ENUMS 對得起來", () => {
  it("每一個中性值都存在於對應欄位的合法值裡", () => {
    for (const [field, neutral] of Object.entries(SECTION_STYLE_NEUTRAL_VALUES)) {
      const allowed = (SECTION_STYLE_ENUMS as Record<string, readonly string[]>)[field];
      assert.ok(allowed, `中性值表列了 enum 沒有的欄位：${field}`);
      assert.ok(
        allowed.includes(neutral),
        `${field} 的中性值 "${neutral}" 不在合法值 [${allowed.join(", ")}] 裡`
      );
    }
  });

  it("顏色欄位不在 enum 表、也不在中性值表（兩套規則分開走）", () => {
    for (const field of SECTION_STYLE_COLOR_FIELDS) {
      assert.equal(field in SECTION_STYLE_ENUMS, false);
      assert.equal(field in SECTION_STYLE_NEUTRAL_VALUES, false);
    }
  });
});

describe("sanitizeSectionStyle", () => {
  it("不是物件的一律回 null（null、陣列、字串、數字、undefined）", () => {
    assert.equal(sanitizeSectionStyle(null), null);
    assert.equal(sanitizeSectionStyle(undefined), null);
    assert.equal(sanitizeSectionStyle([]), null);
    assert.equal(sanitizeSectionStyle("center"), null);
    assert.equal(sanitizeSectionStyle(42), null);
  });

  it("空物件或一欄都不合法的物件回 null，呼叫端不留這個 key", () => {
    assert.equal(sanitizeSectionStyle({}), null);
    assert.equal(sanitizeSectionStyle({ headingAlign: "middle", foo: "bar" }), null);
  });

  it("合法的選項值原樣留下，不在合法值內的那一欄丟掉但其他欄保留", () => {
    const out = sanitizeSectionStyle({
      headingAlign: "center",
      paddingScale: "gigantic",
      hideOn: "mobile",
    });
    assert.deepEqual(out, { headingAlign: "center", hideOn: "mobile" });
  });

  it("值型別不是字串的欄位丟掉，即使字串化後看起來合法", () => {
    const out = sanitizeSectionStyle({
      headingAlign: ["center"],
      hideOn: { toString: () => "mobile" },
      divider: "top",
    });
    assert.deepEqual(out, { divider: "top" });
  });

  it("認不得的欄位一律丟掉，不會原樣帶進 DB", () => {
    const out = sanitizeSectionStyle({ divider: "both", __proto__polluted: "x", zIndex: "9" });
    assert.deepEqual(out, { divider: "both" });
    assert.equal("zIndex" in (out as object), false);
  });

  it("顏色欄位：合法 hex 清過後留下，前後空白會去掉", () => {
    const out = sanitizeSectionStyle({ bgColor: "  #1f6f3f ", textColor: "#FFFFFF" });
    assert.deepEqual(out, { bgColor: "#1f6f3f", textColor: "#FFFFFF" });
  });

  it("顏色欄位：明確給 null 要留著（那是「清掉覆寫回 theme 預設」的有效狀態）", () => {
    const out = sanitizeSectionStyle({ bgColor: null });
    assert.deepEqual(out, { bgColor: null });
  });

  it("顏色欄位：不合法的字串當沒設定丟掉，不會變成 null", () => {
    assert.equal(sanitizeSectionStyle({ bgColor: "red" }), null);
    assert.equal(sanitizeSectionStyle({ textColor: "#abc" }), null);
    const out = sanitizeSectionStyle({ bgColor: "rgb(0,0,0)", mediaFrameColor: "#123456" });
    assert.deepEqual(out, { mediaFrameColor: "#123456" });
  });

  it("每一個 enum 欄位的每一個合法值都過得了 sanitize", () => {
    for (const [field, allowed] of Object.entries(SECTION_STYLE_ENUMS)) {
      for (const value of allowed) {
        const out = sanitizeSectionStyle({ [field]: value });
        assert.deepEqual(out, { [field]: value }, `${field}=${value} 被 sanitize 丟掉了`);
      }
    }
  });
});

describe("sanitizeSectionStyles", () => {
  it("不是物件的一律回空物件，不會丟例外", () => {
    assert.deepEqual(sanitizeSectionStyles(null), {});
    assert.deepEqual(sanitizeSectionStyles(undefined), {});
    assert.deepEqual(sanitizeSectionStyles([{ headingAlign: "center" }]), {});
    assert.deepEqual(sanitizeSectionStyles("hero"), {});
  });

  it("每個 section 各自清洗，整筆不合法的 key 不留", () => {
    const out = sanitizeSectionStyles({
      hero: { headingAlign: "center", paddingScale: "nope" },
      featured: { headingAlign: "diagonal" },
      visit: null,
      faq: { bgColor: null },
    });
    assert.deepEqual(out, {
      hero: { headingAlign: "center" },
      faq: { bgColor: null },
    });
  });

  it("空字串 key 與超過 60 字的 key 跳過，剛好 60 字的留下", () => {
    const sixty = "s".repeat(60);
    const sixtyOne = "s".repeat(61);
    const out = sanitizeSectionStyles({
      "": { headingAlign: "left" },
      [sixty]: { headingAlign: "left" },
      [sixtyOne]: { headingAlign: "left" },
    });
    assert.deepEqual(Object.keys(out), [sixty]);
  });
});

describe("applySectionStylePatch", () => {
  it("回一份新物件，原本那份不動（undo history 靠每步一份新值）", () => {
    const current: SectionStyle = { headingAlign: "left" };
    const next = applySectionStylePatch(current, { headingAlign: "center" });
    assert.notEqual(next, current);
    assert.deepEqual(current, { headingAlign: "left" });
    assert.deepEqual(next, { headingAlign: "center" });
  });

  it("patch 沒提到的欄位（undefined）不動", () => {
    const next = applySectionStylePatch(
      { headingAlign: "right", divider: "top", bgColor: "#000000" },
      { hideOn: "mobile" }
    );
    assert.deepEqual(next, {
      headingAlign: "right",
      divider: "top",
      bgColor: "#000000",
      hideOn: "mobile",
    });
  });

  it("選項欄位給 null 就把整欄刪掉，不是存成 null", () => {
    const next = applySectionStylePatch({ headingAlign: "center" }, { headingAlign: null });
    assert.deepEqual(next, {});
    assert.equal("headingAlign" in next, false);
  });

  it("選到「等同沒設定」的中性值跟給 null 一樣刪掉整欄", () => {
    const next = applySectionStylePatch(
      { hideOn: "mobile", divider: "both", bodyAlign: "center" },
      { hideOn: "none", divider: "none", bodyAlign: "auto" }
    );
    assert.deepEqual(next, {});
  });

  it("沒有中性值的欄位（headingAlign / paddingScale / headingScale / minHeight）每個值都留", () => {
    for (const field of ["headingAlign", "paddingScale", "headingScale", "minHeight"] as const) {
      assert.equal(field in SECTION_STYLE_NEUTRAL_VALUES, false, `${field} 不該有中性值`);
      for (const value of SECTION_STYLE_ENUMS[field]) {
        const next = applySectionStylePatch({}, { [field]: value });
        assert.deepEqual(next, { [field]: value });
      }
    }
  });

  it("顏色欄位給 null 要存成 null（清掉覆寫），不是刪掉整欄", () => {
    const next = applySectionStylePatch({ bgColor: "#1f6f3f" }, { bgColor: null });
    assert.deepEqual(next, { bgColor: null });
    assert.equal("bgColor" in next, true);
  });

  it("顏色欄位給 hex 就覆寫，沒提到的顏色欄位不動", () => {
    const next = applySectionStylePatch(
      { bgColor: "#000000", textColor: "#ffffff" },
      { textColor: "#1f6f3f" }
    );
    assert.deepEqual(next, { bgColor: "#000000", textColor: "#1f6f3f" });
  });

  it("疊完再 sanitize 一次結果不變（存檔那層跟編輯器那層認定一致）", () => {
    const next = applySectionStylePatch(
      {},
      { headingAlign: "center", hideOn: "desktop", bgColor: "#1f6f3f", textColor: null }
    );
    assert.deepEqual(sanitizeSectionStyle(next), next);
  });
});
