// 公開頁 data-edit-field 全集 ＝ 三張表 ＋ 三格 的對帳測試。
//
// 為什麼要有這份：公開頁每格可雙擊改字的文字都掛 data-edit-field，編輯器收訊靠三張表
// （首頁 36 格、layout 清單 8 格、首頁卡片 5 格）＋ tagline／heroEyebrow／heroSubtitle 三格
// 查名稱決定改進 theme 哪裡；公開頁多掛一格沒補表，雙擊時只會默默沒反應，表多一格公開頁
// 沒掛則是死名單。以前這件事靠人工 grep 比對，這裡改成跑測試就對一次。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INLINE_HOMEPAGE_TEXT_FIELDS,
  INLINE_TOP_LEVEL_TEXT_FIELDS,
  isInlineHomepageTextField,
} from "./inline-homepage-text-fields.ts";
import { INLINE_HOMEPAGE_CARD_TEXT_FIELDS, INLINE_LAYOUT_LIST_TEXT_FIELDS } from "./inline-list-text-fields.ts";

// 公開頁：app/[slug] 底下所有 .tsx（首頁、layout、shop／about／contact 子頁）
function listTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listTsx(p));
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function publicPageEditFields(): Set<string> {
  const root = fileURLToPath(new URL("../app/[slug]/", import.meta.url));
  const found = new Set<string>();
  for (const file of listTsx(root)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/data-edit-field=(["{])([^"}]*)["}]/g)) {
      // 只認字面值；寫成 data-edit-field={變數} 的話這裡對不了帳，直接讓測試失敗提醒
      assert.equal(m[1], '"', `${file}: data-edit-field 要寫字面值，對帳才對得到：${m[0]}`);
      found.add(m[2]);
    }
  }
  return found;
}

describe("inline text fields 對帳", () => {
  const tables = new Set<string>([
    ...INLINE_HOMEPAGE_TEXT_FIELDS,
    ...INLINE_TOP_LEVEL_TEXT_FIELDS,
    ...Object.keys(INLINE_LAYOUT_LIST_TEXT_FIELDS),
    ...Object.keys(INLINE_HOMEPAGE_CARD_TEXT_FIELDS),
  ]);

  it("三張表與三格之間沒有重複名稱", () => {
    const total =
      INLINE_HOMEPAGE_TEXT_FIELDS.length +
      INLINE_TOP_LEVEL_TEXT_FIELDS.length +
      Object.keys(INLINE_LAYOUT_LIST_TEXT_FIELDS).length +
      Object.keys(INLINE_HOMEPAGE_CARD_TEXT_FIELDS).length;
    assert.equal(tables.size, total);
  });

  it("公開頁掛的 data-edit-field 每一格都查得到表；表裡每一格公開頁都有掛", () => {
    const page = publicPageEditFields();
    const missingInTables = [...page].filter((f) => !tables.has(f)).sort();
    const missingInPage = [...tables].filter((f) => !page.has(f)).sort();
    assert.deepEqual(missingInTables, [], "公開頁有掛、表沒收：雙擊會沒反應");
    assert.deepEqual(missingInPage, [], "表有收、公開頁沒掛：死名單");
  });

  it("isInlineHomepageTextField 只認 36 格首頁字串欄位", () => {
    assert.equal(INLINE_HOMEPAGE_TEXT_FIELDS.length, 36);
    assert.equal(isInlineHomepageTextField("featuredTitle"), true);
    assert.equal(isInlineHomepageTextField("tagline"), false);
    assert.equal(isInlineHomepageTextField("testimonialQuote"), false);
    assert.equal(isInlineHomepageTextField("journalCardTitle"), false);
    assert.equal(isInlineHomepageTextField(""), false);
  });
});
