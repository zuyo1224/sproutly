import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://sproutly-drab.vercel.app";

const STORE_SUBROUTES = ["shop", "about", "contact"] as const;

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
    .select("id, slug, updated_at")
    .eq("is_published", true);

  if (!stores || stores.length === 0) return entries;

  for (const store of stores) {
    const storeLastModified = store.updated_at
      ? new Date(store.updated_at)
      : now;

    entries.push({
      url: `${BASE_URL}/${store.slug}`,
      lastModified: storeLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    });

    for (const sub of STORE_SUBROUTES) {
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
    .select("id, merchant_id, updated_at")
    .eq("is_active", true)
    .in(
      "merchant_id",
      stores.map((s) => s.id)
    );

  if (products) {
    for (const product of products) {
      const slug = storeBySlug.get(product.merchant_id);
      if (!slug) continue;
      entries.push({
        url: `${BASE_URL}/${slug}/products/${product.id}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return entries;
}
