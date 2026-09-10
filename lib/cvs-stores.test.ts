// lib/cvs-stores.ts 的行為固定測試。
//
// 結帳頁的超商選店下拉吃這份清單，選到的字串會原樣存進訂單的取貨門市欄位、印在
// 後台出貨畫面上。門市代碼重複或標籤格式改掉，商家看到的是「兩筆單指到同一間店」
// 或「少了代碼的門市名」，出貨才發現。這裡把資料的完整性與標籤長相寫死。
// 之後接綠界物流 API 換成即時門市時，這份測試會提醒新來源要維持同樣的形狀。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CVS_STORES, CVS_LOOKUP_URLS, formatStoreLabel } from "./cvs-stores.ts";

describe("清單資料", () => {
  it("三家超商都有門市", () => {
    const brands = new Set(CVS_STORES.map((s) => s.cvs));
    assert.deepEqual([...brands].sort(), ["7-11", "全家", "萊爾富"]);
  });

  it("每一筆四個欄位都有值、都不是空白字串", () => {
    for (const s of CVS_STORES) {
      for (const key of ["cvs", "name", "code", "area"] as const) {
        assert.equal(typeof s[key], "string", `${s.code} 的 ${key} 不是字串`);
        assert.notEqual(s[key].trim(), "", `${s.code} 的 ${key} 是空的`);
      }
    }
  });

  it("門市代碼不重複（重複會讓兩筆單指到同一間）", () => {
    const codes = CVS_STORES.map((s) => s.code);
    assert.equal(new Set(codes).size, codes.length);
  });

  it("同一家超商裡的門市名不重複（客人下拉看到兩個一樣的選項會選錯）", () => {
    for (const brand of ["7-11", "全家", "萊爾富"]) {
      const names = CVS_STORES.filter((s) => s.cvs === brand).map((s) => s.name);
      assert.equal(new Set(names).size, names.length, `${brand} 有重複門市名`);
    }
  });

  it("全家與萊爾富的代碼有各自的前綴，跟 7-11 的純數字分得開", () => {
    for (const s of CVS_STORES) {
      if (s.cvs === "全家") assert.ok(s.code.startsWith("FX"), s.code);
      if (s.cvs === "萊爾富") assert.ok(s.code.startsWith("HL"), s.code);
      if (s.cvs === "7-11") assert.match(s.code, /^\d+$/);
    }
  });
});

describe("formatStoreLabel", () => {
  it("長相是「超商 門市 #代碼（地區）」，括號是全形", () => {
    assert.equal(
      formatStoreLabel({ cvs: "7-11", name: "信義門市", code: "116002", area: "台北信義區" }),
      "7-11 信義門市 #116002（台北信義區）",
    );
  });

  it("全家與萊爾富同一套格式", () => {
    assert.equal(
      formatStoreLabel({ cvs: "全家", name: "板橋門市", code: "FX220035", area: "新北板橋區" }),
      "全家 板橋門市 #FX220035（新北板橋區）",
    );
  });

  it("清單每一筆都印得出代碼與地區（存進訂單的字串不會少東西）", () => {
    for (const s of CVS_STORES) {
      const label = formatStoreLabel(s);
      assert.ok(label.includes(`#${s.code}`), label);
      assert.ok(label.includes(`（${s.area}）`), label);
    }
  });

  it("每一筆的標籤都不重複（下拉選項不會有兩行一模一樣）", () => {
    const labels = CVS_STORES.map(formatStoreLabel);
    assert.equal(new Set(labels).size, labels.length);
  });
});

describe("CVS_LOOKUP_URLS", () => {
  it("三家都有查門市的連結，且跟清單裡的超商名對得上", () => {
    assert.deepEqual(Object.keys(CVS_LOOKUP_URLS).sort(), ["7-11", "全家", "萊爾富"]);
  });

  it("全是 https（客人點出去不會被瀏覽器擋成不安全）", () => {
    for (const url of Object.values(CVS_LOOKUP_URLS)) {
      assert.ok(url.startsWith("https://"), url);
    }
  });
});
