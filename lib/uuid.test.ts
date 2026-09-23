// lib/uuid.ts isUuid 的行為固定測試。
//
// 為什麼要有這份：isUuid 是 7 個入口（商品頁、結帳、訂單成功頁、會員訂單、收藏 API、
// 後台商品編輯、後台訂單）把網址或 localStorage 來的 id 丟進資料庫前的關卡。
// 不是 uuid 格式的字串進 .eq / .in，PostgREST 會整句回 22P02——收藏 API 那種
// 一次查一批的，一筆髒 id 就讓整批都查不到。這裡把「8-4-4-4-12、十六進位、
// 不分大小寫、整串完全吻合」寫死，日後改 regex 漏了錨點或放寬字元會被抓到。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isUuid } from "./uuid.ts";

describe("isUuid", () => {
  it("標準小寫 uuid 通過", () => {
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
    assert.equal(isUuid("00000000-0000-0000-0000-000000000000"), true);
  });

  it("大寫、大小寫混用也算（不分大小寫）", () => {
    assert.equal(isUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301"), true);
    assert.equal(isUuid("3f2504E0-4F89-41d3-9A0c-0305e82C3301"), true);
  });

  it("空字串與一般文字不算", () => {
    assert.equal(isUuid(""), false);
    assert.equal(isUuid("not-a-uuid"), false);
    assert.equal(isUuid("undefined"), false);
  });

  it("段長不是 8-4-4-4-12 不算：少一碼、多一碼、沒有連字號", () => {
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c330"), false);
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c33011"), false);
    assert.equal(isUuid("3f2504e04f8941d39a0c0305e82c3301"), false);
    assert.equal(isUuid("3f2504e0f-4f8-41d3-9a0c-0305e82c3301"), false);
  });

  it("十六進位以外的字元不算（g、全形數字、空白）", () => {
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c330g"), false);
    assert.equal(isUuid("３f2504e0-4f89-41d3-9a0c-0305e82c3301"), false);
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c 0305e82c3301"), false);
  });

  it("整串要完全吻合：前後多了空白、斜線、查詢字串都不算", () => {
    assert.equal(isUuid(" 3f2504e0-4f89-41d3-9a0c-0305e82c3301"), false);
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301 "), false);
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301/"), false);
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301?x=1"), false);
    assert.equal(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301\n"), false);
  });

  it("用大括號包起來的 Windows GUID 寫法不算", () => {
    assert.equal(isUuid("{3f2504e0-4f89-41d3-9a0c-0305e82c3301}"), false);
  });
});
