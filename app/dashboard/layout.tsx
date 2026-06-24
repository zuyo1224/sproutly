import type { Metadata } from "next";

// 商家後台是要登入才看得到的私人區域，裡面有客人名單、訂單、店面設定與編輯器，
// 絕不能進搜尋結果。robots.txt 只是「請別爬」，外部一有連結 Google 照樣可能收錄；
// 跟 cart／checkout／account 一樣，用頁面層級 noindex 真正擋住——
// 這一層一次涵蓋 /dashboard 與其下 new-store、stores/[slug] 全部子頁。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
