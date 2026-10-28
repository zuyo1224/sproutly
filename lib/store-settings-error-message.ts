// 後台店面設定頁（app/dashboard/stores/[slug]/settings）紅色提醒框能顯示哪些句子。
//
// 設定頁的 ?error= 是任何人都能改的網址參數，以前照原樣顯示在 Sproutly 後台頁上：有人可以
// 做一條 /dashboard/stores/某店/settings?error=店面因違規即將關閉，請加 LINE 客服申訴 的連結
// 傳給商家，商家登入後看到的就像平台自己的提醒。頁面改成只顯示 updateStore（同目錄
// actions.ts）真的會帶回來的句子，其他當沒有提醒。
import { DB_ERROR_TEXTS } from "./db-error-message.ts";
import { STORE_TEXT_LIMIT_ERRORS } from "./new-store-error-message.ts";
import { SOCIAL_LINKS, type SocialLinks } from "./social-links.ts";
import { storeThemeTextLimitError } from "./store-limits.ts";
import {
  IMAGE_UPLOAD_FAILED_ERROR,
  NOT_IMAGE_CONTENT_ERROR,
  UNSUPPORTED_IMAGE_ERROR,
} from "./upload-image-type.ts";

export const STORE_NAME_EMPTY_ERROR = "店名不能空";
export const LOGO_UPLOAD_FALLBACK_ERROR = "標誌上傳失敗，請稍後再試";
export const HERO_UPLOAD_FALLBACK_ERROR = "首屏大圖上傳失敗，請稍後再試";

// storeThemeTextLimitError 一次只回第一個超限欄位，每格各塞一個超長值逐一取出句子
const OVER = "x".repeat(10000);
const EMPTY_SOCIAL = Object.fromEntries(SOCIAL_LINKS.map((s) => [s.key, null])) as SocialLinks;
const EMPTY_THEME_FIELDS = {
  tagline: null,
  heroEyebrow: null,
  heroSubtitle: null,
  collectionsIntro: null,
  collectionItems: [],
  promise: null,
  visitTitle: null,
  businessHours: "",
  faq: "",
  social: EMPTY_SOCIAL,
};
const THEME_TEXT_LIMIT_ERRORS = [
  ...(
    [
      "tagline",
      "heroEyebrow",
      "heroSubtitle",
      "collectionsIntro",
      "promise",
      "visitTitle",
      "businessHours",
      "faq",
    ] as const
  ).map((key) => storeThemeTextLimitError({ ...EMPTY_THEME_FIELDS, [key]: OVER })),
  storeThemeTextLimitError({
    ...EMPTY_THEME_FIELDS,
    collectionItems: [{ title: OVER, subtitle: "" }],
  }),
  storeThemeTextLimitError({
    ...EMPTY_THEME_FIELDS,
    collectionItems: [{ title: "", subtitle: OVER }],
  }),
  ...SOCIAL_LINKS.map((s) =>
    storeThemeTextLimitError({
      ...EMPTY_THEME_FIELDS,
      social: { ...EMPTY_SOCIAL, [s.key]: OVER },
    }),
  ),
];

const KNOWN_TEXTS = new Set<string>(
  [
    STORE_NAME_EMPTY_ERROR,
    ...STORE_TEXT_LIMIT_ERRORS,
    ...THEME_TEXT_LIMIT_ERRORS,
    // 標誌／首屏大圖上傳：uploadImage 丟出的三句，加上非 Error 時的兩句保底
    UNSUPPORTED_IMAGE_ERROR,
    NOT_IMAGE_CONTENT_ERROR,
    IMAGE_UPLOAD_FAILED_ERROR,
    LOGO_UPLOAD_FALLBACK_ERROR,
    HERO_UPLOAD_FALLBACK_ERROR,
    ...DB_ERROR_TEXTS,
  ].filter((t): t is string => Boolean(t)),
);

export function knownStoreSettingsError(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return KNOWN_TEXTS.has(text) ? text : undefined;
}
