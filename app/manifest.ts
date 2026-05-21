import type { MetadataRoute } from "next";

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
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
