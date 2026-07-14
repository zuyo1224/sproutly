"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart";

// 「再買一次」：把一筆舊訂單的品項按原數量加回這家店的購物車，直接帶去購物車頁。
// 回購是小店的常態（介質、耗材、送禮再送一份），原本客人只能對著舊訂單
// 一項一項回商品頁重加。品項對回現役商品靠下單當下記的 product_id：
// 已被商家刪除的（product_id 是 null）由 server 端先濾掉不會傳進來；
// 已下架的加了也無妨——購物車頁抓商品資料時會自動清掉對不上的項目，
// 售完／庫存不足則由結帳後端逐項擋下並講清楚是哪一件，這裡不重複把關。
// 數量沿用原訂單，跟車內既有的同商品合併時吃 addToCart 的上限夾制。
type ReorderItem = { productId: string; qty: number };

export function ReorderButton({
  slug,
  items,
  className,
}: {
  slug: string;
  items: ReorderItem[];
  className?: string;
}) {
  const router = useRouter();
  // 跳轉前的空檔連點兩下會把整單加兩份，加過一次就鎖住
  const [busy, setBusy] = useState(false);

  function reorder() {
    if (busy) return;
    setBusy(true);
    for (const it of items) addToCart(slug, it.productId, it.qty);
    router.push(`/${slug}/cart`);
  }

  return (
    <button
      type="button"
      onClick={reorder}
      disabled={busy}
      className={className}
    >
      {busy ? "加入中…" : "再買一次"}
    </button>
  );
}
