import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../../_theme";
import { ImageCarousel } from "@/app/_components/image-carousel";
import { FavoriteButton } from "@/app/_components/favorite-button";
import { AddToCartButton } from "@/app/_components/add-to-cart-button";

type Params = Promise<{ slug: string; id: string }>;

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) return {};

  const { data: product } = await supabase
    .from("sproutly_products")
    .select("name, description, image_urls, price_cents, currency")
    .eq("id", id)
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!product) return {};

  const priceLabel = formatPrice(product.price_cents, product.currency);
  const description =
    (product.description ?? "").slice(0, 160) || `${product.name} · ${priceLabel}`;
  const image = product.image_urls?.[0] ?? null;

  return {
    title: `${product.name} · ${priceLabel}`,
    description,
    openGraph: {
      title: `${product.name} · ${priceLabel}`,
      description,
      siteName: store.name,
      type: "website",
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${product.name} · ${priceLabel}`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicProductPage({
  params,
}: {
  params: Params;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  const { data: product } = await supabase
    .from("sproutly_products")
    .select("*")
    .eq("id", id)
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!product) notFound();

  // 同店其他商品（最多 4 個）
  const { data: relatedProducts } = await supabase
    .from("sproutly_products")
    .select("id, name, price_cents, currency, image_urls")
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .neq("id", product.id)
    .order("created_at", { ascending: false })
    .limit(4);

  const images: string[] = product.image_urls ?? [];
  const primaryImage = images[0] ?? null;
  const extraImages = images.slice(1);
  const inStock = product.stock === null || product.stock > 0;
  const maxQty = product.stock !== null ? Math.min(product.stock, 99) : 99;

  const BASE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://sproutly-drab.vercel.app";

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    image: images.length > 0 ? images : undefined,
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: store.name,
    },
    offers: {
      "@type": "Offer",
      url: `${BASE_URL}/${slug}/products/${product.id}`,
      priceCurrency: product.currency,
      price: (product.price_cents / 100).toFixed(2),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: store.name,
      },
    },
  };

  return (
    <main className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <Link
        href={`/${slug}/shop`}
        className="sproutly-link inline-block mb-14 text-[0.6875rem] uppercase font-medium"
        style={{ letterSpacing: "0.3em" }}
      >
        ← Back · 所有商品
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
        <div>
          {images.length > 0 ? (
            <ImageCarousel
              images={images}
              alt={product.name}
              surfaceBg={theme.surface}
            />
          ) : (
            <div
              className="aspect-square rounded-3xl flex items-center justify-center"
              style={{ background: theme.bg }}
            >
              <span
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: theme.textMuted,
                  opacity: 0.5,
                  letterSpacing: "0.3em",
                }}
              >
                No Image
              </span>
            </div>
          )}
        </div>

        <div className="md:pt-4">
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{
              color: "var(--store-accent, currentColor)",
              letterSpacing: "0.4em",
            }}
          >
            Product · {store.name}
          </p>
          <div className="mt-5 flex items-start justify-between gap-4">
            <h1
              className="text-3xl sm:text-4xl lg:text-[2.875rem]"
              style={{
                color: theme.text,
                fontFamily: "var(--store-font)",
                fontWeight: 500,
                letterSpacing: "-0.015em",
                lineHeight: 1.15,
                wordBreak: "keep-all",
                overflowWrap: "break-word",
              }}
            >
              {product.name}
            </h1>
            <FavoriteButton
              productId={product.id}
              size="lg"
              className="flex-shrink-0 mt-1 hover:scale-110"
            />
          </div>
          <div
            className="mt-5 h-px w-12"
            style={{
              background: "var(--store-accent, currentColor)",
              opacity: 0.5,
            }}
          />

          {product.description && (
            <div className="mt-10">
              <p
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                About · 關於這株
              </p>
              <div
                className="mt-5 whitespace-pre-line text-[0.9375rem]"
                style={{
                  color: theme.text,
                  opacity: 0.85,
                  lineHeight: 1.9,
                  letterSpacing: "0.01em",
                  wordBreak: "keep-all",
                  overflowWrap: "break-word",
                }}
              >
                {product.description}
              </div>
            </div>
          )}

          <div
            className="mt-12 pt-8 border-t flex items-end justify-between gap-4 flex-wrap"
            style={{ borderColor: theme.border }}
          >
            <div>
              <p
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                Price · 售價
              </p>
              <p
                className="mt-3 text-3xl sm:text-4xl tabular-nums"
                style={{
                  color: "var(--store-accent, currentColor)",
                  fontFamily: "var(--store-font)",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {formatPrice(product.price_cents, product.currency)}
              </p>
            </div>

            {product.stock !== null && (
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
                style={{
                  background: !inStock
                    ? "rgba(0,0,0,0.04)"
                    : product.stock <= 3
                      ? "rgba(217,119,6,0.08)"
                      : `${theme.accent}14`,
                }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background: !inStock
                      ? "#9CA3AF"
                      : product.stock <= 3
                        ? "#D97706"
                        : theme.accent,
                  }}
                />
                <p
                  className="text-[0.6875rem] uppercase font-medium"
                  style={{
                    color: !inStock
                      ? theme.textMuted
                      : product.stock <= 3
                        ? "#92400E"
                        : theme.text,
                    letterSpacing: "0.3em",
                  }}
                >
                  {!inStock
                    ? "Sold Out"
                    : product.stock <= 3
                      ? `Low Stock · 剩 ${product.stock}`
                      : `In Stock · ${product.stock}`}
                </p>
              </div>
            )}
          </div>

          <form
            action={`/${slug}/checkout`}
            method="GET"
            className="mt-10 space-y-3"
          >
            <input type="hidden" name="product_id" value={product.id} />

            {inStock && (
              <div className="flex items-center gap-3 mb-6">
                <label
                  htmlFor="qty"
                  className="text-[0.6875rem] uppercase font-medium"
                  style={{
                    color: theme.textMuted,
                    letterSpacing: "0.4em",
                  }}
                >
                  Qty · 數量
                </label>
                <select
                  id="qty"
                  name="qty"
                  defaultValue={1}
                  className="sproutly-input text-sm"
                  style={{ width: "auto", padding: "0.5rem 0.75rem" }}
                >
                  {Array.from(
                    { length: maxQty },
                    (_, i) => i + 1
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={!inStock}
              className="sproutly-btn sproutly-btn-primary sproutly-btn-lg w-full"
            >
              {inStock ? "我想要這一株" : "已售完"}
            </button>

            {inStock && (
              <AddToCartButton
                slug={slug}
                productId={product.id}
                qty={1}
                className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg w-full"
              >
                加入購物車
              </AddToCartButton>
            )}

            {store.contact_phone && (
              <a
                href={`tel:${store.contact_phone}`}
                className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg w-full"
              >
                來店看實品
              </a>
            )}
            {store.contact_email && (
              <a
                href={`mailto:${store.contact_email}?subject=${encodeURIComponent("詢問商品：" + product.name)}`}
                className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg w-full"
              >
                Email 詢問
              </a>
            )}
          </form>
        </div>
      </div>

      {/* Mobile sticky buy bar */}
      {inStock && (
        <form
          action={`/${slug}/checkout`}
          method="GET"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch gap-3 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          style={{
            background: theme.surface,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          <input type="hidden" name="product_id" value={product.id} />
          <input type="hidden" name="qty" value="1" />
          <div
            className="flex flex-col justify-center flex-shrink-0"
            style={{ color: theme.text }}
          >
            <span className="text-xs" style={{ color: theme.textMuted }}>
              {product.name.length > 8
                ? product.name.slice(0, 8) + "…"
                : product.name}
            </span>
            <span
              className="text-sm"
              style={{ color: theme.text, fontFamily: "var(--store-font)" }}
            >
              {formatPrice(product.price_cents, product.currency)}
            </span>
          </div>
          <button
            type="submit"
            className="flex-1 rounded-full text-sm transition active:opacity-80"
            style={{
              background: theme.primary,
              color: theme.surface,
              fontFamily: "var(--store-font)",
              fontWeight: 400,
              letterSpacing: "0.05em",
            }}
          >
            我想要這一株
          </button>
        </form>
      )}

      {/* 避免 sticky bar 蓋住下方內容（只在 mobile） */}
      {inStock && <div className="md:hidden h-24" />}

      {relatedProducts && relatedProducts.length > 0 && (
        <section className="mt-32">
          <div className="flex items-end justify-between mb-14 flex-wrap gap-4">
            <div>
              <p
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                Also in Store
              </p>
              <h2
                className="mt-4 text-2xl sm:text-3xl"
                style={{
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                這些也在店裡
              </h2>
              <div
                className="mt-4 h-px w-10"
                style={{
                  background: "var(--store-accent, currentColor)",
                  opacity: 0.4,
                }}
              />
            </div>
            <Link
              href={`/${slug}/shop`}
              className="sproutly-link text-[0.6875rem] uppercase font-medium"
              style={{ letterSpacing: "0.3em" }}
            >
              看所有的植物 →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <Link
                key={p.id}
                href={`/${slug}/products/${p.id}`}
                className="group block"
              >
                <div
                  className="aspect-square rounded-2xl overflow-hidden transition"
                  style={{
                    background: theme.surface,
                    boxShadow: "var(--sproutly-elev-2)",
                  }}
                >
                  {p.image_urls?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_urls[0]}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: theme.bg }}
                    >
                      <span
                        className="text-[0.625rem] uppercase font-medium"
                        style={{
                          color: theme.textMuted,
                          opacity: 0.45,
                          letterSpacing: "0.3em",
                        }}
                      >
                        No Image
                      </span>
                    </div>
                  )}
                </div>
                <h3
                  className="mt-4 line-clamp-1 group-hover:opacity-70 transition"
                  style={{
                    color: theme.text,
                    fontFamily: "var(--store-font)",
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {p.name}
                </h3>
                <p
                  className="mt-1.5 text-[0.9375rem] tabular-nums"
                  style={{
                    color: theme.accent,
                    fontFamily: "var(--store-font)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formatPrice(p.price_cents, p.currency)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
