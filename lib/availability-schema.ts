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
import { isSoldOut, LOW_STOCK_THRESHOLD } from "./product-stock";

// LOW_STOCK_THRESHOLD（畫面「剩 N」與這裡 LimitedAvailability 共用的門檻）已移到
// product-stock 跟 isSoldOut/isLowStock 放一起，當缺貨判斷的單一來源。這裡 re-export
// 維持原本的對外 API 不變（曾從 availability-schema 取這個常數的地方不受影響）。
export { LOW_STOCK_THRESHOLD };

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";
const LIMITED_AVAILABILITY = "https://schema.org/LimitedAvailability";

export function availabilityForSchema(
  stock: number | null | undefined
): string {
  if (stock === null || stock === undefined) return IN_STOCK;
  // 「售完」（含超賣／資料壞掉的負數）走 product-stock 的 isSoldOut 同一份判斷，
  // 不在這裡另寫一條 stock <= 0，免得哪天缺貨定義改了兩邊又對不上。
  if (isSoldOut(stock)) return OUT_OF_STOCK;
  if (stock <= LOW_STOCK_THRESHOLD) return LIMITED_AVAILABILITY;
  return IN_STOCK;
}
