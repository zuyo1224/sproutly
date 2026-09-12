// 「這個值是不是一個真的能拿來算的數字」——theme jsonb 讀進來、編輯器送來的 patch
// 裡的 heroZoom／fontScale／featuredCount 這些格子，過了這關才丟給各自的 clamp。
//
// NaN 與 ±Infinity 刻意不算：typeof 都是 "number"，但一路夾進 clamp 會變成
// NaN 樣式或無限大縮放，店面直接壞掉；擋在這裡讓它跟「沒填」一樣走預設值。
// 字串型的 "1.5" 也不算，這裡不做轉型，要轉的呼叫端自己先 Number()。
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
