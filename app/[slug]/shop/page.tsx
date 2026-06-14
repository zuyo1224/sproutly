import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme, HOMEPAGE_DEFAULTS } from "../_theme";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ q?: string; sort?: string; stock?: string }>;

// canonical 指回不帶查詢字串的商品頁網址——搜尋／排序／篩庫存會生出 ?q= ?sort= ?stock=
// 一堆變體網址，全部當成同一頁，排名才不會被切散。
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "全部商品",
    description: "瀏覽完整商品與庫存，看上眼直接線上下單。",
    alternates: { canonical: `/${slug}/shop` },
  };
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "最新上架" },
  { value: "price-asc", label: "價格 低 → 高" },
  { value: "price-desc", label: "價格 高 → 低" },
  { value: "name", label: "名稱 A-Z" },
];

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { q: rawQ, sort: rawSort, stock: rawStock } = await searchParams;
  const q = (rawQ ?? "").trim();
  const sort = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? rawSort!
    : "newest";
  const inStock = rawStock === "1";

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name, theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  let query = supabase
    .from("sproutly_products")
    .select("*")
    .eq("merchant_id", store.id)
    .eq("is_active", true);

  if (q) {
    const escaped = q.replace(/[%_]/g, (m) => `\\${m}`);
    query = query.ilike("name", `%${escaped}%`);
  }

  if (inStock) {
    query = query.or("stock.is.null,stock.gt.0");
  }

  switch (sort) {
    case "price-asc":
      query = query.order("price_cents", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price_cents", { ascending: false });
      break;
    case "name":
      query = query.order("name", { ascending: true });
      break;
    default:
      query = query
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
  }

  const { data: products } = await query;
  // 售完的商品一律沉到列表最底。選定的排序（最新／價格／名稱）原本把已售完
  // 跟有貨的混在一起，逛街頁第一排常卡著幾株沒貨的，客人得略過才看到買得到的——
  // 跟最近替每個商品卡片補上售完標示同一個出發點：別讓人花眼力在買不到的東西上。
  // 在原排序之上再把 stock===0 的整批推到最後（JS sort 穩定，各自維持原順序），
  // 跟「只看有貨」勾選互補：不勾也是先看到買得到的，售完的仍排在下方可瀏覽。
  products?.sort((a, b) => {
    const aSold = a.stock !== null && a.stock === 0 ? 1 : 0;
    const bSold = b.stock !== null && b.stock === 0 ? 1 : 0;
    return aSold - bSold;
  });
  const totalCount = products?.length ?? 0;
  const hasFilter = q || sort !== "newest" || inStock;

  const shopEyebrow = theme.homepage.shopEyebrow ?? HOMEPAGE_DEFAULTS.shopEyebrow;
  const shopTitle = theme.homepage.shopTitle ?? HOMEPAGE_DEFAULTS.shopTitle;

  const BASE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://sproutly-drab.vercel.app";

  // 麵包屑結構化資料 — 跟首頁的 Store、商品詳情頁的 Product/BreadcrumbList 一套，
  // 讓 Google 搜尋結果用「店名 › 所有商品」標出這頁在店裡的位置。
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
    ],
  };

  // 商品列表結構化資料 — 首頁有 Store、商品詳情頁有 Product，唯獨這頁
  // （客人逛街的主入口）沒有，Google 看不出這是一份商品清單。補上 ItemList
  // 讓搜尋結果有機會直接列出商品縮圖＋價格。只在沒套用搜尋／篩選的正規網址
  // （canonical 指向的乾淨頁）才放，避免結構化資料跟正規頁實際內容對不上；
  // 數量設上限避免清單過長拖慢頁面。
  const itemListJsonLd =
    !hasFilter && products && products.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: shopTitle,
          numberOfItems: products.length,
          itemListElement: products.slice(0, 30).map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Product",
              name: p.name,
              url: `${BASE_URL}/${slug}/products/${p.id}`,
              image: p.image_urls?.[0] ?? undefined,
              offers: {
                "@type": "Offer",
                priceCurrency: p.currency,
                price: (p.price_cents / 100).toFixed(2),
                availability:
                  p.stock === null || p.stock > 0
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
              },
            },
          })),
        }
      : null;

  return (
    <main className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <header className="mb-16 sm:mb-20">
        <p
          data-edit-text="true"
          data-edit-field="shopEyebrow"
          className="text-[0.6875rem] uppercase font-medium"
          style={{ color: theme.accent, letterSpacing: "0.4em" }}
        >
          {shopEyebrow}
        </p>
        <h1
          data-edit-text="true"
          data-edit-field="shopTitle"
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {shopTitle}
        </h1>
        <div
          className="mt-5 h-px w-12"
          style={{ background: theme.accent, opacity: 0.5 }}
        />
        <p
          className="mt-5 text-[0.9375rem]"
          style={{ color: theme.textMuted, lineHeight: 1.7 }}
        >
          {q
            ? `搜尋「${q}」· 找到 ${totalCount} 件${inStock ? "有貨" : ""}商品`
            : totalCount === 0
              ? inStock
                ? "目前沒有有貨的商品"
                : "還沒有商品上架"
              : inStock
                ? `${totalCount} 件有貨商品 · 立刻可以下單`
                : `${totalCount} 件商品在等你慢慢挑`}
        </p>
      </header>

      <form
        method="GET"
        className="mb-12 flex flex-col sm:flex-row gap-3"
      >
        <div className="flex-1 relative">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="搜尋商品名稱⋯"
            className="sproutly-input pl-12"
            aria-label="搜尋商品"
          />
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: theme.textMuted }}
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <label
          className="flex items-center gap-2.5 px-4 sm:px-5 rounded-full cursor-pointer select-none"
          style={{
            border: `1px solid ${theme.border}`,
            background: "var(--store-surface, transparent)",
            color: theme.text,
            minHeight: "2.75rem",
          }}
        >
          <input
            type="checkbox"
            name="stock"
            value="1"
            defaultChecked={inStock}
            className="w-4 h-4 cursor-pointer"
            style={{ accentColor: theme.accent }}
            aria-label="只看有庫存"
          />
          <span
            className="text-[0.6875rem] uppercase font-medium whitespace-nowrap"
            style={{ letterSpacing: "0.3em" }}
          >
            In Stock · 只看有貨
          </span>
        </label>
        <select
          name="sort"
          defaultValue={sort}
          aria-label="排序方式"
          className="sproutly-input appearance-none cursor-pointer pr-10 sm:w-48"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23888'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.75rem center",
            backgroundSize: "1rem",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="sproutly-btn sproutly-btn-primary"
        >
          套用
        </button>
        {hasFilter && (
          <Link
            href={`/${slug}/shop`}
            className="sproutly-btn sproutly-btn-secondary text-center"
          >
            清除
          </Link>
        )}
      </form>

      {products && products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 sm:gap-x-10 gap-y-16">
          {products.map((p) => {
            const soldOut = p.stock !== null && p.stock === 0;
            return (
            <Link
              key={p.id}
              href={`/${slug}/products/${p.id}`}
              className="sproutly-card"
            >
              <div className="sproutly-card-image aspect-square relative">
                {/* 售完的圖片去彩、壓暗，再蓋一枚角落標記。逛列表時一眼就看得出
                    哪幾株沒了，不必先讀卡片下方的小字才知道。 */}
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
                    className={`w-full h-full object-cover transition ${
                      soldOut ? "opacity-55 grayscale" : ""
                    }`}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background:
                        "var(--store-surface, rgba(0,0,0,0.04))",
                    }}
                  >
                    <span
                      className="text-[0.6875rem] uppercase"
                      style={{
                        color: theme.textMuted,
                        opacity: 0.5,
                        letterSpacing: "0.4em",
                      }}
                    >
                      No Image
                    </span>
                  </div>
                )}
              </div>
              <h3
                className="sproutly-card-title mt-5 text-base line-clamp-1"
                style={{ fontFamily: "var(--store-font)", fontWeight: 400 }}
              >
                {p.name}
              </h3>
              <p
                className="sproutly-card-meta mt-1 text-sm tabular-nums"
                style={{ color: theme.accent }}
              >
                {formatPrice(p.price_cents, p.currency)}
              </p>
              {/* 售完已由圖片上的角落標記表達，這裡只留「剩 N」的琥珀色提示，
                  跟商品詳情頁同一套語言，讓客人逛列表就分得出哪幾株快沒了。 */}
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
      ) : (
        <div className="py-16 max-w-md">
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{ color: theme.accent, letterSpacing: "0.4em" }}
          >
            {hasFilter ? "Not Found" : "Empty"}
          </p>
          <div
            className="mt-5 h-px w-10"
            style={{ background: theme.accent, opacity: 0.4 }}
          />
          <p
            className="mt-6 text-2xl sm:text-3xl font-medium"
            style={{
              color: theme.text,
              fontFamily: "var(--store-font)",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            {q ? (
              <>
                沒有商品
                <br />
                符合「{q}」
              </>
            ) : inStock ? (
              <>
                目前所有商品
                <br />
                都暫時缺貨
              </>
            ) : (
              <>
                這間店
                <br />
                還在準備
              </>
            )}
          </p>
          <p
            className="mt-5 text-[0.9375rem]"
            style={{ color: theme.textMuted, lineHeight: 1.7 }}
          >
            {q
              ? "換個關鍵字、或先看看全部商品。"
              : inStock
                ? "取消「只看有貨」可以瀏覽預購商品。"
                : "店主還沒上架商品，過幾天再回來看看吧。"}
          </p>
          {hasFilter && (
            <Link
              href={`/${slug}/shop`}
              className="sproutly-link mt-10 inline-block text-[0.75rem] uppercase font-medium"
              style={{ letterSpacing: "0.3em" }}
              data-default-line="true"
            >
              看全部商品 →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
