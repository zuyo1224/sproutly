// 店面設定頁「顯示哪些區塊」五個開關（關於頁／聯絡資訊／營業時間／FAQ／頁尾社群連結），唯一正本。
//
// 這五格以前抄了三份：設定頁 page.tsx 的 checkbox 清單（表單欄位名＋中文標籤）、設定頁存檔
// actions.ts 五行 `formData.get("section_x") === "on"`、公開頁 _theme.ts 讀回五行
// `sections.x !== false`（社群那格是 `=== true`，預設關）。多一格要三處一起加，預設開／關只在
// 讀回端看得到；表單欄位名在 page.tsx 與 actions.ts 各打一次，打錯一邊就是「勾了存不進去」。
// 收成一張表：checkbox 照表畫、存檔照表讀、讀回照表定預設。
//
// 這五格是「店面子頁／頁尾要不要顯示」，跟 theme-keys 的 SECTION_KEYS（首頁區塊排序）是兩件事。

export const PAGE_SECTION_TOGGLES = [
  { key: "about", formName: "section_about", label: "關於頁", defaultOn: true },
  { key: "contact", formName: "section_contact", label: "聯絡資訊", defaultOn: true },
  { key: "hours", formName: "section_hours", label: "營業時間", defaultOn: true },
  { key: "faq", formName: "section_faq", label: "FAQ", defaultOn: true },
  { key: "social", formName: "section_social", label: "頁尾社群連結", defaultOn: false },
] as const;

export type PageSectionKey = (typeof PAGE_SECTION_TOGGLES)[number]["key"];

/** 設定頁存檔：checkbox 有勾（值是 "on"）就 true，沒勾／沒帶就 false。 */
export function readPageSectionToggles(formData: FormData): Record<PageSectionKey, boolean> {
  const out = {} as Record<PageSectionKey, boolean>;
  for (const t of PAGE_SECTION_TOGGLES) out[t.key] = formData.get(t.formName) === "on";
  return out;
}

/**
 * 公開頁讀回：jsonb 裡存什麼都不假設是 boolean。
 * 預設開的格「沒存 false 就開」（舊資料沒這格照開）；預設關的格「存了 true 才開」。
 */
export function resolvePageSectionToggles(raw: Record<string, unknown>): Record<PageSectionKey, boolean> {
  const out = {} as Record<PageSectionKey, boolean>;
  for (const t of PAGE_SECTION_TOGGLES) {
    out[t.key] = t.defaultOn ? raw[t.key] !== false : raw[t.key] === true;
  }
  return out;
}
