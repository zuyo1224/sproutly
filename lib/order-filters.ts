// 訂單篩選參數（狀態／付款／時間／搜尋）解析單一來源。
//
// 訂單後台的「列表頁」與「匯出 CSV」是同一批訂單的兩個出口，匯出要等於眼前所見。
// 原本兩處各寫一套白名單：列表頁拿 chip 清單用 find/some 比、匯出 route 另抄
// VALID_STATUS／VALID_PAY／VALID_RANGE 用 includes 比，「有沒有篩選」的判斷也各寫一次。
// 日後有人只在一邊加一個時間區間（例如「近 30 天」），就會變成列表篩得出、匯出悄悄退回
// 全部。收成這支後兩個出口吃同一份解析，不在白名單的值一律當「全部」。

import { ORDER_STATUSES, PAYMENT_STATUSES } from "./order-labels.ts";

// 時間區間白名單，順序跟列表頁 chip 一致；「all」不在這裡，它是退回值。
export const ORDER_RANGE_KEYS: string[] = ["today", "week", "month"];

export type OrderFilters = {
  status: string;
  pay: string;
  range: string;
  q: string;
};

type RawOrderFilters = {
  status?: string | null;
  pay?: string | null;
  range?: string | null;
  q?: string | null;
};

function pick(value: string | null | undefined, allowed: string[]): string {
  return value && allowed.includes(value) ? value : "all";
}

export function parseOrderFilters(raw: RawOrderFilters): OrderFilters {
  return {
    status: pick(raw.status, ORDER_STATUSES),
    pay: pick(raw.pay, PAYMENT_STATUSES),
    range: pick(raw.range, ORDER_RANGE_KEYS),
    q: (raw.q ?? "").trim(),
  };
}

export function isOrderFilterActive(f: OrderFilters): boolean {
  return f.status !== "all" || f.pay !== "all" || f.range !== "all" || f.q !== "";
}
