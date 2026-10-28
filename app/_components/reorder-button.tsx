"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart";
import { CART_MAX_LINES } from "@/lib/cart-payload";

// 「再買一次」：把一筆舊訂單的品項按原數量加回這家店的購物車，直接帶去購物車頁。
// 回購是小店的常態（介質、耗材、送禮再送一份），原本客人只能對著舊訂單
// 一項一項回商品頁重加。品項對回現役商品靠下單當下記的 product_id：
// 已被商家刪除的（product_id 是 null）由 server 端先濾掉不會傳進來；
// 已下架的加了也無妨——購物車頁抓商品資料時會自動清掉對不上的項目，
// 售完／庫存不足則由結帳後端逐項擋下並講清楚是哪一件，這裡不重複把關。
// 數量沿用原訂單，跟車內既有的同商品合併時吃 addToCart 的上限夾制。
// 車裡已有 CART_MAX_LINES 種時 addToCart 不收新的一種。以前這裡照樣跳去購物車，
// 客人看不出有幾項沒加進去；現在有被略過就留在原頁講清楚、給一條去購物車的路。
// 兩個放這顆按鈕的地方都是 flex-wrap，提示用 basis-full 自己佔一行。
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
  // 跳轉前的空檔連點兩下會把整單加兩份，加過一次就鎖住；
  // 有品項被略過時也維持鎖住，已加進去的那些不能再加一次
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState(0);

  function reorder() {
    if (busy) return;
    setBusy(true);
    let missed = 0;
    for (const it of items) {
      if (!addToCart(slug, it.productId, it.qty)) missed++;
    }
    if (missed > 0) {
      setSkipped(missed);
      return;
    }
    router.push(`/${slug}/cart`);
  }

  const notice =
    skipped > 0
      ? `購物車最多放 ${CART_MAX_LINES} 種商品，這張訂單有 ${skipped} 種沒加進去，請先結帳或移除一些`
      : "";

  return (
    <>
      <button
        type="button"
        onClick={reorder}
        // 用 aria-disabled 不用 disabled：真的停用的話焦點會在跳轉前的空檔掉到頁面最上面，
        // 重複點擊由 reorder() 開頭的 busy 擋掉；.sproutly-btn 的淡化樣式兩種都認
        aria-disabled={busy}
        className={className}
      >
        {skipped > 0 ? "已加入部分品項" : busy ? "加入中…" : "再買一次"}
      </button>
      {/* 報讀格常駐才念得到（跟加入購物車鈕同一套）；看得到的提示只在有略過時才掛，
          平常不佔版面。 */}
      <span className="sr-only" role="status" aria-live="polite">
        {notice}
      </span>
      {notice && (
        <p
          className="basis-full text-[0.75rem]"
          style={{ letterSpacing: "0.04em", lineHeight: 1.6 }}
        >
          {notice}。
          <Link href={`/${slug}/cart`} className="underline">
            去購物車
          </Link>
        </p>
      )}
    </>
  );
}
