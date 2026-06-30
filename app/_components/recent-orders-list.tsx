"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecentOrders, type RecentOrder } from "@/lib/recent-orders";

import { formatPrice } from "@/lib/format-price";
import { taipeiDateMonthDay } from "@/lib/format-date";

function formatDate(iso: string) {
  // localStorage 來的字串可能壞掉，先擋掉 Invalid Date 再交給共用格式化（會回空字串）。
  if (Number.isNaN(new Date(iso).getTime())) return "";
  // 台灣時區切日界線跟全站一致（伺服器跑 UTC 也不會差一天），月日版面走共用那支。
  return taipeiDateMonthDay(iso);
}

// 查訂單頁的「這台裝置下過的單」捷徑。掛載後才讀 localStorage
// （避免 SSR/client 渲染不一致），沒有紀錄就什麼都不顯示。
// 點任一筆會把編號＋電話一起帶進查詢，客人不用記也不用重打。
export function RecentOrdersList({ slug }: { slug: string }) {
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);

  useEffect(() => {
    setOrders(getRecentOrders(slug));
  }, [slug]);

  if (!orders || orders.length === 0) return null;

  return (
    <section
      className="rounded-2xl p-7 sm:p-8 mb-10"
      style={{
        background: "var(--store-surface, rgba(0,0,0,0.03))",
        border: "1px solid var(--store-border, rgba(0,0,0,0.08))",
        boxShadow: "var(--sproutly-elev-2)",
      }}
    >
      <p
        className="text-[0.6875rem] uppercase font-medium"
        style={{
          color: "var(--store-accent, currentColor)",
          letterSpacing: "0.4em",
        }}
      >
        Recent · 這台裝置的訂單
      </p>
      <p
        className="mt-3 text-[0.8125rem]"
        style={{
          color: "var(--store-text-muted, rgba(0,0,0,0.6))",
          lineHeight: 1.7,
        }}
      >
        在這台手機或電腦下過、查過的訂單會記在這裡，點一筆直接查進度
      </p>
      <ul
        className="mt-5 divide-y"
        style={{ borderColor: "var(--store-border, rgba(0,0,0,0.08))" }}
      >
        {orders.map((o) => (
          <li
            key={o.shortId}
            style={{
              borderColor: "var(--store-border, rgba(0,0,0,0.08))",
            }}
          >
            <Link
              href={`/${slug}/track?id=${encodeURIComponent(o.shortId)}&phone=${encodeURIComponent(o.phone)}`}
              className="flex items-baseline justify-between gap-4 py-3.5 transition hover:opacity-70"
            >
              <span className="min-w-0">
                <span
                  className="font-mono text-[0.9375rem] font-semibold"
                  style={{ color: "var(--store-text, currentColor)" }}
                >
                  #{o.shortId}
                </span>
                <span
                  className="ml-3 text-[0.8125rem]"
                  style={{
                    color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                  }}
                >
                  {formatDate(o.createdAt)}
                </span>
              </span>
              <span
                className="flex-shrink-0 text-[0.9375rem] tabular-nums"
                style={{ color: "var(--store-text-muted, rgba(0,0,0,0.6))" }}
              >
                {formatPrice(o.totalCents, o.currency)}
                <span
                  aria-hidden="true"
                  className="ml-2"
                  style={{ color: "var(--store-accent, currentColor)" }}
                >
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
