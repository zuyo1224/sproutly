// 訂單篩選參數（狀態／付款／時間／搜尋）解析單一來源。
//
// 訂單後台的「列表頁」與「匯出 CSV」是同一批訂單的兩個出口，匯出要等於眼前所見。
// 原本兩處各寫一套白名單：列表頁拿 chip 清單用 find/some 比、匯出 route 另抄
// VALID_STATUS／VALID_PAY／VALID_RANGE 用 includes 比，「有沒有篩選」的判斷也各寫一次。
// 日後有人只在一邊加一個時間區間（例如「近 30 天」），就會變成列表篩得出、匯出悄悄退回
// 全部。收成這支後兩個出口吃同一份解析，不在白名單的值一律當「全部」。

import { ORDER_STATUSES, PAYMENT_STATUSES } from "./order-labels.ts";

// 時間區間的中文標籤，順序即列表頁 chip 順序；「all」不在這裡，它是退回值。
// 白名單（ORDER_RANGE_KEYS）從這份衍生：原本列表頁 chip 另寫一份 key，加一個區間要兩邊
// 各改，漏改一邊就是 chip 點得到、解析卻退回全部（或反過來白名單有、畫面沒按鈕）。
export const ORDER_RANGE_LABELS: Record<string, string> = {
  today: "今天",
  week: "本週",
  month: "本月",
};

export const ORDER_RANGE_KEYS: string[] = Object.keys(ORDER_RANGE_LABELS);

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

// 篩選接回網址的查詢字串（「全部」與空搜尋不帶）。列表頁的狀態／時間／付款 chip、
// 匯出連結、快速動作跳回的列表原本各手組一份 URLSearchParams（五份），加一個篩選維度
// 就得改五處，漏一處就是點了某個 chip 另一維篩選悄悄掉了。參數順序照原本
// status → q → range → pay，網址逐字不變。
export function orderFilterQuery(f: OrderFilters): string {
  const sp = new URLSearchParams();
  if (f.status !== "all") sp.set("status", f.status);
  if (f.q) sp.set("q", f.q);
  if (f.range !== "all") sp.set("range", f.range);
  if (f.pay !== "all") sp.set("pay", f.pay);
  return sp.toString();
}
