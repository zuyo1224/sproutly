// 開店頁（app/dashboard/new-store）紅色提醒框能顯示哪些句子。
//
// 開店頁的 ?error= 是任何人都能改的網址參數，以前照原樣顯示在 Sproutly 後台頁上：
// 有人可以做一條 /dashboard/new-store?error=帳號即將停用，請加 LINE 客服 的連結傳給商家，
// 商家登入後看到的就像平台自己的提醒。頁面改成只顯示 createStore（同目錄 actions.ts）
// 真的會帶回來的句子，其他當沒有提醒。
import { DB_ERROR_TEXTS } from "./db-error-message.ts";
import { storeTextLimitError } from "./store-limits.ts";
import { RESERVED_STORE_SLUGS, storeSlugError } from "./store-slug.ts";

export const STORE_NAME_REQUIRED_ERROR = "請填店名";

export function storeSlugTakenError(slug: string): string {
  return `網址「${slug}」已被使用，換一個試試`;
}

// storeTextLimitError 一次只回第一個超限欄位，五欄各塞一個超長值逐一取出句子
const OVER = "x".repeat(5000);
const EMPTY_FIELDS = { name: "", description: null, contact_phone: null, contact_email: null, address: null };
const TEXT_LIMIT_ERRORS = (
  ["name", "description", "contact_phone", "contact_email", "address"] as const
).map((key) => storeTextLimitError({ ...EMPTY_FIELDS, [key]: OVER }));

const KNOWN_TEXTS = new Set<string>(
  [
    STORE_NAME_REQUIRED_ERROR,
    ...TEXT_LIMIT_ERRORS,
    // storeSlugError 可能回的每一句（保留字那句逐一列）
    storeSlugError(""),
    storeSlugError("A!"),
    storeSlugError("ab"),
    ...[...RESERVED_STORE_SLUGS].map(storeSlugError),
    ...DB_ERROR_TEXTS,
  ].filter((t): t is string => Boolean(t))
);

// 「網址「xxx」已被使用」的 xxx 是商家剛填的網址，逐一列不完；拆出來確認是合規則的網址，
// 再用同一支函式組一次，組出來一字不差才算數。
const SLUG_TAKEN_RE = /^網址「(.*)」已被使用，換一個試試$/;

export function knownNewStoreError(text: string | undefined): string | undefined {
  if (!text) return undefined;
  if (KNOWN_TEXTS.has(text)) return text;
  const m = SLUG_TAKEN_RE.exec(text);
  if (m && storeSlugError(m[1]) === null && storeSlugTakenError(m[1]) === text) return text;
  return undefined;
}
