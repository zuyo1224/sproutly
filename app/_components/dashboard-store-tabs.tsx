"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  label: string;
  href: string;
  badge: number;
  // 報讀器要念的 badge 語意（如「筆待處理」）。沒給就只念數字。
  badgeLabel?: string;
  // 總覽分頁的 href 是店面根路徑，會是其他所有子頁的前綴，
  // 所以只能完全相等才算 active；其餘子頁用 startsWith。
  exact: boolean;
};

/**
 * 後台店面分頁 nav — 從 pathname 標出「商家現在在哪一頁」。
 *
 * 公開店面的 StoreNavLink 早就會高亮當前頁，但後台這排六個分頁長得一模一樣，
 * 商家點進「訂單」後看不出自己在哪。沿用同一套語言：active 時文字加深、加粗，
 * 底部補一條跟 nav 底線重疊的強調線（tab 經典做法），並補 aria-current="page"。
 */
export function DashboardStoreTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 mb-6 border-b border-emerald-100 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`px-4 py-3 text-xs tracking-[0.18em] uppercase rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${
              active
                ? "text-emerald-900 font-semibold border-b-2 border-emerald-700 -mb-px"
                : "text-emerald-900/60 hover:text-emerald-900 hover:bg-emerald-50"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold tracking-normal">
                <span aria-hidden="true">{tab.badge}</span>
                <span className="sr-only">
                  {tab.badgeLabel
                    ? `${tab.badge} ${tab.badgeLabel}`
                    : tab.badge}
                </span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
