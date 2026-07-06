import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTheme } from "@/app/[slug]/_theme";
import { absoluteImageUrls } from "@/lib/image-url";
import { siteBaseUrl } from "@/lib/store-schema";
// 整批撈店家/商品要分頁撈齊，不然吃 Supabase 1000 列上限，見 fetch-all-rows。
import { fetchAllRows } from "@/lib/fetch-all-rows";

const BASE_URL = siteBaseUrl();

type StoreRow = {
  id: string;
  slug: string;
  updated_at: string | null;
  theme: unknown;
};

type ProductRow = {
  id: string;
  merchant_id: string;
  updated_at: string | null;
  image_urls: string[] | null;
};

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

  // 店家與商品都分頁撈齊（Supabase 一次最多回約 1000 列，超出的會默默
  // 從 sitemap 消失，Google 就收不到那些頁）；用 id 排序讓每頁切點穩定。
  const stores = await fetchAllRows<StoreRow>(async (from, to) =>
    supabase
      .from("sproutly_merchants")
      .select("id, slug, updated_at, theme")
      .eq("is_published", true)
      .order("id", { ascending: true })
      .range(from, to)
  );

  if (stores.length === 0) return entries;

  for (const store of stores) {
    const storeLastModified = store.updated_at
      ? new Date(store.updated_at)
      : now;

    const theme = resolveTheme(store.theme);

    // 把店面主視覺帶進 sitemap，Google 圖片搜尋能一起收這張首圖。
    // image sitemap 的 <image:loc> 規定要絕對網址，heroUrl 是商家在後台填的，
    // 可能是相對路徑或一串空白，先用同一條「只放絕對網址」的防呆濾過。
    const heroImages = absoluteImageUrls([theme.heroUrl]);

    entries.push({
      url: `${BASE_URL}/${store.slug}`,
      lastModified: storeLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
      ...(heroImages.length > 0 ? { images: heroImages } : {}),
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

  // 店家 id 每 100 筆一批下 in()（全塞一個 in() 會讓查詢網址過長，
  // 跟訂單匯出撈品項同一套切法），每批各自分頁撈齊。
  const products: ProductRow[] = [];
  const storeIds = stores.map((s) => s.id);
  for (let i = 0; i < storeIds.length; i += 100) {
    const batchIds = storeIds.slice(i, i + 100);
    const batch = await fetchAllRows<ProductRow>(async (from, to) =>
      supabase
        .from("sproutly_products")
        .select("id, merchant_id, updated_at, image_urls")
        .eq("is_active", true)
        .in("merchant_id", batchIds)
        .order("id", { ascending: true })
        .range(from, to)
    );
    products.push(...batch);
  }

  for (const product of products) {
    const slug = storeBySlug.get(product.merchant_id);
    if (!slug) continue;
    // 商品照片一併進 sitemap，Google 才知道每個商品頁有哪幾張圖可收錄。
    // 跟 Product JSON-LD／OG image 同一條防呆：只放清乾淨的絕對網址，
    // 混進的空白列或相對路徑不放進 <image:loc>，免得整筆 sitemap image 失效。
    const images = absoluteImageUrls(product.image_urls);
    entries.push({
      url: `${BASE_URL}/${slug}/products/${product.id}`,
      lastModified: product.updated_at ? new Date(product.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.7,
      ...(images.length > 0 ? { images } : {}),
    });
  }

  return entries;
}
