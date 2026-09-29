// lib/db-error-message.ts 的行為固定測試。
//
// 重點是「不管資料庫回什麼，後台頁面上都不會出現英文原文」。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DB_ERROR_FALLBACK, dbErrorMessage } from "./db-error-message.ts";

describe("有 code 先看 code", () => {
  it("資料重複", () => {
    assert.equal(
      dbErrorMessage({ code: "23505", message: "duplicate key value violates unique constraint" }),
      "這筆資料跟現有的重複了，換一個再試",
    );
  });
  it("欄位太長", () => {
    assert.equal(
      dbErrorMessage({ code: "22001", message: "value too long for type character varying(80)" }),
      "有欄位的內容太長了，縮短一點再試",
    );
  });
  it("登入過期", () => {
    assert.equal(dbErrorMessage({ code: "PGRST301", message: "JWT expired" }), "登入狀態過期了，請重新登入再試");
  });
});

describe("overrides 蓋過預設說法", () => {
  it("開店網址重複給專屬說法", () => {
    assert.equal(
      dbErrorMessage({ code: "23505", message: "duplicate key" }, { "23505": "網址已被使用" }),
      "網址已被使用",
    );
  });
  it("override 沒寫到的代號照預設", () => {
    assert.equal(
      dbErrorMessage({ code: "22001", message: "too long" }, { "23505": "網址已被使用" }),
      "有欄位的內容太長了，縮短一點再試",
    );
  });
});

describe("沒 code 比對訊息", () => {
  it("權限", () => {
    assert.equal(
      dbErrorMessage({ message: "new row violates row-level security policy for table \"x\"" }),
      "沒有權限做這個動作，請重新登入再試",
    );
  });
  it("斷線", () => {
    assert.equal(dbErrorMessage({ message: "TypeError: fetch failed" }), "連線不太穩，請稍後再試");
  });
});

describe("都對不上給通用說法", () => {
  it("不認得的英文", () => {
    assert.equal(dbErrorMessage({ code: "XX000", message: "internal error" }), DB_ERROR_FALLBACK);
  });
  it("null", () => {
    assert.equal(dbErrorMessage(null), DB_ERROR_FALLBACK);
  });
});
