// CSV 欄位轉義：兩個匯出 route（客人匯出、訂單匯出）各抄一份逐字相同的函式，
// 收成這裡的單一來源。日後想改轉義規則（例如加 BOM、改分隔符）只動一處。
export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // 含逗號、雙引號、換行 → 包雙引號 + escape 雙引號
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
