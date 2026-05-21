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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-emerald-950">商品</h2>
          <p className="text-sm text-emerald-900/60 mt-1">
            {products && products.length > 0
              ? `共 ${products.length} 件商品`
              : "還沒有商品"}
          </p>
        </div>
        {products && products.length > 0 && (
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
                  <span className="text-[10px] text-emerald-900/40 tracking-wider">
                    無圖
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-emerald-950 truncate">
                    {p.name}
                  </h3>
                  {!p.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                      停售
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
                <p className="font-semibold text-emerald-950">
                  {formatPrice(p.price_cents, p.currency)}
                </p>
                {p.stock !== null && (
                  <p className="text-xs text-emerald-900/50 mt-0.5">
                    庫存 {p.stock}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center shadow-xl shadow-emerald-700/5">
          <p className="text-xs tracking-widest uppercase text-emerald-600 mb-3">
            Empty
          </p>
          <h3 className="text-xl font-bold text-emerald-950">
            還沒有商品
          </h3>
          <p className="mt-2 text-emerald-900/60 max-w-md mx-auto">
            新增第一件商品，讓客人開始逛你的店
          </p>
          <Link
            href={`/dashboard/stores/${slug}/products/new`}
            className="mt-8 inline-block rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
          >
            ＋ 新增第一件商品
          </Link>
        </div>
      )}
    </div>
  );
}
