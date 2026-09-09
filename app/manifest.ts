import type { MetadataRoute } from "next";
import { PLATFORM_MANIFEST_ICONS } from "@/lib/platform-icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sproutly · 讓你的小生意發芽",
    short_name: "Sproutly",
    description:
      "為小商家打造的線上店面。商品、訂單、付款，整齊收在你的網址。",
    start_url: "/",
    display: "minimal-ui",
    background_color: "#f0fdf4",
    theme_color: "#10b981",
    // favicon.ico 留著給桌機分頁，但它不能當「加到主畫面」的圖示：Android 的
    // 安裝判定要 192 以上的點陣圖，ico 放大只會糊掉。192／512 那兩張是 app/icon.tsx
    // 在 build 時畫好的。
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      ...PLATFORM_MANIFEST_ICONS,
    ],
  };
}
