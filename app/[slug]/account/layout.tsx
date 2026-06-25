import type { Metadata } from "next";

// 會員中心、登入、訂單歷史都是要登入才看得到的私人頁，絕不能進搜尋結果。
// 用頁面層級 noindex 一次涵蓋 /account 與其下 /account/login、/account/orders。
export const metadata: Metadata = {
  title: "會員中心",
  robots: { index: false, follow: false },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
