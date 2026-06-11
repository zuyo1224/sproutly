import type { Metadata } from "next";

// 結帳頁與結帳成功頁屬於交易流程，含客人填的資料，不該進搜尋結果。
// 用頁面層級 noindex 擋住（涵蓋 /checkout/success 子頁），比只靠 robots.txt 牢靠。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
