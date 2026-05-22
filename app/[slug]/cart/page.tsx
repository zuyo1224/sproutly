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
  const itemCount = itemRows.reduce((s, r) => s + r.qty, 0);

  return (
    <main className="max-w-4xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <header className="mb-16 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.4em",
          }}
        >
          Cart
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          購物車
        </h1>
        <div
          className="mt-5 h-px w-12"
          style={{
            background: "var(--store-accent, currentColor)",
            opacity: 0.5,
          }}
        />
        <p
          className="mt-5 text-[0.9375rem]"
          style={{
            color: "var(--store-text-muted, rgba(0,0,0,0.6))",
            lineHeight: 1.7,
          }}
        >
          {products === null
            ? "整理中⋯"
            : itemRows.length === 0
            ? "這裡會放你準備帶回家的植物"
            : `${itemCount} 件商品 · 結帳前確認一下`}
        </p>
      </header>

      {products === null ? (
        <div className="space-y-8" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-5 pb-8 opacity-50"
              style={{
                borderBottom: "1px solid var(--store-border, rgba(0,0,0,0.08))",
              }}
            >
              <div
                className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 rounded-xl"
                style={{
                  background: "var(--store-surface, rgba(0,0,0,0.04))",
                }}
              />
              <div className="flex-1 min-w-0 space-y-3 pt-2">
                <div
                  className="h-4 w-2/3 rounded"
                  style={{
                    background: "var(--store-surface, rgba(0,0,0,0.04))",
                  }}
                />
                <div
                  className="h-3 w-1/4 rounded"
                  style={{
                    background: "var(--store-surface, rgba(0,0,0,0.04))",
                  }}
                />
                <div
                  className="h-8 w-28 rounded-full mt-2"
                  style={{
                    background: "var(--store-surface, rgba(0,0,0,0.04))",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : itemRows.length === 0 ? (
        <div className="py-16 max-w-md">
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{
              color: "var(--store-accent, currentColor)",
              letterSpacing: "0.4em",
            }}
          >
            Empty
          </p>
          <div
            className="mt-5 h-px w-10"
            style={{
              background: "var(--store-accent, currentColor)",
              opacity: 0.4,
            }}
          />
          <p
            className="mt-6 text-2xl sm:text-3xl font-medium"
            style={{
              fontFamily: "var(--store-font)",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            購物車
            <br />
            還是空的
          </p>
          <p
            className="mt-5 text-[0.9375rem]"
            style={{
              color: "var(--store-text-muted, rgba(0,0,0,0.6))",
              lineHeight: 1.7,
            }}
          >
            去逛逛 shop，遇到合眼緣的，加進來慢慢挑。
          </p>
          <Link
            href={`/${slug}/shop`}
            className="sproutly-link mt-10 inline-block text-[0.75rem] uppercase font-medium"
            style={{ letterSpacing: "0.3em" }}
            data-default-line="true"
          >
            去逛逛 →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {itemRows.map(({ product: p, qty }) => (
              <div
                key={p.id}
                className="flex gap-5 pb-8"
                style={{
                  borderBottom:
                    "1px solid var(--store-border, rgba(0,0,0,0.08))",
                }}
              >
                <Link
                  href={`/${slug}/products/${p.id}`}
                  className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0 overflow-hidden rounded-xl"
                  style={{
                    background: "var(--store-surface, rgba(0,0,0,0.04))",
                  }}
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
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {p.name}
                  </Link>
                  <p
                    className="mt-1 text-sm"
                    style={{
                      color:
                        "var(--store-text-muted, rgba(0,0,0,0.6))",
                    }}
                  >
                    {formatPrice(p.price_cents, p.currency)}
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <div
                      className="inline-flex items-center rounded-full overflow-hidden"
                      style={{
                        border:
                          "1px solid var(--store-border, rgba(0,0,0,0.12))",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => updateQty(slug, p.id, qty - 1)}
                        className="w-8 h-8 transition"
                        style={{
                          color:
                            "var(--store-text-muted, rgba(0,0,0,0.6))",
                        }}
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
                        className="w-8 h-8 transition"
                        style={{
                          color:
                            "var(--store-text-muted, rgba(0,0,0,0.6))",
                        }}
                        aria-label="增加"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(slug, p.id)}
                      className="text-[0.6875rem] uppercase transition hover:opacity-100"
                      style={{
                        letterSpacing: "0.3em",
                        opacity: 0.55,
                        color:
                          "var(--store-text-muted, rgba(0,0,0,0.6))",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className="text-base sm:text-lg tabular-nums"
                    style={{
                      fontFamily: "var(--store-font)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {formatPrice(p.price_cents * qty, p.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <p
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                Total
              </p>
              <div
                className="mt-3 h-px w-10"
                style={{
                  background: "var(--store-accent, currentColor)",
                  opacity: 0.4,
                }}
              />
              <p
                className="mt-4 text-3xl sm:text-4xl tabular-nums"
                style={{
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  color: "var(--store-accent, currentColor)",
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
