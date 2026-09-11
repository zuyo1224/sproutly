// lib/ai-theme-patch.ts 的行為固定測試。
//
// 為什麼要有這份：這支是 AI 回的東西進前端前唯一一道關。以前沒這關，模型回錯型別
// （sectionOrder 給字串、heroStyle 給清單外的值、primary 給英文色名）會直接炸摘要
// 或把非法值存進 theme。這裡把「圍欄怎麼剝」「哪些欄位收、哪些值丟」「整包不是
// 物件回 null」「文案空字串收、顏色非法丟」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAiThemePatch,
  sanitizeThemePatch,
  stripJsonFence,
} from "./ai-theme-patch.ts";

describe("stripJsonFence", () => {
  it("沒圍欄原樣回（去前後空白）", () => {
    assert.equal(stripJsonFence('  {"a":1}\n'), '{"a":1}');
  });

  it("剝 ```json 圍欄", () => {
    assert.equal(stripJsonFence('```json\n{"a":1}\n```'), '{"a":1}');
  });

  it("剝沒標語言的 ``` 圍欄，大小寫不拘", () => {
    assert.equal(stripJsonFence('```\n{"a":1}\n```'), '{"a":1}');
    assert.equal(stripJsonFence('```JSON\n{"a":1}```'), '{"a":1}');
  });
});

describe("sanitizeThemePatch", () => {
  it("不是物件（null／陣列／字串／數字）回 null", () => {
    assert.equal(sanitizeThemePatch(null), null);
    assert.equal(sanitizeThemePatch([]), null);
    assert.equal(sanitizeThemePatch("{}"), null);
    assert.equal(sanitizeThemePatch(42), null);
  });

  it("全欄位合法就逐字保留", () => {
    const input = {
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
        collectionsIntro: "這季的選物",
        visitTitle: "來店裡坐坐",
      },
    };
    assert.deepEqual(sanitizeThemePatch(input), input);
  });

  it("認不得的欄位丟掉", () => {
    assert.deepEqual(
      sanitizeThemePatch({ primary: "#111111", foo: 1, layout: { bar: "x" } }),
      { primary: "#111111" },
    );
  });

  it("顏色不是六碼 hex 就丟掉；前後空白會去掉", () => {
    assert.deepEqual(
      sanitizeThemePatch({ primary: "red", accent: " #ABCDEF " }),
      { accent: "#ABCDEF" },
    );
  });

  it("文案欄位只收字串，空字串也收（商家可能要清掉）", () => {
    assert.deepEqual(
      sanitizeThemePatch({
        tagline: "",
        layout: { heroEyebrow: 123, heroSubtitle: "" },
        homepage: { promise: null, visitTitle: "" },
      }),
      { tagline: "", layout: { heroSubtitle: "" }, homepage: { visitTitle: "" } },
    );
  });

  it("heroStyle／heroImageSide 清單外的值丟掉", () => {
    assert.deepEqual(
      sanitizeThemePatch({
        layout: { heroStyle: "grid", heroImageSide: "top", heroEyebrow: "x" },
      }),
      { layout: { heroEyebrow: "x" } },
    );
  });

  it("sectionOrder 不是陣列丟掉；是陣列就只留認得的 key 且去重", () => {
    assert.deepEqual(
      sanitizeThemePatch({ layout: { sectionOrder: "hero,collections" } }),
      {},
    );
    assert.deepEqual(
      sanitizeThemePatch({
        layout: { sectionOrder: ["visit", "hero", "nope", 3, "hero", "faq"] },
      }),
      { layout: { sectionOrder: ["visit", "hero", "faq"] } },
    );
  });

  it("sectionOrder 過濾完是空的就不放", () => {
    assert.deepEqual(sanitizeThemePatch({ layout: { sectionOrder: ["nope"] } }), {});
  });

  it("layout／homepage 不是物件或過濾完沒東西就整個不放", () => {
    assert.deepEqual(
      sanitizeThemePatch({ layout: "split", homepage: { foo: 1 } }),
      {},
    );
  });
});

describe("parseAiThemePatch", () => {
  it("圍欄包住的合法 patch 過關", () => {
    assert.deepEqual(
      parseAiThemePatch('```json\n{"layout":{"heroStyle":"split"},"accent":"#5F6F52"}\n```'),
      { ok: true, patch: { layout: { heroStyle: "split" }, accent: "#5F6F52" } },
    );
  });

  it("不是合法 JSON 回 invalid-json 並附剝完圍欄的字串", () => {
    assert.deepEqual(parseAiThemePatch("```json\n把 hero 改成 split\n```"), {
      ok: false,
      reason: "invalid-json",
      cleaned: "把 hero 改成 split",
    });
  });

  it("合法 JSON 但不是物件回 not-object", () => {
    assert.deepEqual(parseAiThemePatch("[1,2]"), {
      ok: false,
      reason: "not-object",
      cleaned: "[1,2]",
    });
  });

  it("物件但一個欄位都不認得 → ok 且 patch 是空物件（前端顯「沒解析到欄位」）", () => {
    assert.deepEqual(parseAiThemePatch('{"foo":"bar"}'), { ok: true, patch: {} });
  });
});
