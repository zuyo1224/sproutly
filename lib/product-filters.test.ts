// lib/product-filters.ts 後台商品列表篩選解析的行為固定測試。
//
// 為什麼要有這份：chip 連結、快速動作（上下架、改庫存、調順序）跳回來的網址、列表內容都吃
// 這份解析，改壞的下場是商家按完一個按鈕被丟回全部列表，或亂填的網址參數讓列表篩成空的。
// 這裡把「清單內照收、清單外退 all、q 去空白、查詢字串 all／空值不帶」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_STATUS_FILTERS,
  isProductFilterActive,
  parseProductFilters,
  productFilterQuery,
  productStatusFilter,
} from "./product-filters.ts";
import { LOW_STOCK_THRESHOLD } from "./product-stock.ts";

describe("parseProductFilters", () => {
  it("清單內的 filter 照收，q 去前後空白", () => {
    assert.deepEqual(parseProductFilters({ filter: "low", q: "  龜背芋 " }), {
      filter: "low",
      q: "龜背芋",
    });
  });

  it("沒帶、null、清單外的 filter 一律退 all", () => {
    assert.deepEqual(parseProductFilters({}), { filter: "all", q: "" });
    assert.deepEqual(parseProductFilters({ filter: null, q: null }), {
      filter: "all",
      q: "",
    });
    assert.equal(parseProductFilters({ filter: "deleted" }).filter, "all");
    assert.equal(parseProductFilters({ filter: "match" }).filter, "all");
  });
});

describe("PRODUCT_STATUS_FILTERS", () => {
  it("chip 順序固定，第一個是 all", () => {
    assert.deepEqual(
      PRODUCT_STATUS_FILTERS.map((f) => f.key),
      ["all", "active", "inactive", "low", "soldout"]
    );
  });

  it("各狀態的判斷：停售、快沒貨門檻、售完含負庫存、沒在管庫存不算快沒貨", () => {
    const m = (key: string, p: { is_active: boolean; stock: number | null }) =>
      productStatusFilter(key).match(p);
    assert.equal(m("active", { is_active: true, stock: null }), true);
    assert.equal(m("inactive", { is_active: true, stock: null }), false);
    assert.equal(m("inactive", { is_active: false, stock: 5 }), true);
    assert.equal(m("low", { is_active: true, stock: LOW_STOCK_THRESHOLD }), true);
    assert.equal(m("low", { is_active: true, stock: LOW_STOCK_THRESHOLD + 1 }), false);
    assert.equal(m("low", { is_active: true, stock: null }), false);
    assert.equal(m("soldout", { is_active: true, stock: 0 }), true);
    assert.equal(m("soldout", { is_active: true, stock: -2 }), true);
    assert.equal(m("soldout", { is_active: true, stock: null }), false);
  });

  it("productStatusFilter 查不到的 key 退回 all", () => {
    assert.equal(productStatusFilter("nope").key, "all");
  });
});

describe("isProductFilterActive／productFilterQuery", () => {
  it("沒篩選沒搜尋：不算篩選、查詢字串空", () => {
    const f = { filter: "all", q: "" };
    assert.equal(isProductFilterActive(f), false);
    assert.equal(productFilterQuery(f), "");
  });

  it("任一項有值就算篩選，查詢字串只帶有值的那項", () => {
    assert.equal(isProductFilterActive({ filter: "low", q: "" }), true);
    assert.equal(isProductFilterActive({ filter: "all", q: "盆" }), true);
    assert.equal(productFilterQuery({ filter: "low", q: "" }), "filter=low");
    assert.equal(
      productFilterQuery({ filter: "soldout", q: "小 盆" }),
      "filter=soldout&q=%E5%B0%8F+%E7%9B%86"
    );
  });
});
