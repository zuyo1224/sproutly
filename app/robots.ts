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
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
