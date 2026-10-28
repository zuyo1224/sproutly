// lib/store-settings-error-message.ts 的行為固定測試。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HERO_UPLOAD_FALLBACK_ERROR,
  LOGO_UPLOAD_FALLBACK_ERROR,
  STORE_NAME_EMPTY_ERROR,
  knownStoreSettingsError,
} from "./store-settings-error-message.ts";
import { DB_ERROR_FALLBACK, dbErrorMessage } from "./db-error-message.ts";
import {
  MAX_COLLECTION_SUBTITLE_LEN,
  MAX_FAQ_TEXT_LEN,
  MAX_SOCIAL_URL_LEN,
  MAX_STORE_NAME_LEN,
  storeTextLimitError,
  storeThemeTextLimitError,
} from "./store-limits.ts";
import {
  IMAGE_UPLOAD_FAILED_ERROR,
  NOT_IMAGE_CONTENT_ERROR,
  UNSUPPORTED_IMAGE_ERROR,
} from "./upload-image-type.ts";

const themeFields = {
  tagline: null,
  heroEyebrow: null,
  heroSubtitle: null,
  collectionsIntro: null,
  collectionItems: [],
  promise: null,
  visitTitle: null,
  businessHours: "",
  faq: "",
  social: { instagram: null, facebook: null, line: null },
};

describe("knownStoreSettingsError", () => {
  it("店面設定存檔會帶的句子照原樣回", () => {
    for (const text of [
      STORE_NAME_EMPTY_ERROR,
      storeTextLimitError({
        name: "店".repeat(MAX_STORE_NAME_LEN + 1),
        description: null,
        contact_phone: null,
        contact_email: null,
        address: null,
      })!,
      storeThemeTextLimitError({ ...themeFields, faq: "問".repeat(MAX_FAQ_TEXT_LEN + 1) })!,
      storeThemeTextLimitError({
        ...themeFields,
        collectionItems: [
          { title: "盆栽", subtitle: "" },
          { title: "茶器", subtitle: "字".repeat(MAX_COLLECTION_SUBTITLE_LEN + 1) },
        ],
      })!,
      storeThemeTextLimitError({
        ...themeFields,
        social: { ...themeFields.social, line: "x".repeat(MAX_SOCIAL_URL_LEN + 1) },
      })!,
      UNSUPPORTED_IMAGE_ERROR,
      NOT_IMAGE_CONTENT_ERROR,
      IMAGE_UPLOAD_FAILED_ERROR,
      LOGO_UPLOAD_FALLBACK_ERROR,
      HERO_UPLOAD_FALLBACK_ERROR,
      dbErrorMessage({ code: "42501" }),
      dbErrorMessage({ message: "fetch failed" }),
      DB_ERROR_FALLBACK,
    ]) {
      assert.equal(knownStoreSettingsError(text), text);
    }
  });

  it("網址上被塞的其他字句一律當沒有", () => {
    for (const text of [
      undefined,
      "",
      "店面因違規即將關閉，請加 LINE 客服申訴",
      ` ${STORE_NAME_EMPTY_ERROR}`,
      `${IMAGE_UPLOAD_FAILED_ERROR}，請加 LINE 客服`,
    ]) {
      assert.equal(knownStoreSettingsError(text), undefined);
    }
  });
});
