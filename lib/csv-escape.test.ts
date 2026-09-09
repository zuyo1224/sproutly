// lib/csv-escape.ts csvEscape 的行為固定測試。
//
// 為什麼要有這份：客人匯出與訂單匯出兩條 CSV route 共用這一支當唯一的欄位轉義口徑，
// 而欄位內容（姓名、備註、商品名）是客人下單自己填的。改壞的兩種下場都很安靜：
// 少包一層引號，含逗號的地址讓整列欄位錯位，商家在試算表裡看到電話跑到金額欄；
// 漏掉公式防護，客人姓名填 =HYPERLINK(...) 商家一開檔就中招（CSV injection）。
// 這裡把「null／undefined 回空、= + - @ tab CR 開頭補單引號、含逗號雙引號換行才包引號、
// 引號翻倍、其餘原樣」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { csvEscape } from "./csv-escape.ts";

describe("csvEscape", () => {
  it("null 與 undefined 回空字串，不是 'null' 字樣", () => {
    assert.equal(csvEscape(null), "");
    assert.equal(csvEscape(undefined), "");
  });

  it("一般文字與數字原樣回傳，不多包引號", () => {
    assert.equal(csvEscape("王小明"), "王小明");
    assert.equal(csvEscape(1234), "1234");
    assert.equal(csvEscape(0), "0");
    assert.equal(csvEscape(""), "");
  });

  it("含逗號、雙引號或換行才包雙引號，引號翻倍", () => {
    assert.equal(csvEscape("台北市,大安區"), '"台北市,大安區"');
    assert.equal(csvEscape('他說"好"'), '"他說""好"""');
    assert.equal(csvEscape("第一行\n第二行"), '"第一行\n第二行"');
  });

  it("開頭是公式字元（= + @）補一個單引號擋 CSV injection", () => {
    assert.equal(csvEscape("=HYPERLINK(\"http://x\")"), "\"'=HYPERLINK(\"\"http://x\"\")\"");
    assert.equal(csvEscape("@SUM(A1)"), "'@SUM(A1)");
    assert.equal(csvEscape("+886912345678"), "'+886912345678");
    assert.equal(csvEscape("-5"), "'-5");
  });

  it("開頭是 tab 或 CR 也算公式字元，補單引號後因含 CR 再包引號", () => {
    assert.equal(csvEscape("\tabc"), "'\tabc");
    assert.equal(csvEscape("\rabc"), "\"'\rabc\"");
  });

  it("公式字元只看開頭，出現在中間不動", () => {
    assert.equal(csvEscape("a=b"), "a=b");
    assert.equal(csvEscape("email@x.com"), "email@x.com");
  });

  it("負數金額字串化後也會被補單引號（跟 - 開頭的規則一致，匯出端要注意）", () => {
    assert.equal(csvEscape(-12), "'-12");
  });
});
