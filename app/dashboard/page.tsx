import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { redirect } from "next/navigation";
import Link from "next/link";

function formatPrice(cents: number) {
  return `NT$ ${Math.round(cents / 100).toLocaleString("zh-TW")}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stores } = await supabase
    .from("sproutly_merchants")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const name =
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "你";

  const storeIds = stores?.map((s) => s.id) ?? [];

  let allOrders: {
    merchant_id: string;
    status: string;
    payment_status: string;
    total_cents: number;
    created_at: string;
  }[] = [];
  const productCounts: Record<string, number> = {};
  const pendingByStore: Record<string, number> = {};
  const monthRevenueByStore: Record<string, number> = {};
  const totalRevenueByStore: Record<string, number> = {};
  const orderCountByStore: Record<string, number> = {};

  if (storeIds.length > 0) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ data: orders }, { data: products }] = await Promise.all([
      supabase
        .from("sproutly_orders")
        .select("merchant_id, status, payment_status, total_cents, created_at")
        .in("merchant_id", storeIds),
      supabase
        .from("sproutly_products")
        .select("merchant_id")
        .in("merchant_id", storeIds),
    ]);

    allOrders = (orders as typeof allOrders) ?? [];
    products?.forEach((p) => {
      productCounts[p.merchant_id] =
        (productCounts[p.merchant_id] ?? 0) + 1;
    });

    allOrders.forEach((o) => {
      orderCountByStore[o.merchant_id] =
        (orderCountByStore[o.merchant_id] ?? 0) + 1;
      if (o.status === "pending") {
        pendingByStore[o.merchant_id] =
          (pendingByStore[o.merchant_id] ?? 0) + 1;
      }
      if (
        o.payment_status === "paid" &&
        o.status !== "cancelled"
      ) {
        totalRevenueByStore[o.merchant_id] =
          (totalRevenueByStore[o.merchant_id] ?? 0) + o.total_cents;
        if (new Date(o.created_at) >= startOfMonth) {
          monthRevenueByStore[o.merchant_id] =
            (monthRevenueByStore[o.merchant_id] ?? 0) + o.total_cents;
        }
      }
    });
  }

  const totalOrders = allOrders.length;
  const totalRevenue = Object.values(totalRevenueByStore).reduce(
    (s, v) => s + v,
    0
  );
  const totalPending = Object.values(pendingByStore).reduce((s, v) => s + v, 0);
  const totalMonthRevenue = Object.values(monthRevenueByStore).reduce(
    (s, v) => s + v,
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50">
      <header className="px-8 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link
          href="/"
          className="text-emerald-900 font-bold text-xl tracking-tight"
        >
          Sproutly
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-emerald-900/70 hover:text-emerald-900 transition"
          >
            登出
          </button>
        </form>
      </header>

      <main className="max-w-5xl mx-auto px-8 pb-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-emerald-950">
            Hi {name}
          </h1>
          <p className="mt-2 text-emerald-900/60">{user.email}</p>
        </div>

        {/* 多店業績概覽 */}
        {stores && stores.length > 0 && (
          <section className="mb-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5">
                <p className="text-xs text-emerald-900/60 uppercase tracking-wider">
                  總營收
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-950">
                  {formatPrice(totalRevenue)}
                </p>
                <p className="mt-1 text-xs text-emerald-900/50">
                  {stores.length} 間店合計
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5">
                <p className="text-xs text-emerald-900/60 uppercase tracking-wider">
                  本月營收
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-950">
                  {formatPrice(totalMonthRevenue)}
                </p>
                <p className="mt-1 text-xs text-emerald-900/50">已付款</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5">
                <p className="text-xs text-emerald-900/60 uppercase tracking-wider">
                  訂單數
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-950">
                  {totalOrders}
                </p>
                <p className="mt-1 text-xs text-emerald-900/50">累計</p>
              </div>
              <div
                className={`rounded-2xl p-5 shadow-lg ${
                  totalPending > 0
                    ? "bg-amber-50 shadow-amber-200/30"
                    : "bg-white shadow-emerald-700/5"
                }`}
              >
                <p
                  className={`text-xs uppercase tracking-wider ${
                    totalPending > 0
                      ? "text-amber-700"
                      : "text-emerald-900/60"
                  }`}
                >
                  待處理訂單
                </p>
                <p
                  className={`mt-2 text-2xl font-bold ${
                    totalPending > 0 ? "text-amber-700" : "text-emerald-950"
                  }`}
                >
                  {totalPending}
                </p>
                <p
                  className={`mt-1 text-xs ${
                    totalPending > 0
                      ? "text-amber-700/70"
                      : "text-emerald-900/50"
                  }`}
                >
                  {totalPending > 0 ? "需要你確認" : "都處理完了"}
                </p>
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-emerald-950">我的店</h2>
              <p className="text-sm text-emerald-900/60 mt-1">
                {stores && stores.length > 0
                  ? `共 ${stores.length} 間`
                  : "還沒有店面"}
              </p>
            </div>
            {stores && stores.length > 0 && (
              <Link
                href="/dashboard/new-store"
                className="rounded-full bg-emerald-700 px-5 py-2.5 text-white text-sm font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
              >
                ＋ 開新店
              </Link>
            )}
          </div>

          {stores && stores.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stores.map((store) => {
                const productCount = productCounts[store.id] ?? 0;
                const orderCount = orderCountByStore[store.id] ?? 0;
                const monthRev = monthRevenueByStore[store.id] ?? 0;
                const pending = pendingByStore[store.id] ?? 0;
                return (
                  <div
                    key={store.id}
                    className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5 hover:shadow-xl hover:shadow-emerald-700/10 transition"
                  >
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <h3 className="text-lg font-bold text-emerald-950 min-w-0 truncate">
                        {store.name}
                      </h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                          store.is_published
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {store.is_published ? "已發布" : "草稿"}
                      </span>
                    </div>
                    <p className="text-sm text-emerald-900/50 mb-3 font-mono break-all">
                      sproutly.app/{store.slug}
                    </p>
                    {store.description && (
                      <p className="text-sm text-emerald-900/70 line-clamp-2 mb-4">
                        {store.description}
                      </p>
                    )}

                    {/* mini stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                      <div className="rounded-lg bg-emerald-50/60 px-2 py-2">
                        <p className="text-[10px] text-emerald-900/60 uppercase tracking-wider">
                          商品
                        </p>
                        <p className="text-sm font-bold text-emerald-950 mt-0.5">
                          {productCount}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50/60 px-2 py-2">
                        <p className="text-[10px] text-emerald-900/60 uppercase tracking-wider">
                          訂單
                        </p>
                        <p className="text-sm font-bold text-emerald-950 mt-0.5">
                          {orderCount}
                          {pending > 0 && (
                            <span className="ml-1 text-[10px] text-amber-700 font-medium">
                              ({pending} 待處理)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50/60 px-2 py-2">
                        <p className="text-[10px] text-emerald-900/60 uppercase tracking-wider">
                          本月
                        </p>
                        <p className="text-sm font-bold text-emerald-950 mt-0.5">
                          {monthRev > 0
                            ? formatPrice(monthRev)
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-emerald-50">
                      <Link
                        href={`/dashboard/stores/${store.slug}`}
                        className="flex-1 text-center text-sm rounded-full bg-emerald-700 text-white px-4 py-2 hover:bg-emerald-800 transition font-medium"
                      >
                        管理 →
                      </Link>
                      {store.is_published ? (
                        <Link
                          href={`/${store.slug}`}
                          target="_blank"
                          className="flex-1 text-center text-sm rounded-full border border-emerald-200 text-emerald-700 px-4 py-2 hover:bg-emerald-50 transition font-medium"
                        >
                          看店面 ↗
                        </Link>
                      ) : (
                        <span
                          title="店面是草稿狀態，發布後才能看到"
                          className="flex-1 text-center text-sm rounded-full border border-emerald-100 text-emerald-900/30 px-4 py-2 cursor-not-allowed font-medium"
                        >
                          未發布
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center shadow-xl shadow-emerald-700/5">
              <p className="text-xs tracking-widest uppercase text-emerald-600 mb-3">
                Welcome
              </p>
              <h3 className="text-xl font-bold text-emerald-950">
                還沒有店面
              </h3>
              <p className="mt-2 text-emerald-900/60 max-w-md mx-auto">
                建立你的第一間店，開始你的線上小生意
              </p>
              <Link
                href="/dashboard/new-store"
                className="mt-8 inline-block rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
              >
                ＋ 開第一間店
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
