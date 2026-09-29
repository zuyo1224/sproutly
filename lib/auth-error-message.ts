// Supabase 登入／註冊錯誤轉成商家、客人看得懂的中文。
//
// Supabase 回來的 error.message 是英文（「Invalid login credentials」這種），
// 原本直接塞進網址的 error 參數顯示在頁面上。先看 code，舊版沒有 code 再比對訊息，
// 都對不上就給一句通用說明，不把英文原文丟給使用者。

type AuthErrorLike = { code?: string | null; message?: string | null; status?: number | null };

const BY_CODE: Record<string, string> = {
  invalid_credentials: "email 或密碼不對，再確認一次",
  email_not_confirmed: "這個 email 還沒完成驗證，請先到信箱點確認信",
  user_not_found: "找不到這個帳號，請確認 email 有沒有打錯",
  user_already_exists: "這個 email 已經註冊過了，請直接登入",
  email_exists: "這個 email 已經註冊過了，請直接登入",
  email_address_invalid: "email 格式看起來不對，再確認一次",
  weak_password: "密碼太簡單了，請換一組長一點、混合英文和數字的密碼",
  same_password: "新密碼不能跟舊密碼一樣",
  over_email_send_rate_limit: "寄信太頻繁了，請過幾分鐘再試",
  over_request_rate_limit: "嘗試太多次了，請過幾分鐘再試",
  over_sms_send_rate_limit: "嘗試太多次了，請過幾分鐘再試",
  otp_expired: "登入連結已經過期，請重新寄一次",
  signup_disabled: "目前暫停開放註冊",
  user_banned: "這個帳號已被停用，請聯絡管理員",
};

const BY_MESSAGE: Array<[RegExp, string]> = [
  [/invalid login credentials/i, BY_CODE.invalid_credentials],
  [/email not confirmed/i, BY_CODE.email_not_confirmed],
  [/already (been )?(registered|exists)/i, BY_CODE.user_already_exists],
  [/rate limit|too many requests|security purposes/i, BY_CODE.over_request_rate_limit],
  [/password should be|weak password/i, BY_CODE.weak_password],
  [/invalid.*email|email.*invalid/i, BY_CODE.email_address_invalid],
  [/expired/i, BY_CODE.otp_expired],
  [/fetch failed|network|timed? ?out/i, "連線不太穩，請稍後再試"],
];

export const AUTH_ERROR_FALLBACK = "登入服務暫時出了點狀況，請稍後再試";

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return AUTH_ERROR_FALLBACK;
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  const message = error.message ?? "";
  for (const [pattern, text] of BY_MESSAGE) {
    if (pattern.test(message)) return text;
  }
  if (error.status === 429) return BY_CODE.over_request_rate_limit;
  return AUTH_ERROR_FALLBACK;
}
