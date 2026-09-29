// 資料庫寫入失敗時轉成商家看得懂的中文。
//
// Supabase／Postgres 回來的 error.message 是英文（「duplicate key value violates unique
// constraint ...」「new row violates row-level security policy ...」這種），原本直接塞進
// 網址的 error 參數顯示在後台頁面上。先看 Postgres／PostgREST 的錯誤代號，再比對幾種
// 常見的連線錯誤，都對不上就給一句通用說明，不把英文原文丟給商家。
// 某個動作對某個代號有更貼切的說法（例如開店時網址重複），用 overrides 蓋過去。

type DbErrorLike = { code?: string | null; message?: string | null };

const BY_CODE: Record<string, string> = {
  "23505": "這筆資料跟現有的重複了，換一個再試",
  "23503": "這筆資料還連著其他資料，現在不能這樣改",
  "23502": "有必填的欄位是空的，補上再試",
  "23514": "有欄位的內容不符合規定，再確認一次",
  "22001": "有欄位的內容太長了，縮短一點再試",
  "22P02": "有欄位的格式不對，再確認一次",
  "42501": "沒有權限做這個動作，請重新登入再試",
  PGRST301: "登入狀態過期了，請重新登入再試",
  PGRST303: "登入狀態過期了，請重新登入再試",
};

const BY_MESSAGE: Array<[RegExp, string]> = [
  [/row-level security|permission denied/i, BY_CODE["42501"]],
  [/jwt expired/i, BY_CODE.PGRST301],
  [/fetch failed|network|timed? ?out|ECONNRESET|ENOTFOUND/i, "連線不太穩，請稍後再試"],
];

export const DB_ERROR_FALLBACK = "存檔時出了點狀況，請稍後再試";

export function dbErrorMessage(
  error: DbErrorLike | null | undefined,
  overrides?: Record<string, string>,
): string {
  if (!error) return DB_ERROR_FALLBACK;
  if (error.code && overrides?.[error.code]) return overrides[error.code];
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  const message = error.message ?? "";
  for (const [pattern, text] of BY_MESSAGE) {
    if (pattern.test(message)) return text;
  }
  return DB_ERROR_FALLBACK;
}
