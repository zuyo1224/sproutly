"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRecentProducts,
  rememberProduct,
  type RecentProduct,
} from "@/lib/recent-products";

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

// 商品詳情頁底部的「最近看過」一排。進到某株商品時，先讀出之前看過的清單拿來顯示
// （自然排除當前這株），再把當前這株記進去供之後別頁顯示。整段純 client，localStorage
// 沒紀錄就整段不出現，不影響第一次逛店的人。
export function RecentlyViewed({
  slug,
  current,
  colors,
}: {
  slug: string;
  current: Omit<RecentProduct, "viewedAt">;
  colors: {
    text: string;
    textMuted: string;
    accent: string;
    surface: string;
    bg: string;
  };
}) {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    const prior = getRecentProducts(slug).filter((p) => p.id !== current.id);
    setItems(prior.slice(0, 4));
    rememberProduct(slug, current);
    // 只在切換到不同商品時跑一次（current 物件每次 render 都是新的，靠 id 收斂）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, current.id]);

  if (items.length === 0) return null;

  return (
    <section className="mt-24">
      <div className="mb-14">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{ color: colors.accent, letterSpacing: "0.4em" }}
        >
          Recently Viewed
        </p>
        <h2
          className="mt-4 text-2xl sm:text-3xl"
          style={{
            color: colors.text,
            fontFamily: "var(--store-font)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          你最近看過
        </h2>
        <div
          className="mt-4 h-px w-10"
          style={{ background: colors.accent, opacity: 0.4 }}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/${slug}/products/${p.id}`}
            className="group block"
          >
            <div
              className="aspect-square rounded-2xl overflow-hidden transition relative"
              style={{
                background: colors.surface,
                boxShadow: "var(--sproutly-elev-2)",
              }}
            >
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: colors.bg }}
                >
                  <span
                    className="text-[0.625rem] uppercase font-medium"
                    style={{
                      color: colors.textMuted,
                      opacity: 0.45,
                      letterSpacing: "0.3em",
                    }}
                  >
                    No Image
                  </span>
                </div>
              )}
            </div>
            <h3
              className="mt-4 line-clamp-1 group-hover:opacity-70 transition"
              style={{
                color: colors.text,
                fontFamily: "var(--store-font)",
                fontWeight: 500,
                letterSpacing: "-0.005em",
              }}
            >
              {p.name}
            </h3>
            <p
              className="mt-1.5 text-[0.9375rem] tabular-nums"
              style={{
                color: colors.accent,
                fontFamily: "var(--store-font)",
                letterSpacing: "-0.01em",
              }}
            >
              {formatPrice(p.priceCents, p.currency)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
