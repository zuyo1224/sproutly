"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { getCartCount } from "@/lib/cart";

export function CartIcon({ slug }: { slug: string }) {
  // 購物車件數存在瀏覽器的 localStorage 裡，不是 React 自己管的資料。
  // 以前的寫法是「先畫 0，再用 useEffect 補上真正的件數」，等於每次載入都多一次重畫
  // （eslint 的 set-state-in-effect 擋的就是這個）。改用 React 專門對付這種「外部資料」
  // 的 useSyncExternalStore：訂閱同兩個事件、要畫的時候現讀一次。
  // 第三個參數是伺服器端（與剛接手畫面那一下）的值，維持 0，跟以前的起始值一樣，
  // 所以伺服器畫出來的跟瀏覽器第一次畫的仍然對得上。
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("sproutly-cart-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("sproutly-cart-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const count = useSyncExternalStore(
    subscribe,
    () => getCartCount(slug),
    () => 0,
  );

  return (
    <Link
      href={`/${slug}/cart`}
      className="relative inline-flex items-center gap-1.5 px-2 py-2 text-sm transition hover:opacity-70"
      aria-label={`購物車（${count} 件）`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      {count > 0 && (
        <span className="text-xs tabular-nums">{count}</span>
      )}
    </Link>
  );
}
