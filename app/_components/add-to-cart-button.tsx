"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addToCart, getCartCount } from "@/lib/cart";

type Props = {
  slug: string;
  productId: string;
  qty?: number;
  /**
   * 若帶入頁面上數量選單（<select> / <input>）的 id，點擊時改讀它的當前值，
   * 而非寫死的 qty。商品頁的數量下拉跟「加入購物車」原本沒接上，
   * 客人選 5 件按加入只會進 1 件，靠這個把選的數量帶進購物車。
   */
  qtyInputId?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export function AddToCartButton({
  slug,
  productId,
  qty = 1,
  qtyInputId,
  className,
  style,
  children,
}: Props) {
  const [added, setAdded] = useState(false);
  // 購物車裡目前共幾件。原本按下「加入」只閃 1.5 秒「✓ 已加入」就消失，
  // 客人加完不知道車在哪、也沒去向（nav 徽章在頁頂很小，視線正盯著底部按鈕），
  // 等於加了卻不知下一步。車裡只要有東西就在按鈕下持續給一條「去購物車」連結。
  const [count, setCount] = useState(0);

  // 掛載先讀一次（可能先前頁面已加過），並跟著購物車變動同步——
  // addToCart / updateQty / remove 都會 dispatch 這個事件，數字才不會過時。
  useEffect(() => {
    const sync = () => setCount(getCartCount(slug));
    sync();
    window.addEventListener("sproutly-cart-changed", sync);
    return () =>
      window.removeEventListener("sproutly-cart-changed", sync);
  }, [slug]);

  function resolveQty() {
    if (!qtyInputId) return qty;
    const el = document.getElementById(qtyInputId) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    const parsed = el ? parseInt(el.value, 10) : NaN;
    // 選單的 option 本來就被 maxQty（庫存上限）約束，這裡只做基本防呆。
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : qty;
  }

  function handleClick() {
    addToCart(slug, productId, resolveQty());
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={className}
        style={style}
      >
        {added ? "✓ 已加入" : children ?? "加入購物車"}
      </button>
      {count > 0 && (
        <Link
          href={`/${slug}/cart`}
          className="block text-center text-[0.8125rem] transition hover:opacity-70"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.04em",
          }}
        >
          去購物車（{count} 件）→
        </Link>
      )}
    </>
  );
}
