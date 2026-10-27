// lib/new-store-error-message.ts 的行為固定測試。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STORE_NAME_REQUIRED_ERROR,
  knownNewStoreError,
  storeSlugTakenError,
} from "./new-store-error-message.ts";
import { DB_ERROR_FALLBACK, dbErrorMessage } from "./db-error-message.ts";
import { MAX_STORE_ADDRESS_LEN, storeTextLimitError } from "./store-limits.ts";
import { storeSlugError } from "./store-slug.ts";

describe("knownNewStoreError", () => {
  it("開店流程會帶的句子照原樣回", () => {
    for (const text of [
      STORE_NAME_REQUIRED_ERROR,
      storeTextLimitError({
        name: "店",
        description: null,
        contact_phone: null,
        contact_email: null,
        address: "路".repeat(MAX_STORE_ADDRESS_LEN + 1),
      })!,
      storeSlugError("")!,
      storeSlugError("中文店")!,
      storeSlugError("a".repeat(40))!,
      storeSlugError("dashboard")!,
      storeSlugTakenError("taihe-studio"),
      dbErrorMessage({ code: "42501" }),
      dbErrorMessage({ message: "fetch failed" }),
      DB_ERROR_FALLBACK,
    ]) {
      assert.equal(knownNewStoreError(text), text);
    }
  });

  it("網址上被塞的其他字句一律當沒有", () => {
    for (const text of [
      undefined,
      "",
      "帳號即將停用，請加 LINE 客服 @abc 解鎖",
      "網址「請匯款到 012-3456789」已被使用，換一個試試",
      "網址「AB」已被使用，換一個試試",
      "網址「plant」是系統保留字，換一個試試",
    ]) {
      assert.equal(knownNewStoreError(text), undefined);
    }
  });
});
