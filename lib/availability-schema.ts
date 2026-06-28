// 把商品庫存數，轉成 schema.org Offer 的 availability 值。
//
// 為什麼集中到這裡：這條「賣完 / 所剩不多 / 有貨」三段式判斷，原本在商品詳情頁
// （offers.availability）和逛街頁的 ItemList（每筆商品的 offers.availability）各抄一份，
// 兩邊得手動維持一致——改一處忘了另一處，餵給 Google 的庫存標示就會兩頁對不上。
// 跟 format-price 的 priceForSchema / currencyForSchema 同樣是「Offer 欄位正規化」，
// 集中成一份，整站庫存標示才會一致。
//
// 規則（對應客人在頁面卡片上看到的提示）：
//   沒設庫存（null／undefined）／量足   → InStock（常備品，不顯示剩餘量）
//   賣完（≤ 0，含資料怪掉的負數）       → OutOfStock
//   剩 1-3 件                           → LimitedAvailability（卡片上亮「剩 N」琥珀提示）
//
// LOW_STOCK_THRESHOLD 跟頁面 UI 的「Low Stock · 剩 N」門檻是同一個數字（3）；
// 之所以放這裡導出，是讓結構化資料這端有個具名來源，不再到處散落魔術數字 3。
export const LOW_STOCK_THRESHOLD = 3;

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";
const LIMITED_AVAILABILITY = "https://schema.org/LimitedAvailability";

export function availabilityForSchema(
  stock: number | null | undefined
): string {
  if (stock === null || stock === undefined) return IN_STOCK;
  if (stock <= 0) return OUT_OF_STOCK;
  if (stock <= LOW_STOCK_THRESHOLD) return LIMITED_AVAILABILITY;
  return IN_STOCK;
}
