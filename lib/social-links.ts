// 店面頁尾社群連結三格（Instagram／Facebook／LINE OA），唯一正本。
//
// 這三格以前抄了三份：設定頁 page.tsx 三個輸入框（表單欄位名＋標籤＋placeholder）、設定頁存檔
// actions.ts 三行 `formStringOrNull(formData, "social_x")`、公開頁 _theme.ts 讀回三行
// `typeof social.x === "string" && social.x ? social.x : null`。多一格要三處一起加；表單欄位名在
// page.tsx 與 actions.ts 各打一次，打錯一邊就是「填了存不進去」。收成一張表：輸入框照表畫、
// 存檔照表讀、讀回照表判。
//
// 讀回只做「是非空字串才收」，不在這裡清洗網址：頁尾真正要不要顯示、要不要補 https:// 是
// contact-href 的 socialUrl 在用的地方判（跟改表前一樣）。
//
// label 是設定頁輸入框標籤（LINE 那格寫 LINE OA，提醒商家填官方帳號）；shortLabel 是店面
// 頁尾顯示字跟超限訊息（「LINE 連結最多 500 個字」）用的短名。以前這組短名在頁尾 layout.tsx
// 跟 store-limits.ts 各抄一份，改成表上第二欄。

import { formStringOrNull } from "./form-fields.ts";

export const SOCIAL_LINKS = [
  {
    key: "instagram",
    formName: "social_instagram",
    label: "Instagram",
    shortLabel: "Instagram",
    placeholder: "https://www.instagram.com/your-store",
  },
  {
    key: "facebook",
    formName: "social_facebook",
    label: "Facebook",
    shortLabel: "Facebook",
    placeholder: "https://www.facebook.com/your-store",
  },
  {
    key: "line",
    formName: "social_line",
    label: "LINE OA",
    shortLabel: "LINE",
    placeholder: "https://line.me/R/ti/p/@xxx",
  },
] as const;

export type SocialKey = (typeof SOCIAL_LINKS)[number]["key"];
export type SocialLinks = Record<SocialKey, string | null>;

/** 設定頁存檔：每格去頭尾空白，空字串收成 null。 */
export function readSocialLinks(formData: FormData): SocialLinks {
  const out = {} as SocialLinks;
  for (const s of SOCIAL_LINKS) out[s.key] = formStringOrNull(formData, s.formName);
  return out;
}

/** 公開頁讀回：jsonb 裡存什麼都不假設是 string；非空字串才收，其他一律 null。 */
export function resolveSocialLinks(raw: Record<string, unknown>): SocialLinks {
  const out = {} as SocialLinks;
  for (const s of SOCIAL_LINKS) {
    const v = raw[s.key];
    out[s.key] = typeof v === "string" && v ? v : null;
  }
  return out;
}
