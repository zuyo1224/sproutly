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

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <Link
        href={`/${slug}/shop`}
        className="sproutly-link inline-block mb-10 text-[11px] tracking-[0.3em] uppercase"
        style={{ color: theme.textMuted }}
      >
        所有商品
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14">
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
                className="text-xs tracking-widest uppercase"
                style={{ color: theme.textMuted, opacity: 0.4 }}
              >
                No Image
              </span>
            </div>
          )}
        </div>

        <div className="md:pt-6">
          <p
            className="text-[10px] tracking-[0.4em] uppercase mb-5"
            style={{ color: theme.textMuted, opacity: 0.7 }}
          >
            {store.name}
          </p>
          <div className="flex items-start justify-between gap-4">
            <h1
              className="text-4xl md:text-5xl lg:text-[3rem]"
              style={{
                color: theme.text,
                fontFamily: "var(--store-font)",
                fontWeight: 400,
                letterSpacing: "-0.01em",
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
              className="flex-shrink-0 mt-2 hover:scale-110"
            />
          </div>

          {product.description && (
            <div className="mt-10">
              <p
                className="text-[10px] tracking-[0.35em] uppercase mb-4"
                style={{ color: theme.accent }}
              >
                關於這株
              </p>
              <div
                className="whitespace-pre-line text-[15px]"
                style={{
                  color: theme.text,
                  opacity: 0.85,
                  lineHeight: 1.9,
                  letterSpacing: "0.015em",
                  wordBreak: "keep-all",
                  overflowWrap: "break-word",
                }}
              >
                {product.description}
              </div>
            </div>
          )}

          <div
            className="mt-12 pt-8 border-t flex items-baseline justify-between gap-4"
            style={{ borderColor: theme.border }}
          >
            <div>
              <p
                className="text-[10px] tracking-[0.4em] uppercase mb-2"
                style={{ color: theme.textMuted }}
              >
                售價
              </p>
              <p
                className="text-3xl md:text-[2.25rem]"
                style={{
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatPrice(product.price_cents, product.currency)}
              </p>
            </div>

            {product.stock !== null && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{
                    background:
                      !inStock
                        ? "#9CA3AF"
                        : product.stock <= 3
                          ? "#D97706"
                          : theme.accent,
                  }}
                />
                <p
                  className="text-[11px] tracking-wide"
                  style={{
                    color: !inStock
                      ? theme.textMuted
                      : product.stock <= 3
                        ? "#92400E"
                        : theme.textMuted,
                  }}
                >
                  {!inStock
                    ? "目前已無庫存"
                    : product.stock <= 3
                      ? `僅剩 ${product.stock} 株`
                      : `尚有 ${product.stock} 株`}
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
                  className="text-xs tracking-widest uppercase"
                  style={{ color: theme.textMuted }}
                >
                  數量
                </label>
                <select
                  name="qty"
                  defaultValue={1}
                  className="rounded-md px-3 py-2 outline-none transition text-sm"
                  style={{
                    background: theme.surface,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                  }}
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
              className="w-full rounded-full px-8 py-4 transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: theme.primary,
                color: theme.surface,
                fontFamily: "var(--store-font)",
                fontWeight: 400,
                letterSpacing: "0.05em",
              }}
            >
              {inStock ? "我想要這一株" : "已售完"}
            </button>

            {inStock && (
              <AddToCartButton
                slug={slug}
                productId={product.id}
                qty={1}
                className="w-full rounded-full px-8 py-4 transition hover:opacity-80"
                style={{
                  border: `1px solid ${theme.border}`,
                  background: theme.surface,
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  letterSpacing: "0.05em",
                }}
              >
                加入購物車
              </AddToCartButton>
            )}

            {store.contact_phone && (
              <a
                href={`tel:${store.contact_phone}`}
                className="block w-full rounded-full px-8 py-4 text-center transition hover:opacity-80"
                style={{
                  border: `1px solid ${theme.border}`,
                  background: theme.surface,
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                  letterSpacing: "0.05em",
                }}
              >
                來店看實品
              </a>
            )}
            {store.contact_email && (
              <a
                href={`mailto:${store.contact_email}?subject=${encodeURIComponent("詢問商品：" + product.name)}`}
                className="block w-full rounded-full px-8 py-4 text-center font-medium border-2 transition hover:opacity-80"
                style={{
                  borderColor: theme.border,
                  background: theme.surface,
                  color: theme.text,
                }}
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
          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <div>
              <p
                className="text-xs tracking-[0.4em] uppercase"
                style={{ color: theme.textMuted }}
              >
                Also in store
              </p>
              <h2
                className="mt-4 text-2xl sm:text-3xl"
                style={{
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                }}
              >
                這些也在店裡
              </h2>
            </div>
            <Link
              href={`/${slug}/shop`}
              className="text-sm transition hover:opacity-70 underline-offset-4 hover:underline"
              style={{ color: theme.textMuted }}
            >
              看所有的植物
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {relatedProducts.map((p) => (
              <Link
                key={p.id}
                href={`/${slug}/products/${p.id}`}
                className="group block"
              >
                <div
                  className="aspect-square rounded-2xl overflow-hidden shadow-sm transition group-hover:shadow-md"
                  style={{ background: theme.surface }}
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
                        className="text-[10px] tracking-wider"
                        style={{ color: theme.textMuted, opacity: 0.4 }}
                      >
                        —
                      </span>
                    </div>
                  )}
                </div>
                <h3
                  className="mt-3 font-medium line-clamp-1 group-hover:opacity-70 transition"
                  style={{ color: theme.text }}
                >
                  {p.name}
                </h3>
                <p
                  className="text-sm mt-1"
                  style={{ color: theme.accent }}
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
