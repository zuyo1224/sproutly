"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function StoreNotFound() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  return (
    <main className="px-6 sm:px-10 py-20 sm:py-28 max-w-2xl mx-auto text-center">
      <div className="space-y-4">
        <p
          className="font-medium uppercase"
          style={{
            color: "var(--store-text-muted)",
            fontSize: "0.6875rem",
            letterSpacing: "0.4em",
          }}
        >
          404 · Not Found
        </p>
        <span
          className="block h-px w-12 mx-auto"
          style={{ background: "var(--store-accent)", opacity: 0.6 }}
          aria-hidden="true"
        />
        <h1
          className="font-medium"
          style={{
            fontSize: "clamp(1.875rem, 5vw, 2.5rem)",
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          這頁
          <br />
          不在店裡
        </h1>
        <p
          className="mx-auto max-w-md"
          style={{
            color: "var(--store-text-muted)",
            fontSize: "0.9375rem",
            lineHeight: 1.7,
          }}
        >
          你找的網址可能拼錯了，
          <br />
          或這件商品已經下架。
        </p>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
        {slug && (
          <Link
            href={`/${slug}`}
            className="sproutly-btn sproutly-btn-primary sproutly-btn-lg"
          >
            回到首頁
          </Link>
        )}
        {slug && (
          <Link
            href={`/${slug}/shop`}
            className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg"
          >
            看所有商品
          </Link>
        )}
      </div>

      {slug && (
        <div
          className="mt-16 pt-10 border-t space-y-4"
          style={{ borderColor: "var(--store-border)" }}
        >
          <p
            className="font-medium uppercase"
            style={{
              color: "var(--store-text-muted)",
              opacity: 0.7,
              fontSize: "0.6875rem",
              letterSpacing: "0.4em",
            }}
          >
            Need Help · 找不到想要的？
          </p>
          <p
            style={{
              fontSize: "0.9375rem",
              lineHeight: 1.7,
              color: "var(--store-text-muted)",
            }}
          >
            <Link
              href={`/${slug}/contact`}
              className="sproutly-link"
              style={{
                color: "var(--store-text)",
                letterSpacing: "0.02em",
              }}
            >
              聯絡店家
            </Link>
            <span className="mx-3" style={{ opacity: 0.4 }}>
              ·
            </span>
            <Link
              href={`/${slug}/track`}
              className="sproutly-link"
              style={{
                color: "var(--store-text)",
                letterSpacing: "0.02em",
              }}
            >
              查詢訂單
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
