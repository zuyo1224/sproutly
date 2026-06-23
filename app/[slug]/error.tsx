"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  useEffect(() => {
    console.error("Sproutly storefront error:", error);
  }, [error]);

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
          Something went wrong
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
          這頁暫時
          <br />
          打不開
        </h1>
        <p
          className="mx-auto max-w-md"
          style={{
            color: "var(--store-text-muted)",
            fontSize: "0.9375rem",
            lineHeight: 1.7,
          }}
        >
          載入時遇到一點小問題，
          <br />
          重新試一次通常就會好。
        </p>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={reset}
          className="sproutly-btn sproutly-btn-primary sproutly-btn-lg"
        >
          再試一次
        </button>
        {/* 客人逛到一半遇到錯誤，最該回得去的是「這家店」，不是 Sproutly 平台首頁。
            沿用 not-found 的 useParams 取 slug，把人帶回店家而不是丟到平台行銷頁。 */}
        {slug && (
          <Link
            href={`/${slug}`}
            className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg"
          >
            回店家首頁
          </Link>
        )}
      </div>

      {/* 平台逃生門：萬一連 slug 都拿不到（在 layout 之外就出錯），至少還有條路離開。
          slug 拿得到時就退成低調文字連結，不跟回店家首頁搶主動作。 */}
      <div className="mt-8">
        <Link
          href="/"
          className="sproutly-link"
          style={{
            color: "var(--store-text-muted)",
            fontSize: "0.8125rem",
            letterSpacing: "0.02em",
          }}
        >
          回到 Sproutly
        </Link>
      </div>

      {error.digest && (
        <p
          className="mt-10 font-mono uppercase"
          style={{
            color: "var(--store-text-muted)",
            opacity: 0.4,
            fontSize: "0.7rem",
            letterSpacing: "0.32em",
          }}
        >
          ref · {error.digest}
        </p>
      )}
    </main>
  );
}
