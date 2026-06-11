import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

type Params = Promise<{ slug: string }>;

export default async function ProductsListPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
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

  const formatPrice = (cents: number, currency: string) => {
    const amount = cents / 100;
    if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
    return `${currency} ${amount.toFixed(2)}`;
  };

  const count = products?.length ?? 0;
  const caption =
    count > 0 ? `${count} 件商品 · 點任一件編輯` : "新增第一件商品讓店面活起來";

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

      {products && products.length > 0 ? (
        <div className="space-y-3">
          {products.map((p) => (
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
                    <span
                      className="uppercase px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600"
                      style={{
                        fontSize: "0.625rem",
                        letterSpacing: "0.3em",
                      }}
                    >
                      Inactive · 停售
                    </span>
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
                    Stock {p.stock}
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
            Empty · 還沒開張
          </p>
          <span
            aria-hidden
            className="mt-4 block h-px w-10 bg-emerald-600/60 mx-auto"
          />
          <h3
            className="mt-6 text-2xl sm:text-3xl text-emerald-950 font-medium tracking-tight"
            style={{ letterSpacing: "-0.01em", lineHeight: 1.2 }}
          >
            還沒有
            <br />
            上架的商品
          </h3>
          <p
            className="mt-5 text-emerald-900/65 max-w-md mx-auto"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            新增第一件，客人就能開始逛你的店
          </p>
          <Link
            href={`/dashboard/stores/${slug}/products/new`}
            className="mt-10 inline-block rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
          >
            ＋ 新增第一件商品
          </Link>
        </div>
      )}
    </div>
  );
}
