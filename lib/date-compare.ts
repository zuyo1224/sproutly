// 依 ISO 時間字串排序的比較器單一來源。
// 客人列表頁與匯出 CSV 原本各自 inline 同一組 `new Date(a).getTime() - new Date(b).getTime()`，
// 散在「訂單依 created_at 升 / 客人依 firstOrderAt 升 / 依 lastOrderAt 降」三處，兩檔逐字相同。
// 收成這裡，升降序只剩一處定義；呼叫端傳兩個 ISO 字串，輸出與原本逐字不變。

/** 舊到新（升序）。 */
export function compareIsoAsc(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

/** 新到舊（降序）。 */
export function compareIsoDesc(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}
