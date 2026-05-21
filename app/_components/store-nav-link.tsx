"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 店面 nav 連結 — 從 pathname 判斷 active state，加 aria-current="page" + 視覺強調
 *
 * 比對策略：
 * - 首頁 `/${slug}` 只在 pathname 完全等於 slug 路徑時 active（避免一進 /shop 也亮）
 * - 其他子頁 startsWith 比對（/shop、/shop/abc 都算 shop active）
 */
export function StoreNavLink({
  href,
  label,
  isHome,
  colorMuted,
  colorActive,
}: {
  href: string;
  label: string;
  isHome: boolean;
  colorMuted: string;
  colorActive: string;
}) {
  const pathname = usePathname();
  const active = isHome ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="relative px-3 sm:px-4 py-2 text-sm transition whitespace-nowrap hover:opacity-100"
      style={{
        color: active ? colorActive : colorMuted,
        fontWeight: active ? 500 : 400,
      }}
    >
      {label}
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 left-3 right-3 sm:left-4 sm:right-4 h-px"
          style={{
            background: "currentColor",
            opacity: 0.5,
          }}
        />
      )}
    </Link>
  );
}
