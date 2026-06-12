"use client";

import { useEffect } from "react";
import { rememberOrder } from "@/lib/recent-orders";

// 不渲染任何東西。掛在訂單成功頁／查單查到時，把這筆訂單記進
// 這台裝置的小抄（lib/recent-orders），之後查訂單頁可以一鍵帶入。
export function RememberOrder({
  slug,
  shortId,
  phone,
  totalCents,
  currency,
  createdAt,
}: {
  slug: string;
  shortId: string;
  phone: string;
  totalCents: number;
  currency: string;
  createdAt: string;
}) {
  useEffect(() => {
    rememberOrder(slug, { shortId, phone, totalCents, currency, createdAt });
  }, [slug, shortId, phone, totalCents, currency, createdAt]);
  return null;
}
