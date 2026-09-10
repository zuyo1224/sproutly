// lib/redirect-url.ts 的行為固定測試：buildRedirectUrl（組跳轉網址）、
// withErrorParam（把錯誤訊息掛上去）。
//
// 為什麼要有這份：這兩支是「出錯跳回去，把中文訊息顯在紅色橫幅」那條路唯一的組網址
// 來源，改壞了不會噴錯，只會在某個表單出錯的那一刻才看得出來——訊息整句不見、跳到
// 半截網址、或最糟的：客人送出的欄位值裡帶一個 `&`，自己在店家的結帳頁上多長出一個
// error 參數，把假訊息（「請改匯款到…」）顯成像店家講的話。原本各處字串接的寫法就是
// 這樣漏的（見 redirect-url.ts 開頭），所以把每條邊界寫死在這裡。
// 跟其他 lib 測試同一套：node:test + node:assert，import 一律帶 .ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRedirectUrl, withErrorParam } from "./redirect-url.ts";

describe("buildRedirectUrl", () => {
  it("沒有參數就只回路徑，不留一個孤單的問號", () => {
    assert.equal(buildRedirectUrl("/plantae/checkout", {}), "/plantae/checkout");
  });

  it("一般情況：照給的順序組成查詢字串", () => {
    assert.equal(
      buildRedirectUrl("/plantae/checkout", { product_id: "abc", qty: "2" }),
      "/plantae/checkout?product_id=abc&qty=2",
    );
  });

  it("數字值轉成字串", () => {
    assert.equal(buildRedirectUrl("/x", { qty: 3 }), "/x?qty=3");
  });

  it("null / undefined 的參數整個不帶", () => {
    assert.equal(
      buildRedirectUrl("/x", { a: "1", b: null, c: undefined }),
      "/x?a=1",
    );
  });

  it("空字串是有意義的值，照樣帶上去", () => {
    assert.equal(buildRedirectUrl("/x", { q: "" }), "/x?q=");
  });

  it("值裡的 & 被編碼，長不出第二個參數（客人送 product_id 夾帶假訊息那條路）", () => {
    const url = buildRedirectUrl("/plantae/checkout", {
      product_id: "abc&error=請改匯款到別的帳戶",
      qty: "1",
    });
    assert.ok(!url.includes("&error="), url);
    // 讀回來仍是原字串一個字不差，只是它整串都待在 product_id 裡
    const sp = new URLSearchParams(url.split("?")[1]);
    assert.equal(sp.get("product_id"), "abc&error=請改匯款到別的帳戶");
    assert.equal(sp.get("error"), null);
  });

  it("值裡的 # 被編碼，後面那段不會被當成錨點丟掉", () => {
    const url = buildRedirectUrl("/x", { q: "5#號盆" });
    assert.ok(!url.includes("#"), url);
    assert.equal(new URLSearchParams(url.split("?")[1]).get("q"), "5#號盆");
  });

  it("中文與空白編碼後讀回來一個字不差", () => {
    const url = buildRedirectUrl("/x", { q: "龜背芋 大盆" });
    assert.equal(new URLSearchParams(url.split("?")[1]).get("q"), "龜背芋 大盆");
  });
});

describe("withErrorParam", () => {
  it("原本沒有查詢字串：接的是 ?", () => {
    assert.equal(
      new URL(withErrorParam("/dashboard/stores/a/products/new", "請填店名"), "https://x")
        .pathname,
      "/dashboard/stores/a/products/new",
    );
    assert.equal(
      readParam(withErrorParam("/dashboard/stores/a/products/new", "請填店名"), "error"),
      "請填店名",
    );
  });

  it("原本就有查詢字串：接的是 &，原有參數留著", () => {
    const url = withErrorParam("/plantae/checkout?product_id=abc&qty=2", "商品已下架");
    assert.equal(readParam(url, "product_id"), "abc");
    assert.equal(readParam(url, "qty"), "2");
    assert.equal(readParam(url, "error"), "商品已下架");
    assert.equal(url.split("?").length, 2);
  });

  it("原本已經有 error：換掉，不會變成兩個（頁面只讀第一個，舊訊息會蓋掉新的）", () => {
    const url = withErrorParam("/x?error=舊訊息", "新訊息");
    assert.equal(readParam(url, "error"), "新訊息");
    assert.equal(url.match(/error=/g)?.length, 1);
  });

  it("訊息裡的 & 與 = 被編碼，不會自己拆出別的參數", () => {
    const url = withErrorParam("/x", "數量必須是 1-99&qty=999");
    assert.equal(readParam(url, "error"), "數量必須是 1-99&qty=999");
    assert.equal(readParam(url, "qty"), null);
  });

  it("空訊息也照樣帶上 error=（呼叫端自己決定要不要跳）", () => {
    assert.equal(withErrorParam("/x", ""), "/x?error=");
  });

  it("只切第一個問號：後面的問號是值的一部分", () => {
    const url = withErrorParam("/x?q=a?b", "壞了");
    assert.equal(readParam(url, "q"), "a?b");
    assert.equal(readParam(url, "error"), "壞了");
  });
});

function readParam(url: string, key: string): string | null {
  return new URLSearchParams(url.split("?")[1] ?? "").get(key);
}
