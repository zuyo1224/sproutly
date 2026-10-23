import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/store-schema";

const BASE_URL = siteBaseUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 平台頁三條要錨住：robots.txt 規則是「前綴比對」，寫 "/login" 會連店家網址
        // /login-garden、/signup-bakery、/dashboard-coffee 整間店一起擋掉（slug 只保留
        // login 本身，login-garden 是合法店名）。拆成「剛好這個網址（$）／底下子頁（/）／
        // 帶查詢字串（?，例如 /login?error=…）」三種，店家網址就不會被誤擋。
        disallow: [
          "/dashboard$",
          "/dashboard/",
          "/dashboard?",
          "/login$",
          "/login/",
          "/login?",
          "/signup$",
          "/signup/",
          "/signup?",
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
