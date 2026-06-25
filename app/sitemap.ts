import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTheme } from "@/app/[slug]/_theme";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://sproutly-drab.vercel.app";

// shop 對每間已發布店家都在；about / contact 是條件頁，商家關掉對應區段時
// 頁面本身會 notFound（about 看 about/faq，contact 看 contact/hours），
// 跟 layout nav 同一組判斷。sitemap 必須照著走，否則會列出 404 網址，
// Google Search Console 會把它當 sitemap 錯誤回報。

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  const { data: stores } = await supabase
    .from("sproutly_merchants")
    .select("id, slug, updated_at, theme")
    .eq("is_published", true);

  if (!stores || stores.length === 0) return entries;

  for (const store of stores) {
    const storeLastModified = store.updated_at
      ? new Date(store.updated_at)
      : now;

    const theme = resolveTheme(store.theme);

    // 把店面主視覺帶進 sitemap，Google 圖片搜尋能一起收這張首圖
    const heroUrl = theme.heroUrl;

    entries.push({
      url: `${BASE_URL}/${store.slug}`,
      lastModified: storeLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
      ...(heroUrl ? { images: [heroUrl] } : {}),
    });

    const subRoutes = ["shop"];
    if (theme.sections.about || theme.sections.faq) subRoutes.push("about");
    if (theme.sections.contact || theme.sections.hours) subRoutes.push("contact");

    for (const sub of subRoutes) {
      entries.push({
        url: `${BASE_URL}/${store.slug}/${sub}`,
        lastModified: storeLastModified,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  const storeBySlug = new Map(stores.map((s) => [s.id, s.slug]));

  const { data: products } = await supabase
    .from("sproutly_products")
    .select("id, merchant_id, updated_at, image_urls")
    .eq("is_active", true)
    .in(
      "merchant_id",
      stores.map((s) => s.id)
    );

  if (products) {
    for (const product of products) {
      const slug = storeBySlug.get(product.merchant_id);
      if (!slug) continue;
      // 商品照片一併進 sitemap，Google 才知道每個商品頁有哪幾張圖可收錄
      const images = Array.isArray(product.image_urls)
        ? product.image_urls.filter(
            (u): u is string => typeof u === "string" && u.length > 0
          )
        : [];
      entries.push({
        url: `${BASE_URL}/${slug}/products/${product.id}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.7,
        ...(images.length > 0 ? { images } : {}),
      });
    }
  }

  return entries;
}
