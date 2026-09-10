// lib/form-fields.ts 的行為固定測試。
//
// 七個 server action 檔讀表單欄位都走這兩支。差別只有一點：必填欄位沒填會拿到空字串
// （由呼叫端自己判「這欄不能空」），選填欄位沒填會拿到 null（直接寫進 DB 那欄）。
// 這條界線改壞的樣子是 DB 裡多出一堆空字串而不是 null，畫面上就變成「有這個欄位、
// 但裡面什麼都沒有」的空行。這裡把 trim、沒有值、以及空字串收不收成 null 寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formString, formStringOrNull } from "./form-fields.ts";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("formString", () => {
  it("有值就回值", () => {
    assert.equal(formString(fd({ name: "龜背芋" }), "name"), "龜背芋");
  });

  it("去頭尾空白（含全形空白與換行）", () => {
    assert.equal(formString(fd({ name: "  龜背芋 \n" }), "name"), "龜背芋");
    assert.equal(formString(fd({ name: "　龜背芋　" }), "name"), "龜背芋");
  });

  it("中段空白保留（店名可以有空格）", () => {
    assert.equal(formString(fd({ name: " Plantae Market " }), "name"), "Plantae Market");
  });

  it("整欄都是空白回空字串", () => {
    assert.equal(formString(fd({ name: "   " }), "name"), "");
  });

  it("欄位根本不存在回空字串（不是 undefined、不是字串 \"null\"）", () => {
    assert.equal(formString(fd({}), "name"), "");
  });

  it("同名多值時取第一個（FormData.get 的行為）", () => {
    const f = fd({});
    f.append("tag", " 甲 ");
    f.append("tag", "乙");
    assert.equal(formString(f, "tag"), "甲");
  });
});

describe("formStringOrNull", () => {
  it("有值就回值，一樣去頭尾空白", () => {
    assert.equal(formStringOrNull(fd({ phone: " 0912-345-678 " }), "phone"), "0912-345-678");
  });

  it("空字串收成 null", () => {
    assert.equal(formStringOrNull(fd({ phone: "" }), "phone"), null);
  });

  it("整欄都是空白也收成 null", () => {
    assert.equal(formStringOrNull(fd({ phone: "  　" }), "phone"), null);
  });

  it("欄位不存在回 null", () => {
    assert.equal(formStringOrNull(fd({}), "phone"), null);
  });

  it("字串 \"0\" 不會被當成空值（|| 的老坑，這裡不能踩）", () => {
    assert.equal(formStringOrNull(fd({ note: "0" }), "note"), "0");
  });
});

describe("兩支的差別只在空值", () => {
  it("有值時兩支結果一樣", () => {
    const f = fd({ x: " abc " });
    assert.equal(formString(f, "x"), formStringOrNull(f, "x"));
  });

  it("沒值時一個回空字串、一個回 null", () => {
    const f = fd({ x: "  " });
    assert.equal(formString(f, "x"), "");
    assert.equal(formStringOrNull(f, "x"), null);
  });
});
