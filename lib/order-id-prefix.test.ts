// lib/order-id-prefix.ts 查訂單頁編號欄「能不能比對」的行為固定測試。
//
// 為什麼要有這份：查單頁不用登入，編號欄放行了不可能相符的值，就會白撈整家店的訂單；
// 擋太多又會讓拿著正確短碼或完整 UUID 的客人查無訂單。兩邊都寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isOrderIdPrefixQuery } from "./order-id-prefix.ts";

describe("isOrderIdPrefixQuery", () => {
  it("8 碼短碼與完整 UUID 都放行", () => {
    assert.equal(isOrderIdPrefixQuery("a1b2c3d4"), true);
    assert.equal(isOrderIdPrefixQuery("a1b2c3d4-"), true);
    assert.equal(
      isOrderIdPrefixQuery("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"),
      true
    );
  });

  it("低於 8 碼不放行", () => {
    assert.equal(isOrderIdPrefixQuery(""), false);
    assert.equal(isOrderIdPrefixQuery("a1b2c3d"), false);
  });

  it("超過 36 碼不放行（沒有 UUID 會以它開頭）", () => {
    assert.equal(
      isOrderIdPrefixQuery("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d0"),
      false
    );
    assert.equal(isOrderIdPrefixQuery("a".repeat(5000)), false);
  });

  it("夾了 UUID 不會出現的字不放行", () => {
    assert.equal(isOrderIdPrefixQuery("a1b2c3dz"), false);
    assert.equal(isOrderIdPrefixQuery("訂單a1b2c3d4"), false);
    assert.equal(isOrderIdPrefixQuery("a1b2c3d4%"), false);
  });

  it("dash 不在 UUID 該有的位置不放行（不可能相符）", () => {
    assert.equal(isOrderIdPrefixQuery("--------"), false);
    assert.equal(isOrderIdPrefixQuery("a1b2-c3d4"), false);
    assert.equal(isOrderIdPrefixQuery("a1b2c3d4e"), false);
    assert.equal(isOrderIdPrefixQuery("a1b2c3d4-e5f6g"), false);
    assert.equal(isOrderIdPrefixQuery("a1b2c3d4-e5f-"), false);
    assert.equal(isOrderIdPrefixQuery("a1b2c3d4-e5f6-"), true);
  });
});
