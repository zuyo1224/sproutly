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
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
}
