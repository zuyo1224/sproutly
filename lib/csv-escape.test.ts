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
import { csvDocument, csvDownloadHeaders, csvExportFilename, csvEscape, csvRow } from "./csv-escape.ts";

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

describe("csvRow／csvDocument／csvDownloadHeaders", () => {
  it("csvRow 每格照 csvEscape 跳脫再用逗號接", () => {
    assert.equal(
      csvRow(["王小明", "台北市,大安區", null, 3, "=1+1"]),
      '王小明,"台北市,大安區",,3,\'=1+1',
    );
    assert.equal(csvRow([]), "");
  });

  it("csvDocument 開頭補 BOM、列與列用 CRLF、結尾不多換行", () => {
    const doc = csvDocument(["a,b", "1,2"]);
    assert.equal(doc.charCodeAt(0), 0xfeff);
    assert.equal(doc, "\uFEFFa,b\r\n1,2");
    assert.equal(csvDocument([]), "\uFEFF");
  });

  it("csvDownloadHeaders 中文檔名走 filename* UTF-8 百分比編碼", () => {
    assert.deepEqual(csvDownloadHeaders("小芽盆栽-orders-2026-09-23-篩選.csv"), {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        "attachment; filename*=UTF-8''%E5%B0%8F%E8%8A%BD%E7%9B%86%E6%A0%BD-orders-2026-09-23-%E7%AF%A9%E9%81%B8.csv",
    });
  });

  it("csvExportFilename 店名-種類-日期，篩選過才加 -篩選", () => {
    assert.equal(csvExportFilename("小芽盆栽", "orders", "2026-09-23", false), "小芽盆栽-orders-2026-09-23.csv");
    assert.equal(
      csvExportFilename("小芽盆栽", "customers", "2026-09-23", true),
      "小芽盆栽-customers-2026-09-23-篩選.csv",
    );
  });
});
