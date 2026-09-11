// 把一串字串常數排成 TS 型別字面值的寫法：["a", "b"] → `"a" | "b"`。
//
// 給 AI 助手的 system prompt 用：提示裡那段「可以改的 theme 欄位」是用 ts 程式碼塊
// 寫給模型看的，heroStyle／sectionOrder 的合法值以前是手打進字串裡，跟
// lib/theme-keys 的正本是兩份；日後多一種 hero 版型，程式這邊認得、提示卻沒告訴模型，
// 模型就永遠不會回那個值。改成從同一份清單生成，清單改了提示自動跟上。
export function tsUnionLiteral(values: readonly string[]): string {
  return values.map((v) => JSON.stringify(v)).join(" | ");
}
