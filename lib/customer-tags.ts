// 客人分群門檻（VIP / 回購）單一來源。
// VIP = 累計消費達門檻（以最小幣別單位計，例如台幣的「分」，200000 = NT$ 2,000）；
// 回購 = 下單筆數達門檻（2 筆以上）。語意上 VIP 優先於回購：同時符合兩者時只算 VIP
// （列表頁用 isReturning && !isVip 排他、匯出用 else if 排他，兩邊一致）。
//
// 這兩個門檻原本各自硬寫散在客人列表頁多處（表格列、手機卡片、摘要、說明文字）與
// 匯出 CSV 的標籤判定裡，逐處重打 >= 200000 / >= 2；日後要調門檻（例如 VIP 改 NT$ 3,000）
// 得每處同步，漏一處就「列表把他標成 VIP，但匯出的 CSV 沒標」這種同一位客人兩份名單
// 對不上。收成這份，列表與匯出吃同一條門檻。
export const VIP_THRESHOLD_CENTS = 200000;
export const REPEAT_ORDER_THRESHOLD = 2;

export function isVipCustomer(totalCents: number): boolean {
  return totalCents >= VIP_THRESHOLD_CENTS;
}

export function isReturningCustomer(orderCount: number): boolean {
  return orderCount >= REPEAT_ORDER_THRESHOLD;
}

// 一位客人最終掛哪個「排他」分群標籤：VIP 優先於回購（同時符合只算 VIP），都不符合回 null。
// 上面兩個門檻已收成單一來源，但「VIP 蓋過回購」這條優先序原本仍各處 inline——客人列表頁
// 兩處（表格列、手機卡）寫成 isVip / (isReturning && !isVip)、匯出 CSV 寫成 if / else if，
// 三處各自一份排他規則。日後要改優先序、改成兩個標籤都掛、或多一層分群（例如「新客」），
// 得三處同步，漏一處同一位客人在列表與 CSV 就標不一樣。收成這支，三處吃同一條優先序；
// 標籤的顯示字（畫面 VIP / Repeat、CSV 中文 VIP / 回購）與樣式仍由各處自行決定。
// 注意：「會員」是另一條獨立標籤（依 identityType，跟消費金額無關），不走這支。
export type CustomerTier = "vip" | "returning" | null;
export function customerTier(totalCents: number, orderCount: number): CustomerTier {
  if (isVipCustomer(totalCents)) return "vip";
  if (isReturningCustomer(orderCount)) return "returning";
  return null;
}
