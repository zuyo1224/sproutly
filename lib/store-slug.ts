// 店面網址（slug）的整理與檢查，開新店表單吃這一支。

// app/ 底下的頂層靜態路由段（含 Next 自動掛在根路徑的 metadata 圖），
// 靜態段優先於 [slug]，slug 撞名整間店面會被平台頁蓋掉、永遠打不開。
// 新增頂層頁面要記得加進來；lib/store-slug.test.ts 會掃 app/ 比對漏掉的。
export const RESERVED_STORE_SLUGS: ReadonlySet<string> = new Set([
  "api",
  "auth",
  "dashboard",
  "login",
  "signup",
  "icon",
  "apple-icon",
  "opengraph-image",
  "twitter-image",
]);

export const STORE_SLUG_MIN_LENGTH = 3;
export const STORE_SLUG_MAX_LENGTH = 32;

/** 表單原始值 → 去頭尾空白、轉小寫 */
export function normalizeStoreSlug(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase();
}

/** 檢查整理過的 slug，有問題回錯誤訊息、沒問題回 null（不查資料庫有沒有被佔用） */
export function storeSlugError(slug: string): string | null {
  if (!slug) return "請填店面網址";
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return "店面網址只能小寫英文、數字、連字號（-）";
  }
  if (slug.length < STORE_SLUG_MIN_LENGTH || slug.length > STORE_SLUG_MAX_LENGTH) {
    return `店面網址 ${STORE_SLUG_MIN_LENGTH} 到 ${STORE_SLUG_MAX_LENGTH} 個字`;
  }
  if (RESERVED_STORE_SLUGS.has(slug)) {
    return `網址「${slug}」是系統保留字，換一個試試`;
  }
  return null;
}

/**
 * 網址參數帶來的 slug 能不能直接接進站內路徑。只看字元（小寫英數與連字號），
 * 不看長度與保留字：這裡要擋的是 `../`、`?`、`#`、`/` 這類會改掉路徑結構的東西，
 * 不是重新審一次開店規則，免得規則改過之後舊店的連結被誤擋。
 */
export function isStoreSlugShaped(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^[a-z0-9-]+$/.test(raw);
}
