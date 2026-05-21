import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../_theme";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ q?: string; sort?: string }>;

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
  const { q: rawQ, sort: rawSort } = await searchParams;
  const q = (rawQ ?? "").trim();
  const sort = SORT_OPTIONS.some((o) => o.value === rawSort)
    ? rawSort!
    : "newest";

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

  const inputStyle = {
    background: theme.surface,
    color: theme.text,
    border: `1px solid ${theme.border}`,
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
      <div className="mb-16 sm:mb-20">
        <p
          className="text-[10px] tracking-[0.4em] uppercase mb-5"
          style={{ color: theme.accent }}
        >
          Shop
        </p>
        <h1
          className="text-4xl md:text-5xl lg:text-[3rem]"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          所有商品
        </h1>
      </div>

      {/* 搜尋 + 排序 toolbar */}
      <form
        method="GET"
        className="mb-8 flex flex-col sm:flex-row gap-3"
      >
        <div className="flex-1 relative">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="搜尋商品名稱..."
            className="w-full rounded-full pl-12 pr-4 py-3 outline-none transition text-sm"
            style={inputStyle}
          />
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: theme.textMuted }}
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-full px-5 py-3 outline-none transition text-sm appearance-none cursor-pointer pr-10"
          style={{
            ...inputStyle,
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
          className="rounded-full px-6 py-3 text-sm font-medium transition hover:opacity-90"
          style={{ background: theme.primary, color: theme.surface }}
        >
          套用
        </button>
        {(q || sort !== "newest") && (
          <Link
            href={`/${slug}/shop`}
            className="rounded-full px-5 py-3 text-sm text-center transition hover:opacity-70"
            style={{
              border: `1px solid ${theme.border}`,
              color: theme.textMuted,
            }}
          >
            清除
          </Link>
        )}
      </form>

      <p
        className="mb-6 text-sm"
        style={{ color: theme.textMuted }}
      >
        {q
          ? `搜尋「${q}」找到 ${totalCount} 件商品`
          : `共 ${totalCount} 件商品`}
      </p>

      {products && products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/${slug}/products/${p.id}`}
              className="group block"
            >
              <div
                className="aspect-square rounded-2xl overflow-hidden shadow-sm transition group-hover:shadow-md relative"
                style={{ background: theme.surface }}
              >
                {p.image_urls?.[0] ? (
                  <Image
                    src={p.image_urls[0]}
                    alt={p.name}
                    fill
                    sizes="(min-width: 1024px) 300px, (min-width: 640px) 33vw, 50vw"
                    quality={80}
                    loading="lazy"
                    className="object-cover group-hover:scale-105 transition duration-700"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
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
              <h3
                className="mt-3 font-medium line-clamp-1 group-hover:opacity-70 transition"
                style={{ color: theme.text }}
              >
                {p.name}
              </h3>
              <p className="text-sm mt-1" style={{ color: theme.accent }}>
                {formatPrice(p.price_cents, p.currency)}
              </p>
              {p.stock !== null && p.stock === 0 && (
                <p className="text-xs mt-1 text-red-600">售完</p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ background: theme.surface }}
        >
          <p
            className="text-xs tracking-widest uppercase mb-3"
            style={{ color: theme.textMuted }}
          >
            {q ? "Not Found" : "Empty"}
          </p>
          <p style={{ color: theme.text }} className="font-medium">
            {q ? "找不到符合的商品" : "還沒有商品上架"}
          </p>
          {q && (
            <Link
              href={`/${slug}/shop`}
              className="mt-4 inline-block text-sm transition hover:opacity-70"
              style={{ color: theme.accent }}
            >
              看全部商品 →
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
