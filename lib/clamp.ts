// 「把一個數夾進 [min, max]」——lib 底下八支各自命名的 clamp（Hero 縮放、字體倍率、
// 精選張數、自由定位座標、split 照片比、預覽框比、商品數量）以前每支都自己手寫一遍
// Math.max(min, Math.min(max, v)) 或反過來的 Math.min(max, Math.max(min, v))，
// 同一件事兩種寫法散在三個檔；日後想改夾法（例如 NaN 要回 min 而不是 NaN）
// 得八處一起改。收成這一支，各命名 clamp 只剩「帶哪組 MIN／MAX」這一件事。
//
// 行為跟原本手寫的逐字相同（min ≤ max 時兩種寫法結果一樣）：v 是 NaN 進來還是 NaN
// 出去、±Infinity 夾到邊界。有沒有先確認是有限數、要不要先 Math.floor，仍由各呼叫端
// 自己決定（見 is-finite-number.ts、product-quantity.ts）。
import { isFiniteNumber } from "./is-finite-number.ts";

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// 「守門＋夾值＋預設」三件事一次做：不是有限數（沒填、null、NaN、"1.5" 字串）就回
// fallback，是的話丟給該欄位自己的命名 clamp。公開頁讀 theme jsonb 的 _theme.ts
// resolveLayout（resolveTheme 底下讀 layout 那支）以前有 12 格各自寫一遍 IIFE
// `(() => { const v = l.x; if (!isFiniteNumber(v)) return 預設; return clampX(v); })()`
// ——Hero 縮放 4 格（含三個裝置各自的 fallback 鏈）、Hero 五段文字字級倍率、主標手機版
// （預設是 null）、全站字級倍率、精選張數——同一件事 12 份、每份 5 行。收成這支之後每格
// 一行，只剩「哪個欄位、哪支 clamp、預設是什麼」。
//
// 編輯器存檔那端（actions.ts）不吃這支：那邊「不是有限數」的處理是「整格跳過、不動 DB」
// 而不是「回預設」，語意不同。
export function clampOr<F>(v: unknown, clampFn: (n: number) => number, fallback: F): number | F {
  return isFiniteNumber(v) ? clampFn(v) : fallback;
}
