// CSV 組檔：兩個匯出 route（客人匯出、訂單匯出）原本各抄一份逐字相同的轉義、
// 接列、BOM 與下載檔頭，收成這裡的單一來源。日後想改規則（例如改分隔符）只動一處。
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

// 一列：每格跳脫後用逗號接起來。
export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvEscape).join(",");
}

// 整份檔：開頭補 UTF-8 BOM（Excel 開中文才不會亂碼），列與列之間用 CRLF。
// 兩個匯出 route 以前各自寫一次這兩個細節，漏一個 Excel 那邊就是整片亂碼。
export function csvDocument(rows: readonly string[]): string {
  return "\uFEFF" + rows.join("\r\n");
}

// 匯出檔名：「店名-種類-日期[-篩選].csv」。日期由呼叫端給（台灣時區 date key），
// 篩選過的加註「-篩選」，避免商家把只搜到的那一批誤當成全部。兩支匯出 route 共用。
export function csvExportFilename(
  storeName: string,
  kind: "customers" | "orders",
  dateKey: string,
  filtered: boolean,
): string {
  return `${storeName}-${kind}-${dateKey}${filtered ? "-篩選" : ""}.csv`;
}

// 下載用的檔頭。檔名含店名（中文），filename* 要走 RFC 5987 的 UTF-8 百分比編碼。
export function csvDownloadHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };
}
