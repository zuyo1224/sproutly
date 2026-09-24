// lib/format-file-size.ts 的行為固定測試：KB／MB 換單位的邊界不能再冒出「1024 KB」。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatFileSize } from "./format-file-size.ts";

describe("formatFileSize", () => {
  it("不到 1 KB 算 1 KB，不顯示 0 KB", () => {
    assert.equal(formatFileSize(0), "1 KB");
    assert.equal(formatFileSize(300), "1 KB");
  });

  it("KB 取整數", () => {
    assert.equal(formatFileSize(1024), "1 KB");
    assert.equal(formatFileSize(350 * 1024 + 700), "351 KB");
    assert.equal(formatFileSize(1023 * 1024), "1023 KB");
  });

  it("四捨五入到 1024 KB 的那段改顯示 1.0 MB", () => {
    assert.equal(formatFileSize(1048064), "1.0 MB");
    assert.equal(formatFileSize(1048575), "1.0 MB");
    assert.equal(formatFileSize(1048063), "1023 KB");
  });

  it("MB 取一位小數", () => {
    assert.equal(formatFileSize(1024 * 1024), "1.0 MB");
    assert.equal(formatFileSize(3.46 * 1024 * 1024), "3.5 MB");
  });
});
