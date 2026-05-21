"use client";

import { useState } from "react";
import { addToCart } from "@/lib/cart";

type Props = {
  slug: string;
  productId: string;
  qty?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export function AddToCartButton({
  slug,
  productId,
  qty = 1,
  className,
  style,
  children,
}: Props) {
  const [added, setAdded] = useState(false);

  function handleClick() {
    addToCart(slug, productId, qty);
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
