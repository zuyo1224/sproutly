// lib/color-contrast.ts 三個 export 的行為固定測試。
//
// 為什麼要有這份：這支是店面「主色壓在自訂底色上看不看得見」的唯一判斷來源——公開頁
// 每個區段換了底色後要不要把主色換成該段文字色（page.tsx 的 sectionAccent）、頁尾主色
// 壓在頁尾底色上要不要換（layout.tsx）、CTA 按鈕字色要走白還是黑（page.tsx 的
// CTA_TEXT_CONTRAST_MIN），全靠 contrastRatio 跟 relativeLuminance 算出來的數字對門檻。
// 算錯一點，看得見的段落被無故換色、或真的看不見的段落沒被救，商家從後台看不出原因。
// 這裡把 WCAG 2.x 相對亮度與對比值的幾個已知答案（黑白 21、#777 壓白 4.48 這種規格
// 文件常拿來當例子的值）、sRGB 轉線性的兩段公式分界、以及「色碼認不得就回 null、不猜
// 數字」的口徑寫死，之後有人動公式或改 normalizeHexColor 的放寬規則，跑 `npm test`
// 就知道動到哪條線。
//
// 用 Node 內建的 node:test + node:assert，跟其他 lib 測試同一套；import 帶 .ts 副檔名
// 是 lib 全檔慣例（Node 剝型別時不補副檔名）。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  contrastRatio,
  relativeLuminance,
  NON_TEXT_CONTRAST_MIN,
} from "./color-contrast.ts";

// 浮點結果不用 equal 硬比，允許很小的誤差；小數位數夠多，改錯公式一定抓得到。
function near(actual: number | null, expected: number, eps = 1e-6): void {
  assert.notEqual(actual, null, `期望 ${expected}，卻拿到 null`);
  assert.ok(
    Math.abs((actual as number) - expected) < eps,
    `期望 ${expected}，實際 ${actual}`,
  );
}

describe("relativeLuminance（WCAG 相對亮度，0 黑～1 白）", () => {
  it("純黑是 0、純白是 1", () => {
    near(relativeLuminance("#000000"), 0);
    near(relativeLuminance("#ffffff"), 1);
  });

  it("三原色各自是 WCAG 給的三個係數（0.2126／0.7152／0.0722）", () => {
    near(relativeLuminance("#ff0000"), 0.2126);
    near(relativeLuminance("#00ff00"), 0.7152);
    near(relativeLuminance("#0000ff"), 0.0722);
  });

  it("中灰 #808080 不是 0.5——sRGB 是非線性的，會落在 0.2159 附近", () => {
    near(relativeLuminance("#808080"), 0.21586050011389923);
  });

  it("很暗的通道值走線性那段公式（c/12.92），不走指數那段", () => {
    // 10/255 ≈ 0.0392 ≤ 0.04045，三通道都走 c/12.92；係數加總為 1，所以結果就是 0.0392/12.92。
    near(relativeLuminance("#0a0a0a"), 10 / 255 / 12.92);
  });

  it("大小寫與前後空白不影響結果（normalizeHexColor 會先 trim）", () => {
    near(relativeLuminance("#FF0000"), 0.2126);
    near(relativeLuminance("  #ff0000  "), 0.2126);
  });

  it("認不得的色碼一律回 null，不猜一個數字", () => {
    assert.equal(relativeLuminance("#abc"), null); // 三碼還不支援
    assert.equal(relativeLuminance("#ffffff80"), null); // 八碼含透明度還不支援
    assert.equal(relativeLuminance("ffffff"), null); // 沒帶 #
    assert.equal(relativeLuminance("#gggggg"), null);
    assert.equal(relativeLuminance(""), null);
    assert.equal(relativeLuminance(null), null);
    assert.equal(relativeLuminance(undefined), null);
    assert.equal(relativeLuminance(0xffffff), null); // 數字不算
    assert.equal(relativeLuminance({ hex: "#ffffff" }), null);
  });
});

describe("contrastRatio（對比值 1～21）", () => {
  it("黑白是 21、同色是 1", () => {
    near(contrastRatio("#000000", "#ffffff"), 21);
    near(contrastRatio("#1f7a5a", "#1f7a5a"), 1);
  });

  it("誰壓誰結果一樣（自動把亮的放分子）", () => {
    const a = contrastRatio("#1f7a5a", "#f7f3ec");
    const b = contrastRatio("#f7f3ec", "#1f7a5a");
    near(a, b as number);
    assert.ok((a as number) > 1);
  });

  it("規格文件常見的例子：#777 壓白 4.48 差一點不到 4.5，#767676 壓白 4.54 過", () => {
    near(contrastRatio("#777777", "#ffffff"), 4.478089453577214);
    near(contrastRatio("#767676", "#ffffff"), 4.542224959605253);
    assert.ok((contrastRatio("#777777", "#ffffff") as number) < 4.5);
    assert.ok((contrastRatio("#767676", "#ffffff") as number) >= 4.5);
  });

  it("任一邊色碼認不得就回 null，不拿另一邊硬算", () => {
    assert.equal(contrastRatio("#abc", "#ffffff"), null);
    assert.equal(contrastRatio("#ffffff", "#abc"), null);
    assert.equal(contrastRatio(null, "#ffffff"), null);
    assert.equal(contrastRatio("#ffffff", undefined), null);
    assert.equal(contrastRatio("", ""), null);
  });
});

describe("NON_TEXT_CONTRAST_MIN（非文字元素門檻，配合公開頁的換色判斷）", () => {
  it("門檻是 WCAG 1.4.11 的 3", () => {
    assert.equal(NON_TEXT_CONTRAST_MIN, 3);
  });

  it("主色壓在跟它相近的自訂底色上會低於門檻——這種段落要換色", () => {
    // 綠色主色壓在另一個綠色底上，對比只有 1.2 左右。
    const ratio = contrastRatio("#1f7a5a", "#2a8a66");
    near(ratio, 1.2346008471556749);
    assert.ok((ratio as number) < NON_TEXT_CONTRAST_MIN);
  });

  it("主色壓在全站奶油白底上遠高於門檻——這種段落一個像素都不動", () => {
    const ratio = contrastRatio("#1f7a5a", "#f7f3ec");
    near(ratio, 4.7588134395192005);
    assert.ok((ratio as number) >= NON_TEXT_CONTRAST_MIN);
  });

  it("剛好過門檻附近的灰對灰（3.21）算過，不會被四捨五入誤判", () => {
    const ratio = contrastRatio("#aaaaaa", "#555555");
    near(ratio, 3.209118776209831);
    assert.ok((ratio as number) >= NON_TEXT_CONTRAST_MIN);
  });
});
