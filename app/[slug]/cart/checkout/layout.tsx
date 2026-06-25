import type { Metadata } from "next";

// 購物車結帳頁是 client component，沒辦法自己 export metadata；
// 用這層 layout 把分頁標題從父層的「購物車」蓋成「結帳」。
// noindex 仍由 cart/layout 繼承下來，這裡不必重設。
export const metadata: Metadata = {
  title: "結帳",
};

export default function CartCheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
