import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../_theme";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ q?: string; sort?: string; stock?: string }>;

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
    .select("id, theme")
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
  const totalCount = products?.length ?? 0;
  const hasFilter = q || sort !== "newest" || inStock;

  return (
    <main className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <header className="mb-16 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{ color: theme.accent, letterSpacing: "0.4em" }}
        >
          Shop
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          所有商品
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
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/${slug}/products/${p.id}`}
              className="sproutly-card"
            >
              <div className="sproutly-card-image aspect-square">
                {p.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_urls[0]}
                    alt={p.name}
                    className="w-full h-full object-cover"
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
              {p.stock !== null && p.stock === 0 && (
                <p
                  className="mt-1 text-[0.6875rem] uppercase font-medium"
                  style={{
                    color: theme.textMuted,
                    letterSpacing: "0.3em",
                  }}
                >
                  Sold Out · 售完
                </p>
              )}
            </Link>
          ))}
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
