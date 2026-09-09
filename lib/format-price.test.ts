// lib/format-price.ts 金額顯示／換算七支的行為固定測試。
//
// 為什麼要有這份：formatPrice 是全站二十幾頁金額顯示的唯一口徑，centsToYuan／yuanToCents
// 是 CSV 匯出與商品寫入 DB 的捨入口徑，currencyForSchema／priceForSchema／
// productOfferFieldsForSchema 餵 Google 結構化資料。壞法都很安靜：客人看到「NT$ NaN」、
// 日圓商品被塞「.00」、沒填幣別的舊商品 JSON-LD 丟 priceCurrency: null 讓整段 offer 失效。
// Intl 的實際輸出跟著 ICU 走，這裡對非 TWD 幣別只鎖「有沒有小數、有沒有千分位」這種
// 不隨版本變的性質，不逐字比對符號。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatPrice,
  displayCurrency,
  centsToYuan,
  yuanToCents,
  currencyForSchema,
  currencySymbol,
  priceForSchema,
  productOfferFieldsForSchema,
} from "./format-price.ts";

describe("formatPrice", () => {
  it("TWD 顯示 NT$ + 千分位、不留小數", () => {
    assert.equal(formatPrice(123456), "NT$ 1,235");
    assert.equal(formatPrice(100), "NT$ 1");
    assert.equal(formatPrice(0), "NT$ 0");
  });

  it("TWD 四捨五入到整數元", () => {
    assert.equal(formatPrice(149), "NT$ 1");
    assert.equal(formatPrice(150), "NT$ 2");
  });

  it("沒填幣別（undefined／null／空字串／純空白）一律當 TWD", () => {
    assert.equal(formatPrice(1000, undefined), "NT$ 10");
    assert.equal(formatPrice(1000, null), "NT$ 10");
    assert.equal(formatPrice(1000, ""), "NT$ 10");
    assert.equal(formatPrice(1000, "   "), "NT$ 10");
  });

  it("幣別代碼小寫或帶空白也認得", () => {
    assert.equal(formatPrice(1000, " twd "), "NT$ 10");
  });

  it("金額不是有限數（NaN／Infinity）當 0，不出現 NT$ NaN", () => {
    assert.equal(formatPrice(NaN), "NT$ 0");
    assert.equal(formatPrice(Infinity), "NT$ 0");
    assert.equal(formatPrice(-Infinity), "NT$ 0");
  });

  it("美金留兩位小數並帶千分位", () => {
    const s = formatPrice(123456, "USD");
    assert.match(s, /1,234\.56$/);
    assert.match(s, /\$/);
  });

  it("日圓不硬塞小數", () => {
    const s = formatPrice(120000, "JPY");
    assert.match(s, /1,200$/);
    assert.doesNotMatch(s, /\./);
  });

  it("不合格式的幣別代碼退回「代碼 + 兩位小數」，不讓整頁壞掉", () => {
    assert.equal(formatPrice(1234, "AB"), "AB 12.34");
  });
});

describe("displayCurrency", () => {
  it("取第一筆訂單的幣別", () => {
    assert.equal(displayCurrency([{ currency: "USD" }, { currency: "TWD" }]), "USD");
  });

  it("空清單、null、undefined 或第一筆沒填幣別都退回 TWD", () => {
    assert.equal(displayCurrency([]), "TWD");
    assert.equal(displayCurrency(null), "TWD");
    assert.equal(displayCurrency(undefined), "TWD");
    assert.equal(displayCurrency([{ currency: null }]), "TWD");
    assert.equal(displayCurrency([{}]), "TWD");
  });
});

describe("centsToYuan / yuanToCents", () => {
  it("分轉元四捨五入到整數", () => {
    assert.equal(centsToYuan(123456), 1235);
    assert.equal(centsToYuan(149), 1);
    assert.equal(centsToYuan(150), 2);
    assert.equal(centsToYuan(0), 0);
  });

  it("元轉分乘 100 後收掉浮點誤差", () => {
    assert.equal(yuanToCents(19.99), 1999);
    assert.equal(yuanToCents(0.1 + 0.2), 30);
    assert.equal(yuanToCents(100), 10000);
  });

  it("整數元來回轉換不失真", () => {
    for (const yuan of [0, 1, 99, 1234, 99999]) {
      assert.equal(centsToYuan(yuanToCents(yuan)), yuan);
    }
  });
});

describe("currencyForSchema / currencySymbol", () => {
  it("去空白、轉大寫，沒填當 TWD", () => {
    assert.equal(currencyForSchema(" usd "), "USD");
    assert.equal(currencyForSchema(null), "TWD");
    assert.equal(currencyForSchema(undefined), "TWD");
    assert.equal(currencyForSchema(""), "TWD");
  });

  it("TWD 顯示 NT$，其他幣別顯示代碼本身", () => {
    assert.equal(currencySymbol("TWD"), "NT$");
    assert.equal(currencySymbol("twd"), "NT$");
    assert.equal(currencySymbol(null), "NT$");
    assert.equal(currencySymbol("USD"), "USD");
    assert.equal(currencySymbol(" jpy"), "JPY");
  });
});

describe("priceForSchema", () => {
  it("TWD 回整數字串，不帶符號與千分位", () => {
    assert.equal(priceForSchema(123456), "1235");
    assert.equal(priceForSchema(123456, "twd"), "1235");
    assert.equal(priceForSchema(0), "0");
  });

  it("美金留兩位、日圓零位，小數位跟著幣別走", () => {
    assert.equal(priceForSchema(123456, "USD"), "1234.56");
    assert.equal(priceForSchema(120000, "JPY"), "1200");
    assert.equal(priceForSchema(120050, "KRW"), "1201");
  });

  it("金額不是有限數當 0", () => {
    assert.equal(priceForSchema(NaN), "0");
    assert.equal(priceForSchema(NaN, "USD"), "0.00");
  });

  it("不合格式的幣別退回兩位小數", () => {
    assert.equal(priceForSchema(1234, "AB"), "12.34");
  });
});

describe("productOfferFieldsForSchema", () => {
  it("幣別與價格走同一套正規化，狀態固定 NewCondition", () => {
    const o = productOfferFieldsForSchema(150000, null);
    assert.equal(o.priceCurrency, "TWD");
    assert.equal(o.price, "1500");
    assert.equal(o.itemCondition, "https://schema.org/NewCondition");
  });

  it("priceValidUntil 是一年後的 YYYY-MM-DD（誤差一天內）", () => {
    const o = productOfferFieldsForSchema(100, "USD");
    assert.match(o.priceValidUntil, /^\d{4}-\d{2}-\d{2}$/);
    const expected = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const got = new Date(`${o.priceValidUntil}T00:00:00Z`).getTime();
    assert.ok(Math.abs(expected - got) < 2 * 24 * 60 * 60 * 1000);
    assert.equal(o.price, "1.00");
    assert.equal(o.priceCurrency, "USD");
  });
});
