import type { Metadata } from "next";

// 購物車是客人私人、會變動的暫存頁，沒有被搜尋收錄的價值。
// robots.txt 只是「請別爬」，外部一有連結 Google 照樣可能收錄；
// 這裡用頁面層級的 noindex 真正擋住（連購物車內的 /cart/checkout 子頁一併涵蓋）。
export const metadata: Metadata = {
  // 分頁標題吃父層 layout 的 `%s · 店名` 樣板，瀏覽器分頁變「購物車 · 店名」，
  // 客人開一堆分頁時分得出哪頁是購物車，不再全是店名。
  title: "購物車",
  robots: { index: false, follow: false },
};

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
