// CSV 欄位轉義：兩個匯出 route（客人匯出、訂單匯出）各抄一份逐字相同的函式，
// 收成這裡的單一來源。日後想改轉義規則（例如加 BOM、改分隔符）只動一處。
export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // 開頭是 = + - @ 或 tab/CR 的欄位，Excel／Google 試算表打開時會當成公式跑，
  // 而姓名、備註、商品名這些欄位是客人下單自己填的：填成 =HYPERLINK(...) 或
  // =cmd|... 的「姓名」，商家一開匯出檔就中招。補一個開頭單引號強制當純文字
  // （試算表軟體不會顯示這個引號，OWASP 對 CSV injection 的標準緩解）。
  // 電話 +886… 開頭的 + 也在名單裡，順帶保住它不被 Excel 當算式吃掉。
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  // 含逗號、雙引號、換行 → 包雙引號 + escape 雙引號
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
