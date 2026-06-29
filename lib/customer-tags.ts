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
