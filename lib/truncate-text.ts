// 文字太長就截短、尾巴補一個「…」：AI 助手兩個介面（設定頁的 ai-edit-panel、
// 編輯器 popover 的 editor-ai-chat）在「改了什麼」的摘要裡各抄了一份逐字相同的
// trunc，只差預設長度（60／50）。收成一處，兩邊各自把要的長度傳進來。
//
// 長度是「看得到的字」數，不是 JS 字串的 .length：.length 算的是 UTF-16 單位，
// emoji 與一部分罕見漢字（例如 𠮷）佔兩個單位，原本的寫法在那種字正好落在截點時
// 會從中間切開，摘要末尾多出一個問號方塊。用 Array.from 照 code point 切就不會。
// 沒有 emoji 的一般中英文兩種算法結果一模一樣。
export function truncateText(s: string, max: number): string {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return chars.slice(0, max).join("") + "…";
}
