"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  image_urls: string[] | null;
};

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export default function FavoritesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let ids: string[] = [];
      try {
        const raw = localStorage.getItem("sproutly_favorites");
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) ids = arr.filter((x) => typeof x === "string");
        }
      } catch {
        /* ignore */
      }
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
  }, [slug]);

  return (
    <main className="max-w-5xl mx-auto px-8 sm:px-12 py-32 sm:py-40">
      <h1
        className="text-2xl sm:text-3xl mb-16"
        style={{ fontFamily: "var(--store-font)", fontWeight: 400 }}
      >
        我的收藏
      </h1>
      {products === null ? (
        <p className="text-sm opacity-60">載入中...</p>
      ) : products.length === 0 ? (
        <div className="py-24 text-center">
          <p
            className="text-xs tracking-widest uppercase mb-4"
            style={{ opacity: 0.5 }}
          >
            Empty
          </p>
          <p className="text-base">還沒有收藏的植物。</p>
          <Link
            href={`/${slug}/shop`}
            className="sproutly-link mt-8 inline-block text-sm tracking-wider"
            data-default-line="true"
          >
            去逛逛
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-16">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/${slug}/products/${p.id}`}
              className="sproutly-card"
            >
              <div className="sproutly-card-image aspect-square">
                {p.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_urls[0]}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-stone-100">
                    <span
                      className="text-xs tracking-widest uppercase"
                      style={{ opacity: 0.4 }}
                    >
                      No Image
                    </span>
                  </div>
                )}
              </div>
              <h3
                className="sproutly-card-title mt-5 text-base line-clamp-1"
                style={{ fontFamily: "var(--store-font)", fontWeight: 400 }}
              >
                {p.name}
              </h3>
              <p className="sproutly-card-meta mt-1 text-sm opacity-70">
                {formatPrice(p.price_cents, p.currency)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
