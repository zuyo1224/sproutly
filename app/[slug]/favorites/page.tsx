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

const FAVORITES_KEY = "sproutly_favorites";

function readFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string");
  } catch {
    /* ignore */
  }
  return [];
}

export default function FavoritesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ids = readFavoriteIds();
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

  // 別處（商品頁愛心、其他分頁）取消收藏時，這頁即時跟著移除，不用重整
  useEffect(() => {
    const sync = () => {
      const favs = new Set(readFavoriteIds());
      setProducts((prev) => (prev ? prev.filter((p) => favs.has(p.id)) : prev));
    };
    window.addEventListener("sproutly-favorites-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sproutly-favorites-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  function removeFavorite(id: string) {
    try {
      const next = readFavoriteIds().filter((x) => x !== id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      // 通知 nav 收藏數與其他分頁；本頁的 sync effect 也會接到並移除卡片
      window.dispatchEvent(new Event("sproutly-favorites-changed"));
    } catch {
      /* ignore */
    }
  }

  const count = products?.length ?? 0;

  return (
    <main className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <header className="mb-16 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.4em",
          }}
        >
          Wishlist
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          我的收藏
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
            : count === 0
            ? "這裡會放你想留下來慢慢看的植物"
            : `${count} 株植物在等你`}
        </p>
      </header>

      {products === null ? (
        <div
          className="grid grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-16"
          aria-hidden
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="opacity-50">
              <div
                className="aspect-square rounded-2xl"
                style={{
                  background:
                    "var(--store-surface, rgba(0,0,0,0.04))",
                }}
              />
              <div
                className="mt-5 h-4 w-3/4 rounded"
                style={{
                  background:
                    "var(--store-surface, rgba(0,0,0,0.04))",
                }}
              />
              <div
                className="mt-2 h-3 w-1/3 rounded"
                style={{
                  background:
                    "var(--store-surface, rgba(0,0,0,0.04))",
                }}
              />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
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
            還沒有
            <br />
            收藏的植物
          </p>
          <p
            className="mt-5 text-[0.9375rem]"
            style={{
              color: "var(--store-text-muted, rgba(0,0,0,0.6))",
              lineHeight: 1.7,
            }}
          >
            逛逛 shop，遇到想留下來慢慢看的，按愛心收進這裡。
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-16">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/${slug}/products/${p.id}`}
              className="sproutly-card"
            >
              <div className="sproutly-card-image aspect-square relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFavorite(p.id);
                  }}
                  aria-label={`從收藏移除 ${p.name}`}
                  title="從收藏移除"
                  className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-stone-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-stone-900 active:scale-90"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
                {p.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_urls[0]}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background:
                        "var(--store-surface, rgba(0,0,0,0.04))",
                    }}
                  >
                    <span
                      className="text-[0.6875rem] uppercase"
                      style={{ opacity: 0.4, letterSpacing: "0.4em" }}
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
              <p
                className="sproutly-card-meta mt-1 text-sm"
                style={{
                  color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                }}
              >
                {formatPrice(p.price_cents, p.currency)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
