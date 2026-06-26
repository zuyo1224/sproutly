import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { telHref, mailHref } from "@/lib/contact-href";
import { resolveTheme } from "../../_theme";
import { ImageCarousel } from "@/app/_components/image-carousel";
import { FavoriteButton } from "@/app/_components/favorite-button";
import { AddToCartButton } from "@/app/_components/add-to-cart-button";
import { ShareButton } from "@/app/_components/share-button";
import { RecentlyViewed } from "@/app/_components/recently-viewed";

type Params = Promise<{ slug: string; id: string }>;

import { formatPrice } from "@/lib/format-price";

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
    alternates: { canonical: `/${slug}/products/${id}` },
    openGraph: {
      title: `${product.name} · ${priceLabel}`,
      description,
      siteName: store.name,
      type: "website",
      locale: "zh_TW",
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

  // 同店其他商品：先撈多一點，售完的沉到最後再取前 4。
  // 跟 shop 逛街頁、首頁精選同一套「售完沉底」——別讓沒貨的株佔掉推薦名額，
  // 客人往下滑「這些也在店裡」優先看到買得到的，不用點進去才發現缺貨。
  const { data: relatedRaw } = await supabase
    .from("sproutly_products")
    .select("id, name, price_cents, currency, image_urls, stock")
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .neq("id", product.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const isSoldOut = (s: number | null) => (s !== null && s === 0 ? 1 : 0);
  // Array.sort 穩定（ES2019+），有貨與售完兩群各自維持 created_at 倒序
  const relatedProducts = (relatedRaw ?? [])
    .slice()
    .sort((a, b) => isSoldOut(a.stock) - isSoldOut(b.stock))
    .slice(0, 4);

  const images: string[] = product.image_urls ?? [];
  const primaryImage = images[0] ?? null;
  const extraImages = images.slice(1);
  const inStock = product.stock === null || product.stock > 0;
  const maxQty = product.stock !== null ? Math.min(product.stock, 99) : 99;
  // 庫存狀態給 Google：頁面上 stock ≤ 3 就亮「剩 N」琥珀色提示，結構化資料也跟著走——
  // 還剩一點的用 LimitedAvailability（schema.org 正好有這個值），讓搜尋結果能標「所剩不多」，
  // 跟客人在頁面上看到的低庫存提示一致；沒設庫存或量足就照常 InStock，賣完 OutOfStock。
  const availability = !inStock
    ? "https://schema.org/OutOfStock"
    : product.stock !== null && product.stock <= 3
      ? "https://schema.org/LimitedAvailability"
      : "https://schema.org/InStock";

  const BASE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://sproutly-drab.vercel.app";

  // 價格有效期限給 Google：Product 的 offers 沒帶 priceValidUntil 時，
  // Search Console 會報「缺少建議欄位」，rich result 也可能不顯示價格。
  // 商家不設到期日，這裡預設一年後，讓結構化資料完整、價格不被當成過期。
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

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
      // 商品都是全新品（盆栽、家居用品），標明 NewCondition 讓 Google
      // 商品結果不留空，也補上 Search Console 會提示的建議欄位。
      itemCondition: "https://schema.org/NewCondition",
      priceCurrency: product.currency,
      price: (product.price_cents / 100).toFixed(2),
      priceValidUntil,
      availability,
      // seller 的 @id 指回首頁／聯絡頁那份 Store 同一個身分證
      // （${BASE_URL}/${slug}#store）。Store 本來就是 Organization 的子類，型別相容，
      // 這樣 Google 把「賣這件商品的人」和店家本體連成同一間店，而非另一個匿名賣家。
      seller: {
        "@type": "Organization",
        "@id": `${BASE_URL}/${slug}#store`,
        name: store.name,
      },
    },
  };

  // 麵包屑結構化資料 — 讓 Google 在搜尋結果用「店名 › 所有商品 › 商品」
  // 取代生硬的網址，客人一眼看出這頁在店裡的位置。
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: store.name,
        item: `${BASE_URL}/${slug}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "所有商品",
        item: `${BASE_URL}/${slug}/shop`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${BASE_URL}/${slug}/products/${product.id}`,
      },
    ],
  };

  return (
    <main className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* 可見的麵包屑導覽 — 跟上面 BreadcrumbList 結構化資料一致，
          讓客人一眼看到自己在店裡的位置，也能往回逛店或回所有商品。 */}
      <nav
        aria-label="麵包屑"
        className="mb-14 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] font-medium"
        style={{ letterSpacing: "0.1em" }}
      >
        <Link
          href={`/${slug}`}
          className="sproutly-link"
          style={{ color: theme.textMuted }}
        >
          {store.name}
        </Link>
        <span aria-hidden="true" style={{ color: theme.textMuted, opacity: 0.45 }}>
          ›
        </span>
        <Link
          href={`/${slug}/shop`}
          className="sproutly-link"
          style={{ color: theme.textMuted }}
        >
          所有商品
        </Link>
        <span aria-hidden="true" style={{ color: theme.textMuted, opacity: 0.45 }}>
          ›
        </span>
        <span
          aria-current="page"
          className="truncate max-w-[14rem]"
          style={{ color: theme.text, opacity: 0.75 }}
        >
          {product.name}
        </span>
      </nav>

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
            id="buy-form"
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
                qtyInputId="qty"
                stock={product.stock}
                className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg w-full"
              >
                加入購物車
              </AddToCartButton>
            )}

            {store.contact_phone && (
              <a
                href={telHref(store.contact_phone)}
                className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg w-full"
              >
                來店看實品
              </a>
            )}
            {store.contact_email && (
              <a
                href={mailHref(store.contact_email, { subject: "詢問商品：" + product.name })}
                className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg w-full"
              >
                Email 詢問
              </a>
            )}

            <ShareButton
              productName={product.name}
              storeName={store.name}
              className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg w-full"
            >
              分享給朋友
            </ShareButton>
          </form>
        </div>
      </div>

      {/* Mobile sticky buy bar
          這條底部購買鈕不再自帶 form 寫死 qty=1——客人在頁面中段把數量選成 5、
          捲到底用這顆鈕結帳時，原本只會送出 1 件，選的數量被默默吞掉（跟先前
          commit d8038d1「加入購物車吞數量」同源的孿生缺口，當時只修了加入購物車）。
          改用 HTML 原生 form 屬性把這顆鈕關聯回上方主購買表單（id="buy-form"），
          送出時自然帶上數量選單的當前值，零 JS。inStock 時主表單與其數量選單必定
          render，關聯目標一定存在。 */}
      {inStock && (
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch gap-3 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          style={{
            background: theme.surface,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
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
            form="buy-form"
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
        </div>
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
            {relatedProducts.map((p) => {
              // 客人逛到某株植物、往下看「這些也在店裡」，常會點進去才發現沒貨。
              // 跟收藏頁、首頁精選、shop 逛街頁同一套語言：售完角標 + 圖片灰階壓暗、
              // 剩 3 件以下琥珀色提示，讓人在點進去前就分得出哪幾株沒了。
              const soldOut = p.stock !== null && p.stock === 0;
              return (
              <Link
                key={p.id}
                href={`/${slug}/products/${p.id}`}
                className="group block"
              >
                <div
                  className="aspect-square rounded-2xl overflow-hidden transition relative"
                  style={{
                    background: theme.surface,
                    boxShadow: "var(--sproutly-elev-2)",
                  }}
                >
                  {soldOut && (
                    <span
                      className="absolute left-3 top-3 z-10 px-2.5 py-1 rounded-full text-[0.625rem] uppercase font-medium backdrop-blur-sm"
                      style={{
                        background: "rgba(0,0,0,0.55)",
                        color: "#fff",
                        letterSpacing: "0.2em",
                      }}
                    >
                      售完
                    </span>
                  )}
                  {p.image_urls?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_urls[0]}
                      alt={p.name}
                      loading="lazy"
                      className={`w-full h-full object-cover group-hover:scale-105 transition duration-700 ${
                        soldOut ? "opacity-55 grayscale" : ""
                      }`}
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
                {/* 售完已由圖上角標表達，這裡只留琥珀色「剩 N」提示快沒貨，
                    跟收藏頁、shop 頁、商品詳情頁本體一致。 */}
                {!soldOut && p.stock !== null && p.stock <= 3 ? (
                  <p
                    className="mt-1 text-[0.6875rem] uppercase font-medium"
                    style={{
                      color: "#92400E",
                      letterSpacing: "0.3em",
                    }}
                  >
                    Low Stock · 剩 {p.stock}
                  </p>
                ) : null}
              </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 最近看過：記下這次看的這株、列出之前在這台裝置看過的其他幾株，
          客人逛到第三株想回頭比較前兩株時一鍵跳回。純 client localStorage，
          第一次逛店沒紀錄就整段不出現。 */}
      <RecentlyViewed
        slug={slug}
        current={{
          id: product.id,
          name: product.name,
          priceCents: product.price_cents,
          currency: product.currency,
          image: primaryImage,
        }}
        colors={{
          text: theme.text,
          textMuted: theme.textMuted,
          accent: theme.accent,
          surface: theme.surface,
          bg: theme.bg,
        }}
      />
    </main>
  );
}
