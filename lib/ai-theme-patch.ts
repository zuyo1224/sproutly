// AI 助手（app/api/ai-edit/route.ts）回來的字串要變成前端能吃的 theme patch，中間
// 兩關：剝掉模型偶爾包的 ```json 圍欄再 JSON.parse、然後把 parse 出來的東西驗成
// ThemePatch 的形狀。以前 route 只做第一關、第二關沒做，parse 出什麼就原樣丟回前端，
// 前端兩個介面（設定頁 ai-edit-panel、編輯器 editor-ai-chat）直接當 ThemePatch 用。
// 模型回 `sectionOrder: "hero,collections"`（字串不是陣列）時摘要那支的 .join 直接炸、
// 回 `heroStyle: "grid"` 時編輯器 as HeroStyle 硬轉就存進去、回 `primary: "red"` 也照收。
// 這裡把「只留認得的欄位、值不合法就丟掉」寫死，route 只回過了這關的東西。
//
// 型別是 ThemePatch（lib/theme-patch-summary）那份，這裡不另開；heroStyle 與 sectionOrder
// 的合法值直接用 lib/theme-keys 那份正本（跟編輯器存檔同口徑：11 個 section，是設定頁
// 6 個的超集）。

import { normalizeHexColor } from "./hex-color.ts";
import { isPlainObject } from "./is-plain-object.ts";
import { isHeroImageSide, isHeroStyle, isSectionKey } from "./theme-keys.ts";
import type { ThemePatch } from "./theme-patch-summary.ts";

// 模型偶爾會把 JSON 包在 ```json … ``` 裡，剝掉再交給 JSON.parse。
export function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

// 商家自己寫的文案：是字串就收（空字串也收，他可能就是要清掉），其餘型別丟掉。
function pickString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// 只留認得的欄位與合法值；整包不是物件回 null（前端沒辦法拿它當 patch）。
// 巢狀 layout / homepage 過濾後一個欄位都不剩就整個不放，免得前端看到空物件。
export function sanitizeThemePatch(input: unknown): ThemePatch | null {
  if (!isPlainObject(input)) return null;
  const out: ThemePatch = {};

  const primary = normalizeHexColor(input.primary);
  if (primary) out.primary = primary;
  const accent = normalizeHexColor(input.accent);
  if (accent) out.accent = accent;
  const tagline = pickString(input.tagline);
  if (tagline !== undefined) out.tagline = tagline;

  if (isPlainObject(input.layout)) {
    const l = input.layout;
    const layout: NonNullable<ThemePatch["layout"]> = {};
    if (isHeroStyle(l.heroStyle)) layout.heroStyle = l.heroStyle;
    const eyebrow = pickString(l.heroEyebrow);
    if (eyebrow !== undefined) layout.heroEyebrow = eyebrow;
    const subtitle = pickString(l.heroSubtitle);
    if (subtitle !== undefined) layout.heroSubtitle = subtitle;
    if (isHeroImageSide(l.heroImageSide)) layout.heroImageSide = l.heroImageSide;
    if (Array.isArray(l.sectionOrder)) {
      const order: string[] = [];
      for (const k of l.sectionOrder) {
        if (isSectionKey(k) && !order.includes(k)) order.push(k);
      }
      if (order.length) layout.sectionOrder = order;
    }
    if (Object.keys(layout).length) out.layout = layout;
  }

  if (isPlainObject(input.homepage)) {
    const h = input.homepage;
    const homepage: NonNullable<ThemePatch["homepage"]> = {};
    const promise = pickString(h.promise);
    if (promise !== undefined) homepage.promise = promise;
    const intro = pickString(h.collectionsIntro);
    if (intro !== undefined) homepage.collectionsIntro = intro;
    const visit = pickString(h.visitTitle);
    if (visit !== undefined) homepage.visitTitle = visit;
    if (Object.keys(homepage).length) out.homepage = homepage;
  }

  return out;
}

export type ParsedAiThemePatch =
  | { ok: true; patch: ThemePatch }
  | { ok: false; reason: "invalid-json" | "not-object"; cleaned: string };

// route 用的一站式：剝圍欄 → parse → 驗形狀。失敗回原因與剝完圍欄的字串（route 拿去
// 截前 300 字放進錯誤訊息給商家看）。
export function parseAiThemePatch(raw: string): ParsedAiThemePatch {
  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: "invalid-json", cleaned };
  }
  const patch = sanitizeThemePatch(parsed);
  if (!patch) return { ok: false, reason: "not-object", cleaned };
  return { ok: true, patch };
}
