// 「把一個數夾進 [min, max]」——lib 底下八支各自命名的 clamp（Hero 縮放、字體倍率、
// 精選張數、自由定位座標、split 照片比、預覽框比、商品數量）以前每支都自己手寫一遍
// Math.max(min, Math.min(max, v)) 或反過來的 Math.min(max, Math.max(min, v))，
// 同一件事兩種寫法散在三個檔；日後想改夾法（例如 NaN 要回 min 而不是 NaN）
// 得八處一起改。收成這一支，各命名 clamp 只剩「帶哪組 MIN／MAX」這一件事。
//
// 行為跟原本手寫的逐字相同（min ≤ max 時兩種寫法結果一樣）：v 是 NaN 進來還是 NaN
// 出去、±Infinity 夾到邊界。有沒有先確認是有限數、要不要先 Math.floor，仍由各呼叫端
// 自己決定（見 is-finite-number.ts、product-quantity.ts）。
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
