// lib/product-search.ts 商品關鍵字比對的行為固定測試。
//
// 為什麼要有這份：後台商品列表、逛街頁、Cmd+K 搜尋三個入口吃同一條比對規則，搜尋
// API 還靠 matchesProductName / matchesProductDescription 分「名稱命中排前面」。
// 這裡把「名稱或描述含關鍵字就中」「描述是 null 不會炸」「全形打字也搜得到」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  matchesProductDescription,
  matchesProductName,
  matchesProductSearch,
} from "./product-search.ts";

const pot = { name: "Monstera 龜背芋", description: "適合半日照的觀葉植物" };
const noDesc = { name: "陶盆 5 號", description: null };

describe("matchesProductName", () => {
  it("名稱含關鍵字就中，大小寫不分", () => {
    assert.equal(matchesProductName(pot, "monstera"), true);
    assert.equal(matchesProductName(pot, "龜背"), true);
  });

  it("只有描述含的字，名稱這支不中", () => {
    assert.equal(matchesProductName(pot, "半日照"), false);
  });

  it("全形英數搜得到半形名稱", () => {
    assert.equal(matchesProductName(pot, "ＭＯＮＳＴＥＲＡ"), true);
    assert.equal(matchesProductName(noDesc, "５"), true);
  });
});

describe("matchesProductDescription", () => {
  it("描述含關鍵字就中", () => {
    assert.equal(matchesProductDescription(pot, "觀葉"), true);
  });

  it("描述是 null 當空字串，不中也不炸", () => {
    assert.equal(matchesProductDescription(noDesc, "陶盆"), false);
  });
});

describe("matchesProductSearch", () => {
  it("名稱或描述任一含關鍵字就中", () => {
    assert.equal(matchesProductSearch(pot, "龜背"), true);
    assert.equal(matchesProductSearch(pot, "半日照"), true);
    assert.equal(matchesProductSearch(noDesc, "陶盆"), true);
  });

  it("兩邊都沒有就不中", () => {
    assert.equal(matchesProductSearch(pot, "多肉"), false);
    assert.equal(matchesProductSearch(noDesc, "多肉"), false);
  });
});
