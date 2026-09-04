import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/store-schema";

const BASE_URL = siteBaseUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/login",
          "/signup",
          "/auth/",
          "/api/",
          "/*/account",
          "/*/account/",
          "/*/cart",
          "/*/checkout",
          "/*/track",
          "/*/favorites",
          // 店面快搜的 JSON 端點（search-overlay 用 fetch 打，不是頁面）。
          // 沒擋的話爬蟲會把 /店家/search/api?q=… 這種 JSON 網址當頁面收進去；
          // 收藏那支 favorites/api 早被上面 /*/favorites 前綴擋住，這支當初漏了。
          "/*/search/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
