// lib/auth-error-message.ts 的行為固定測試。
//
// 重點是「不管 Supabase 回什麼，頁面上都不會出現英文原文」。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AUTH_ERROR_FALLBACK, authErrorMessage } from "./auth-error-message.ts";

describe("有 code 先看 code", () => {
  it("帳密錯", () => {
    assert.equal(
      authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" }),
      "email 或密碼不對，再確認一次",
    );
  });
  it("寄信太頻繁", () => {
    assert.equal(
      authErrorMessage({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }),
      "寄信太頻繁了，請過幾分鐘再試",
    );
  });
});

describe("沒有 code 就比對訊息", () => {
  it("舊版帳密錯訊息", () => {
    assert.equal(authErrorMessage({ message: "Invalid login credentials" }), "email 或密碼不對，再確認一次");
  });
  it("email 已註冊", () => {
    assert.equal(
      authErrorMessage({ message: "A user with this email address has already been registered" }),
      "這個 email 已經註冊過了，請直接登入",
    );
  });
  it("magic link 冷卻時間", () => {
    assert.equal(
      authErrorMessage({ message: "For security purposes, you can only request this after 42 seconds." }),
      "嘗試太多次了，請過幾分鐘再試",
    );
  });
  it("只有 429 狀態碼", () => {
    assert.equal(authErrorMessage({ message: "", status: 429 }), "嘗試太多次了，請過幾分鐘再試");
  });
});

describe("對不上就給通用中文，不回英文原文", () => {
  it("不認識的錯誤", () => {
    assert.equal(authErrorMessage({ code: "something_new", message: "Database error saving new user" }), AUTH_ERROR_FALLBACK);
  });
  it("null", () => {
    assert.equal(authErrorMessage(null), AUTH_ERROR_FALLBACK);
  });
});
