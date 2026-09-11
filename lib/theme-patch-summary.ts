// AI 助手回來的 theme patch 要用人話列成「改了什麼」給商家看，好讓他決定要不要按
// 「套用」。兩個介面各抄了一份幾乎相同的邏輯：設定頁的 ai-edit-panel 用長標籤
// （Hero 樣式／Hero Eyebrow／Section 順序…）、編輯器 popover 的 editor-ai-chat 版面窄，
// 用短標籤（Hero／Eyebrow／順序…）。兩邊的欄位順序、判斷方式、截字都一樣，只差
// 標籤文字與截字長度，所以收成一支：邏輯在這裡，標籤與長度由呼叫端帶進來。
//
// 原本編輯器那份漏了 heroImageSide 那行：商家在編輯器說「圖放左邊」，API 回的 patch
// 只有 layout.heroImageSide，摘要卻寫「（沒解析到欄位）」，旁邊還是有「套用」鈕，
// 按下去圖其實會換邊。收成一支之後兩邊列的欄位一定一樣，這種漏行不會再發生。

import { truncateText } from "./truncate-text.ts";

// 跟 app/api/ai-edit/route.ts 系統提示裡列給模型的欄位對齊。
export type ThemePatch = {
  primary?: string;
  accent?: string;
  tagline?: string;
  layout?: {
    heroStyle?: string;
    heroEyebrow?: string;
    heroSubtitle?: string;
    heroImageSide?: string;
    sectionOrder?: string[];
  };
  homepage?: {
    promise?: string;
    collectionsIntro?: string;
    visitTitle?: string;
  };
};

export type ThemePatchLabels = {
  primary: string;
  accent: string;
  tagline: string;
  heroStyle: string;
  heroEyebrow: string;
  heroSubtitle: string;
  heroImageSide: string;
  sectionOrder: string;
  promise: string;
  collectionsIntro: string;
  visitTitle: string;
  // patch 是物件但一個認得的欄位都沒有時顯示的那句
  empty: string;
};

// 設定頁 AI 助手 panel：版面寬，標籤寫全
export const FULL_PATCH_LABELS: ThemePatchLabels = {
  primary: "主色",
  accent: "Accent",
  tagline: "Tagline",
  heroStyle: "Hero 樣式",
  heroEyebrow: "Hero Eyebrow",
  heroSubtitle: "Hero 副標",
  heroImageSide: "Hero 圖位置",
  sectionOrder: "Section 順序",
  promise: "Promise",
  collectionsIntro: "選物 intro",
  visitTitle: "Visit 標題",
  empty: "（沒解析到要改的欄位）",
};

// 編輯器 popover：版面窄，標籤縮短
export const COMPACT_PATCH_LABELS: ThemePatchLabels = {
  primary: "主色",
  accent: "Accent",
  tagline: "Tagline",
  heroStyle: "Hero",
  heroEyebrow: "Eyebrow",
  heroSubtitle: "副標",
  heroImageSide: "圖位置",
  sectionOrder: "順序",
  promise: "Promise",
  collectionsIntro: "選物 intro",
  visitTitle: "Visit",
  empty: "（沒解析到欄位）",
};

export const NO_PATCH_TEXT = "（無變動）";

// 顏色／樣式這種短值有值才列（空字串當沒改）；商家自己寫的文案（tagline、promise…）
// 是「有給就列」，空字串也算一個變動（他可能就是要清掉），所以判 !== undefined。
export function summarizeThemePatch(
  patch: ThemePatch | undefined,
  labels: ThemePatchLabels,
  maxLen: number,
): string {
  if (!patch || typeof patch !== "object") return NO_PATCH_TEXT;
  const lines: string[] = [];
  const text = (label: string, value: string) =>
    lines.push(`${label} → ${truncateText(value, maxLen)}`);

  if (patch.primary) lines.push(`${labels.primary} → ${patch.primary}`);
  if (patch.accent) lines.push(`${labels.accent} → ${patch.accent}`);
  if (patch.tagline !== undefined) text(labels.tagline, patch.tagline);
  if (patch.layout?.heroStyle)
    lines.push(`${labels.heroStyle} → ${patch.layout.heroStyle}`);
  if (patch.layout?.heroEyebrow !== undefined)
    text(labels.heroEyebrow, patch.layout.heroEyebrow);
  if (patch.layout?.heroSubtitle !== undefined)
    text(labels.heroSubtitle, patch.layout.heroSubtitle);
  if (patch.layout?.heroImageSide)
    lines.push(`${labels.heroImageSide} → ${patch.layout.heroImageSide}`);
  if (patch.layout?.sectionOrder?.length)
    lines.push(`${labels.sectionOrder} → ${patch.layout.sectionOrder.join(",")}`);
  if (patch.homepage?.promise !== undefined)
    text(labels.promise, patch.homepage.promise);
  if (patch.homepage?.collectionsIntro !== undefined)
    text(labels.collectionsIntro, patch.homepage.collectionsIntro);
  if (patch.homepage?.visitTitle !== undefined)
    text(labels.visitTitle, patch.homepage.visitTitle);
  if (lines.length === 0) return labels.empty;
  return lines.join("\n");
}
