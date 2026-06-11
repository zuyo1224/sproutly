import type { Metadata } from "next";

// 購物車是客人私人、會變動的暫存頁，沒有被搜尋收錄的價值。
// robots.txt 只是「請別爬」，外部一有連結 Google 照樣可能收錄；
// 這裡用頁面層級的 noindex 真正擋住（連購物車內的 /cart/checkout 子頁一併涵蓋）。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
