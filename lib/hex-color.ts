// 六碼十六進位色碼（#rrggbb）的驗證與正規化，全站一律走這支。
//
// 以前這條 `/^#[0-9a-fA-F]{6}$/.test(x.trim()) ? x.trim() : 退路` 散在十處各抄一份：
// 設定頁存主色／點綴色、編輯器存 Hero 主副標顏色與各區段底色／文字色、公開頁 _theme
// 解析同樣那幾個顏色欄位。寫法幾乎逐字相同，只差退路型別（有的回 null、有的回
// undefined、有的回呼叫端給的 fallback）。收成一支：日後若要放寬規則（支援三碼
// `#abc`、八碼含透明度 `#rrggbbaa`、或允許不帶 `#`），只動這裡，十處不會一處改一處漏。
//
// 一律先 trim 再驗：使用者貼進來的色碼可能前後帶空白，去掉空白才不會把本來合法的
// 值誤判成非法。存進 DB 的也是 trim 過的乾淨值。
//
// 放寬（商家手打色碼的實際寫法）：編輯器每格顏色旁邊都有一格可以直接打色碼，placeholder
// 寫「例如 #F5F5F5」，但商家從別處抄色碼常常沒帶 #（設計軟體多半只給 F5F5F5）、或抄到
// 三碼簡寫 #FFF，中文輸入法開著打出的是全形「＃ＦＦＦＦＦＦ」。以前這些一律判非法，
// 存檔端安靜跳過、預覽也不變色，商家以為改了，重新整理才發現顏色沒存上。現在：
//   - 全形英數與＃先轉半形
//   - 開頭的 # 可有可無
//   - 三碼 #abc 展開成六碼 #aabbcc（CSS 同樣讀法）
// 輸出一律是 # 開頭六碼，下游（_theme、對比計算、加透明度那段）拿到的格式跟以前一樣。
// 八碼含透明度、rgb()、色名仍不收，不猜。大小寫照原樣保留。
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value
    .trim()
    .replace(/[＃０-９Ａ-Ｆａ-ｆ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const m = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(raw);
  if (!m) return null;
  const digits = m[1];
  if (digits.length === 6) return `#${digits}`;
  return `#${digits.replace(/./g, (c) => c + c)}`;
}
