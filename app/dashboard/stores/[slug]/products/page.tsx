import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/format-price";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ q?: string; filter?: string }>;

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  image_urls: string[] | null;
  stock: number | null;
  is_active: boolean;
};

// 快沒貨門檻跟卡片上的「剩 N 件」、後台首頁的快沒貨清單同一套（< 5），
// 三個地方不會各說各話
const STATUS_FILTERS: {
  key: string;
  label: string;
  match: (p: ProductRow) => boolean;
}[] = [
  { key: "all", label: "全部", match: () => true },
  { key: "active", label: "上架中", match: (p) => p.is_active },
  { key: "inactive", label: "停售中", match: (p) => !p.is_active },
  {
    key: "low",
    label: "快沒貨",
    match: (p) => p.stock !== null && p.stock > 0 && p.stock < 5,
  },
  { key: "soldout", label: "已售完", match: (p) => p.stock === 0 },
];

export default async function ProductsListPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { q: rawQuery, filter: rawFilter } = await searchParams;
  const q = (rawQuery ?? "").trim();
  const filter = STATUS_FILTERS.some((f) => f.key === rawFilter)
    ? rawFilter!
    : "all";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  const { data: products } = await supabase
    .from("sproutly_products")
    .select("*")
    .eq("merchant_id", store.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  // 商品數量不多（一間店頂多幾百件），一次撈回來在這裡篩，
  // chips 的 count 也順便從同一份資料算，不用多打一次 DB
  const allProducts: ProductRow[] = products ?? [];
  const filterCounts: Record<string, number> = {};
  for (const f of STATUS_FILTERS) {
    filterCounts[f.key] = allProducts.filter(f.match).length;
  }

  const qLower = q.toLowerCase();
  const activeFilter =
    STATUS_FILTERS.find((f) => f.key === filter) ?? STATUS_FILTERS[0];
  const visible = allProducts.filter(
    (p) =>
      activeFilter.match(p) &&
      (!qLower ||
        p.name.toLowerCase().includes(qLower) ||
        (p.description ?? "").toLowerCase().includes(qLower))
  );

  function chipHref(key: string) {
    const sp = new URLSearchParams();
    if (key !== "all") sp.set("filter", key);
    if (q) sp.set("q", q);
    const qs = sp.toString();
    return `/dashboard/stores/${slug}/products${qs ? `?${qs}` : ""}`;
  }

  const filterActive = q !== "" || filter !== "all";
  const count = allProducts.length;
  const caption = filterActive
    ? `符合條件 ${visible.length} 件 · 全部 ${count} 件`
    : count > 0
      ? `${count} 件商品 · 點任一件編輯`
      : "新增第一件商品讓店面活起來";

  return (
    <div>
      <div className="flex items-end justify-between mb-10 gap-3 flex-wrap">
        <div>
          <p
            className="uppercase text-emerald-700/70"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            Products · 商品
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl text-emerald-950 font-medium tracking-tight"
            style={{ letterSpacing: "-0.01em", lineHeight: 1.15 }}
          >
            管理你的商品
          </h2>
          <span
            aria-hidden
            className="mt-4 block h-px w-12 bg-emerald-600/60"
          />
          <p
            className="mt-4 text-emerald-900/65"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {caption}
          </p>
        </div>
        {count > 0 && (
          <Link
            href={`/dashboard/stores/${slug}/products/new`}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-white text-sm font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
          >
            ＋ 新增商品
          </Link>
        )}
      </div>

      {/* 狀態 chips + 搜尋 bar：跟訂單列表同一套操作語言，商品多了照樣一秒找到 */}
      {count > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-lg shadow-emerald-700/5 mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="sr-only">依商品狀態篩選：</span>
            {STATUS_FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Link
                  key={f.key}
                  href={chipHref(f.key)}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${
                    active
                      ? "bg-emerald-700 text-white shadow-md shadow-emerald-700/20"
                      : "bg-emerald-50 text-emerald-900/80 hover:bg-emerald-100"
                  }`}
                >
                  {f.label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      active ? "bg-white/20" : "bg-white"
                    }`}
                  >
                    {filterCounts[f.key]}
                    <span className="sr-only"> 件</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <form
            action={`/dashboard/stores/${slug}/products`}
            method="GET"
            className="flex gap-2"
          >
            {filter !== "all" && (
              <input type="hidden" name="filter" value={filter} />
            )}
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="搜尋商品名稱 / 描述..."
              className="flex-1 rounded-full border border-emerald-100 px-4 py-2 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition text-sm"
            />
            <button
              type="submit"
              className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 transition"
            >
              搜尋
            </button>
            {filterActive && (
              <Link
                href={`/dashboard/stores/${slug}/products`}
                className="rounded-full border border-emerald-100 px-4 py-2 text-sm text-emerald-900/70 hover:bg-emerald-50 transition"
              >
                清除
              </Link>
            )}
          </form>
        </div>
      )}

      {visible.length > 0 ? (
        <div className="space-y-3">
          {visible.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/stores/${slug}/products/${p.id}/edit`}
              className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5 hover:shadow-xl hover:shadow-emerald-700/10 hover:-translate-y-0.5 transition flex items-center gap-4 block"
            >
              <div className="w-16 h-16 rounded-xl bg-emerald-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {p.image_urls && p.image_urls.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_urls[0]}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="uppercase text-emerald-900/40"
                    style={{ fontSize: "0.625rem", letterSpacing: "0.3em" }}
                  >
                    No Image
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-emerald-950 truncate">
                    {p.name}
                  </h3>
                  {!p.is_active && (
                    <>
                      <span
                        aria-hidden
                        className="uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600"
                        style={{
                          fontSize: "0.625rem",
                          letterSpacing: "0.3em",
                        }}
                      >
                        Inactive · 停售
                      </span>
                      <span className="sr-only">，狀態：停售中</span>
                    </>
                  )}
                </div>
                {p.description && (
                  <p className="text-sm text-emerald-900/60 truncate mt-0.5">
                    {p.description}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p
                  className="text-emerald-950 font-medium tabular-nums"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {formatPrice(p.price_cents, p.currency)}
                </p>
                {/* 售完／快沒貨改用色塊標出來，商家掃列表時一眼看到該補哪幾件——
                    門檻（< 5）與用字跟後台首頁的「快沒貨」清單一致，兩邊不會各說各話 */}
                {p.stock === 0 ? (
                  <span
                    className="mt-1.5 inline-block rounded-full bg-red-50 px-2 py-0.5 text-red-700 font-medium"
                    style={{ fontSize: "0.625rem", letterSpacing: "0.15em" }}
                  >
                    已售完
                  </span>
                ) : p.stock !== null && p.stock < 5 ? (
                  <span
                    className="mt-1.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 font-medium"
                    style={{ fontSize: "0.625rem", letterSpacing: "0.15em" }}
                  >
                    剩 {p.stock} 件
                  </span>
                ) : p.stock !== null ? (
                  <p
                    className="mt-1 uppercase text-emerald-900/50"
                    style={{ fontSize: "0.625rem", letterSpacing: "0.3em" }}
                  >
                    <span aria-hidden>Stock {p.stock}</span>
                    <span className="sr-only">庫存 {p.stock} 件</span>
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 sm:p-16 text-center shadow-xl shadow-emerald-700/5">
          <p
            className="uppercase text-emerald-700/70"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            {filterActive ? "No Match · 沒有符合" : "Empty · 還沒開張"}
          </p>
          <span
            aria-hidden
            className="mt-4 block h-px w-10 bg-emerald-600/60 mx-auto"
          />
          <h3
            className="mt-6 text-2xl sm:text-3xl text-emerald-950 font-medium tracking-tight"
            style={{ letterSpacing: "-0.01em", lineHeight: 1.2 }}
          >
            {filterActive ? (
              <>
                沒有符合
                <br />
                條件的商品
              </>
            ) : (
              <>
                還沒有
                <br />
                上架的商品
              </>
            )}
          </h3>
          <p
            className="mt-5 text-emerald-900/65 max-w-md mx-auto"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {filterActive
              ? "換個篩選條件或清除搜尋試試"
              : "新增第一件，客人就能開始逛你的店"}
          </p>
          {!filterActive && (
            <Link
              href={`/dashboard/stores/${slug}/products/new`}
              className="mt-10 inline-block rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
            >
              ＋ 新增第一件商品
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
