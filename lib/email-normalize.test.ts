// lib/email-normalize.ts 的行為固定測試。
//
// 五個入口（商家註冊、商家登入、客人 magic link、單品結帳、購物車結帳）都吃這支。
// 清洗規則改壞的樣子是安靜的：信寄不到、magic link 對不上帳號、同一位客人在訂單上
// 出現大小寫兩種寫法各算一位。這裡把「全形轉半形、砍空白、轉小寫」三條寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail } from "./email-normalize.ts";

describe("沒有值", () => {
  it("null／undefined／空字串一律回空字串", () => {
    assert.equal(normalizeEmail(null), "");
    assert.equal(normalizeEmail(undefined), "");
    assert.equal(normalizeEmail(""), "");
  });

  it("整串都是空白時清完也是空字串", () => {
    assert.equal(normalizeEmail("   　 "), "");
  });
});

describe("全形轉半形", () => {
  it("中文輸入法打出的整串全形 email 轉得回來", () => {
    assert.equal(normalizeEmail("ｄａｎｎｙ＠ｇｍａｉｌ．ｃｏｍ"), "danny@gmail.com");
  });

  it("只有小老鼠或點是全形也修得掉", () => {
    assert.equal(normalizeEmail("danny＠gmail.com"), "danny@gmail.com");
    assert.equal(normalizeEmail("danny@gmail．com"), "danny@gmail.com");
  });

  it("全形數字與連字號、底線一起轉", () => {
    assert.equal(normalizeEmail("ａ１２３－ｂ＿ｃ＠ｍａｉｌ．ｔｗ"), "a123-b_c@mail.tw");
  });
});

describe("空白", () => {
  it("頭尾空白砍掉", () => {
    assert.equal(normalizeEmail("  danny@gmail.com  "), "danny@gmail.com");
  });

  it("從 LINE／IG 複製夾到的中段空白也砍（email 本來就不含空白）", () => {
    assert.equal(normalizeEmail("danny @ gmail.com"), "danny@gmail.com");
  });

  it("全形空白與換行、tab 一起砍", () => {
    assert.equal(normalizeEmail("danny　@gmail\t.com\n"), "danny@gmail.com");
  });
});

describe("大小寫", () => {
  it("一律轉小寫，讓註冊打大寫、登入打小寫對得上", () => {
    assert.equal(normalizeEmail("Danny@Gmail.COM"), "danny@gmail.com");
  });

  it("全形大寫也先轉半形再轉小寫", () => {
    assert.equal(normalizeEmail("ＤＡＮＮＹ＠ＧＭＡＩＬ．ＣＯＭ"), "danny@gmail.com");
  });
});

describe("正常值不被動到", () => {
  it("已經乾淨的 email 原樣回", () => {
    assert.equal(normalizeEmail("danny19971224@gmail.com"), "danny19971224@gmail.com");
  });

  it("加號別名與多層網域保留", () => {
    assert.equal(normalizeEmail("a+shop@mail.example.co.uk"), "a+shop@mail.example.co.uk");
  });

  it("這支不做格式驗證：不是 email 的字串也照清不報錯", () => {
    assert.equal(normalizeEmail("ＡＢＣ"), "abc");
  });

  it("清完的結果再清一次不會變（同一個值反覆存取穩定）", () => {
    const once = normalizeEmail("  Ｄａｎｎｙ ＠ Gmail．COM ");
    assert.equal(normalizeEmail(once), once);
    assert.equal(once, "danny@gmail.com");
  });
});
