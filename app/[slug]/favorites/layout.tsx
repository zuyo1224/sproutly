import type { Metadata } from "next";

// 收藏頁是客人個人化、存在瀏覽器的清單，內容因人而異，沒有收錄價值。
// 頁面層級 noindex 比只靠 robots.txt 牢靠。
export const metadata: Metadata = {
  title: "收藏",
  robots: { index: false, follow: false },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
