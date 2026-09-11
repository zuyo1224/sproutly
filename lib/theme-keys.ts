// 店面主題兩張「合法值清單」的唯一正本：Hero 四種版型、首頁 11 個 section。
//
// 以前這兩張清單各自手抄了五份：公開頁 _theme.ts 的 type 與 resolveLayout 內的
// validKeys、編輯器 actions.ts 的 HERO_STYLES / SECTION_KEYS、editor-workspace 的
// type 與 SECTION_KEYS_SET 與收 postMessage 那段的 validKeys、設定頁 actions 的
// HERO_STYLES_SET、AI 助手 lib/ai-theme-patch 的兩個 Set。內容目前一致，但日後多一種
// hero 版型或多一個 section 時得五處一起補，漏一處就是「編輯器能選、存檔被濾掉」這種
// 後台看不出來的錯。收成一份，型別也從這裡導出，其他地方只 import。
//
// 放 lib 而不放 _theme.ts：lib 的測試用 node --test 直接跑，不吃 @/ 別名也不能拖進
// _theme.ts 那整包（它 import 了一堆 next 端的東西）；這支零依賴，誰都能 import。

export const HERO_STYLE_KEYS = ["full-image", "split", "minimal", "magazine"] as const;
export type HeroStyle = (typeof HERO_STYLE_KEYS)[number];

export function isHeroStyle(value: unknown): value is HeroStyle {
  return typeof value === "string" && (HERO_STYLE_KEYS as readonly string[]).includes(value);
}

export const SECTION_KEYS = [
  "hero",
  "collections",
  "featured",
  "journal",
  "promise",
  "testimonials",
  "faq",
  "stats",
  "partners",
  "gallery",
  "visit",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === "string" && (SECTION_KEYS as readonly string[]).includes(value);
}

// 基本必要的 6 個 section：商家存的順序裡沒列到的會自動補在後面；testimonials / faq /
// stats / partners / gallery 這五個是商家在編輯器手動加了才出現，不自動補。
export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "hero",
  "collections",
  "featured",
  "journal",
  "promise",
  "visit",
];
