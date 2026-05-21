"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getCart, updateQty, removeFromCart } from "@/lib/cart";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  stock: number | null;
  image_urls: string[] | null;
};

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export default function CartPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [products, setProducts] = useState<Product[] | null>(null);
  const [cartVersion, setCartVersion] = useState(0);

  const cart = typeof window !== "undefined" ? getCart(slug) : [];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ids = cart.map((c) => c.productId);
      if (ids.length === 0) {
        if (!cancelled) setProducts([]);
        return;
      }
      const res = await fetch(
        `/${slug}/favorites/api?ids=${encodeURIComponent(ids.join(","))}`,
        { cache: "no-store" }
      );
      const data: Product[] = await res.json();
      if (!cancelled) setProducts(data);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartVersion, slug]);

  useEffect(() => {
    const onChange = () => setCartVersion((v) => v + 1);
    window.addEventListener("sproutly-cart-changed", onChange);
    return () =>
      window.removeEventListener("sproutly-cart-changed", onChange);
  }, []);

  const itemRows = (products ?? []).map((p) => ({
    product: p,
    qty: cart.find((c) => c.productId === p.id)?.qty ?? 0,
  }));
  const total = itemRows.reduce(
    (s, r) => s + r.product.price_cents * r.qty,
    0
  );

  return (
    <main className="max-w-4xl mx-auto px-8 sm:px-12 py-32 sm:py-40">
      <h1
        className="text-2xl sm:text-3xl mb-16"
        style={{ fontFamily: "var(--store-font)", fontWeight: 400 }}
      >
        購物車
      </h1>

      {products === null ? (
        <p className="text-sm opacity-60">載入中...</p>
      ) : itemRows.length === 0 ? (
        <div className="py-24 text-center">
          <p
            className="text-xs tracking-widest uppercase mb-4"
            style={{ opacity: 0.5 }}
          >
            Empty
          </p>
          <p className="text-base">購物車是空的。</p>
          <Link
            href={`/${slug}/shop`}
            className="sproutly-link mt-8 inline-block text-sm tracking-wider"
            data-default-line="true"
          >
            去逛逛
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {itemRows.map(({ product: p, qty }) => (
              <div
                key={p.id}
                className="flex gap-5 pb-8 border-b border-stone-200"
              >
                <Link
                  href={`/${slug}/products/${p.id}`}
                  className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 overflow-hidden rounded-xl"
                >
                  {p.image_urls?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_urls[0]}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/${slug}/products/${p.id}`}
                    className="text-lg sm:text-xl block"
                    style={{
                      fontFamily: "var(--store-font)",
                      fontWeight: 400,
                    }}
                  >
                    {p.name}
                  </Link>
                  <p className="mt-1 text-sm opacity-70">
                    {formatPrice(p.price_cents, p.currency)}
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="inline-flex items-center border border-stone-300 rounded-full overflow-hidden">
                      <button
                        type="button"
                        onClick={() => updateQty(slug, p.id, qty - 1)}
                        className="w-8 h-8 hover:bg-stone-100 transition"
                        aria-label="減少"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(slug, p.id, qty + 1)}
                        className="w-8 h-8 hover:bg-stone-100 transition"
                        aria-label="增加"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(slug, p.id)}
                      className="text-xs tracking-wider underline-offset-4 hover:underline opacity-60 hover:opacity-100 transition"
                    >
                      移除
                    </button>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className="text-base sm:text-lg"
                    style={{ fontFamily: "var(--store-font)" }}
                  >
                    {formatPrice(p.price_cents * qty, p.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex items-center justify-between">
            <div>
              <p className="text-xs tracking-widest uppercase opacity-50">
                Total
              </p>
              <p
                className="text-2xl sm:text-3xl mt-1"
                style={{
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                }}
              >
                {formatPrice(total, "TWD")}
              </p>
            </div>
            <Link
              href={`/${slug}/cart/checkout`}
              className="sproutly-btn sproutly-btn-primary sproutly-btn-lg"
            >
              去結帳
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
