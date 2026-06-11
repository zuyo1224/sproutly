"use client";

import { useState } from "react";
import { addToCart } from "@/lib/cart";

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
    <button
      type="button"
      onClick={handleClick}
      className={className}
      style={style}
    >
      {added ? "✓ 已加入" : children ?? "加入購物車"}
    </button>
  );
}
