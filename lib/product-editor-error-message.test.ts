// lib/product-editor-error-message.ts 的行為固定測試。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DUPLICATE_FAILED_ERROR,
  IMAGE_PROCESS_FALLBACK_ERROR,
  IMAGE_URL_NOT_HTTPS_ERROR,
  IMAGE_URL_TOO_LONG_ERROR,
  knownProductEditorError,
} from "./product-editor-error-message.ts";
import { readProductForm } from "./product-form.ts";
import { DB_ERROR_FALLBACK, dbErrorMessage } from "./db-error-message.ts";
import {
  IMAGE_UPLOAD_FAILED_ERROR,
  resolveUploadImageType,
} from "./upload-image-type.ts";

function formError(fields: Record<string, string>): string {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const result = readProductForm(fd);
  if (result.ok) throw new Error(`readProductForm(${JSON.stringify(fields)}) 沒有擋下`);
  return result.error;
}

function uploadTypeError(name: string, bytes: number[]): string {
  const result = resolveUploadImageType(name, Buffer.from(bytes), "");
  if (result.ok) throw new Error(`resolveUploadImageType(${name}) 沒有擋下`);
  return result.error;
}

describe("knownProductEditorError", () => {
  it("新增／編輯／複製商品會帶的句子照原樣回", () => {
    for (const text of [
      formError({ name: "", price: "100" }),
      formError({ name: "盆栽", price: "" }),
      formError({ name: "盆栽", price: "-1" }),
      formError({ name: "盆栽", price: "999999999" }),
      formError({ name: "盆".repeat(101), price: "100" }),
      formError({ name: "盆栽", description: "字".repeat(2001), price: "100" }),
      formError({ name: "盆栽", price: "100", stock: "5.5" }),
      formError({ name: "盆栽", price: "100", stock: "99999999" }),
      uploadTypeError("a.bmp", [0x42, 0x4d]),
      uploadTypeError("a.jpg", [0x00, 0x01, 0x02, 0x03]),
      IMAGE_UPLOAD_FAILED_ERROR,
      IMAGE_PROCESS_FALLBACK_ERROR,
      IMAGE_URL_TOO_LONG_ERROR,
      IMAGE_URL_NOT_HTTPS_ERROR,
      DUPLICATE_FAILED_ERROR,
      dbErrorMessage({ code: "42501" }),
      dbErrorMessage({ message: "fetch failed" }),
      DB_ERROR_FALLBACK,
    ]) {
      assert.equal(knownProductEditorError(text), text);
    }
  });

  it("網址上被塞的其他字句一律當沒有", () => {
    for (const text of [
      undefined,
      "",
      "此商品涉及違規，請加 LINE 客服補件",
      ` ${DUPLICATE_FAILED_ERROR}`,
      `${IMAGE_UPLOAD_FAILED_ERROR}，請加 LINE 客服`,
    ]) {
      assert.equal(knownProductEditorError(text), undefined);
    }
  });
});
