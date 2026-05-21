"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCartCount } from "@/lib/cart";

export function CartIcon({ slug }: { slug: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getCartCount(slug));
    const onChange = () => setCount(getCartCount(slug));
    window.addEventListener("sproutly-cart-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("sproutly-cart-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [slug]);

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
