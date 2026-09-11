import { test } from "node:test";
import assert from "node:assert/strict";
import { tsUnionLiteral } from "./ts-union-literal.ts";
import { HERO_STYLE_KEYS, DEFAULT_SECTION_ORDER } from "./theme-keys.ts";

test("多個值用 | 串起、每個值加雙引號", () => {
  assert.equal(tsUnionLiteral(["a", "b", "c"]), '"a" | "b" | "c"');
});

test("單一值沒有 |", () => {
  assert.equal(tsUnionLiteral(["only"]), '"only"');
});

test("空清單回空字串", () => {
  assert.equal(tsUnionLiteral([]), "");
});

test("值裡有雙引號會被跳脫，不會把型別字面值拆壞", () => {
  assert.equal(tsUnionLiteral(['say "hi"']), '"say \\"hi\\""');
});

// AI 助手提示以前手打的兩行，改成生成後字面要一模一樣（模型看到的內容不變）
test("Hero 四種版型生成結果跟以前手打的提示逐字相同", () => {
  assert.equal(
    tsUnionLiteral(HERO_STYLE_KEYS),
    '"full-image" | "split" | "minimal" | "magazine"'
  );
});

test("sectionOrder 預設 6 個生成結果跟以前手打的提示逐字相同", () => {
  assert.equal(
    tsUnionLiteral(DEFAULT_SECTION_ORDER),
    '"hero" | "collections" | "featured" | "journal" | "promise" | "visit"'
  );
});
