// lib/json-ld.ts 結構化資料安全內嵌的行為固定測試。
//
// 為什麼要有這份：Store／FAQPage／Product 的 JSON-LD 用 dangerouslySetInnerHTML 直接
// 寫進 <script>，內容是商家自由打的字。商家描述裡出現 </script> 會把標籤提早關掉，
// 後面全部裸露、還能注入 HTML。這支只做「把 < > & 與 U+2028／U+2029 換成 \uXXXX」，
// 少 escape 一個就是洞，多 escape 也不該改變 JSON 語意。這裡把兩邊都寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsonLdHtml } from "./json-ld.ts";

describe("jsonLdHtml", () => {
  it("平常的資料就是 JSON.stringify 的結果", () => {
    const data = { "@type": "Store", name: "植栽市集", price: 120, tags: ["a", "b"] };
    assert.equal(jsonLdHtml(data), JSON.stringify(data));
  });

  it("輸出裡絕對不會出現裸的 < > &", () => {
    const out = jsonLdHtml({
      description: "看這段 </script><img src=x onerror=alert(1)> 教學 & 範例",
    });
    assert.ok(!out.includes("<"));
    assert.ok(!out.includes(">"));
    assert.ok(!out.includes("&"));
    assert.ok(!out.includes("</script"));
  });

  it("三個 HTML 字元各換成對應的 \\uXXXX", () => {
    assert.equal(jsonLdHtml("<"), '"\\u003c"');
    assert.equal(jsonLdHtml(">"), '"\\u003e"');
    assert.equal(jsonLdHtml("&"), '"\\u0026"');
  });

  it("U+2028／U+2029 也換成 \\u 寫法，不留原字元", () => {
    const out = jsonLdHtml("a\u2028b\u2029c");
    assert.equal(out, '"a\\u2028b\\u2029c"');
    assert.ok(!out.includes("\u2028"));
    assert.ok(!out.includes("\u2029"));
  });

  it("escape 完 JSON.parse 回來跟原資料一模一樣（語意不變）", () => {
    const data = {
      name: "A & B <店>",
      faq: [{ q: "</script>?", a: "line\u2028break" }],
      n: 3,
      nested: { deep: ["x>y", "y<x"] },
    };
    assert.deepEqual(JSON.parse(jsonLdHtml(data)), data);
  });

  it("key 裡的危險字元一樣會被 escape", () => {
    const out = jsonLdHtml({ "<key>": 1 });
    assert.equal(out, '{"\\u003ckey\\u003e":1}');
  });

  it("已經是 \\u003c 文字的內容不會被二次處理壞掉：parse 回來仍是原文字", () => {
    const data = { s: "\\u003c" }; // 商家真的打了反斜線 u 0 0 3 c 六個字
    assert.deepEqual(JSON.parse(jsonLdHtml(data)), data);
  });

  it("字串、數字、陣列、null 這種頂層非物件也能處理", () => {
    assert.equal(jsonLdHtml("x"), '"x"');
    assert.equal(jsonLdHtml(1), "1");
    assert.equal(jsonLdHtml(null), "null");
    assert.equal(jsonLdHtml(["<"]), '["\\u003c"]');
  });
});
