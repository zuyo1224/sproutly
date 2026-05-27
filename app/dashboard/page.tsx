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

  // 純客人擋下：沒任何店，但 sproutly_customers 有 record，跳回首頁（避免客人誤入商家後台）
  if (!stores || stores.length === 0) {
    const { data: customer } = await supabase
      .from("sproutly_customers")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (customer) redirect("/");
  }

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
        <div className="mb-16">
          <p
            className="uppercase text-emerald-700/70"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            Dashboard
          </p>
          <h1
            className="mt-4 text-4xl md:text-5xl font-medium text-emerald-950 tracking-tight"
            style={{ lineHeight: 1.1, letterSpacing: "-0.01em" }}
          >
            Hi {name}
          </h1>
          <div
            className="mt-5 bg-emerald-700/40"
            style={{ width: "48px", height: "1px" }}
          />
          <p
            className="mt-5 text-emerald-900/55"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {user.email}
            {stores && stores.length > 0
              ? ` · ${stores.length} 間店在你手上`
              : " · 還沒開店，從零開始吧"}
          </p>
        </div>

        {/* 多店業績概覽 */}
        {stores && stores.length > 0 && (
          <section className="mb-16">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                className="bg-white rounded-2xl p-6"
                style={{ boxShadow: "var(--sproutly-elev-2)" }}
              >
                <p
                  className="uppercase text-emerald-700/70"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.4em",
                  }}
                >
                  總營收
                </p>
                <p
                  className="mt-4 text-emerald-950 font-medium"
                  style={{
                    fontSize: "1.875rem",
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatPrice(totalRevenue)}
                </p>
                <p className="mt-2 text-xs text-emerald-900/50">
                  {stores.length} 間店合計
                </p>
              </div>
              <div
                className="bg-white rounded-2xl p-6"
                style={{ boxShadow: "var(--sproutly-elev-2)" }}
              >
                <p
                  className="uppercase text-emerald-700/70"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.4em",
                  }}
                >
                  本月營收
                </p>
                <p
                  className="mt-4 text-emerald-950 font-medium"
                  style={{
                    fontSize: "1.875rem",
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatPrice(totalMonthRevenue)}
                </p>
                <p className="mt-2 text-xs text-emerald-900/50">已付款</p>
              </div>
              <div
                className="bg-white rounded-2xl p-6"
                style={{ boxShadow: "var(--sproutly-elev-2)" }}
              >
                <p
                  className="uppercase text-emerald-700/70"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.4em",
                  }}
                >
                  訂單數
                </p>
                <p
                  className="mt-4 text-emerald-950 font-medium"
                  style={{
                    fontSize: "1.875rem",
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {totalOrders}
                </p>
                <p className="mt-2 text-xs text-emerald-900/50">累計</p>
              </div>
              <div
                className={`rounded-2xl p-6 ${
                  totalPending > 0 ? "bg-amber-50" : "bg-white"
                }`}
                style={{ boxShadow: "var(--sproutly-elev-2)" }}
              >
                <p
                  className={`uppercase ${
                    totalPending > 0
                      ? "text-amber-700"
                      : "text-emerald-700/70"
                  }`}
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.4em",
                  }}
                >
                  待處理訂單
                </p>
                <p
                  className={`mt-4 font-medium ${
                    totalPending > 0 ? "text-amber-700" : "text-emerald-950"
                  }`}
                  style={{
                    fontSize: "1.875rem",
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {totalPending}
                </p>
                <p
                  className={`mt-2 text-xs ${
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
          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <p
                className="uppercase text-emerald-700/70"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.4em",
                }}
              >
                Storefronts
              </p>
              <h2
                className="mt-4 text-2xl md:text-3xl font-medium text-emerald-950 tracking-tight"
                style={{ lineHeight: 1.15, letterSpacing: "-0.01em" }}
              >
                我的店
              </h2>
              <div
                className="mt-4 bg-emerald-700/40"
                style={{ width: "48px", height: "1px" }}
              />
              <p
                className="mt-4 text-emerald-900/55"
                style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
              >
                {stores && stores.length > 0
                  ? `共 ${stores.length} 間 · 點進去管理或開新店`
                  : "還沒有店面 · 建一間試試"}
              </p>
            </div>
            {stores && stores.length > 0 && (
              <Link
                href="/dashboard/new-store"
                className="rounded-full bg-emerald-700 px-5 py-2.5 text-white text-sm font-medium hover:bg-emerald-800 transition flex-shrink-0"
                style={{ boxShadow: "var(--sproutly-elev-2)" }}
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
                    className="bg-white rounded-2xl p-7 sm:p-8 hover:translate-y-[-1px] transition"
                    style={{ boxShadow: "var(--sproutly-elev-2)" }}
                  >
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <h3
                        className="text-xl font-medium text-emerald-950 min-w-0 truncate"
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {store.name}
                      </h3>
                      <span
                        className={`uppercase px-2.5 py-1 rounded-full flex-shrink-0 ${
                          store.is_published
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 500,
                          letterSpacing: "0.3em",
                        }}
                      >
                        {store.is_published ? "Live" : "Draft"}
                      </span>
                    </div>
                    <p
                      className="text-emerald-900/45 mb-4 font-mono break-all"
                      style={{
                        fontSize: "0.75rem",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      sproutly.app/{store.slug}
                    </p>
                    {store.description && (
                      <p
                        className="text-emerald-900/65 line-clamp-2 mb-5"
                        style={{
                          fontSize: "0.875rem",
                          lineHeight: 1.7,
                        }}
                      >
                        {store.description}
                      </p>
                    )}

                    {/* mini stats */}
                    <div className="grid grid-cols-3 gap-2 mb-5 text-center">
                      <div className="rounded-lg bg-emerald-50/60 px-2 py-3">
                        <p
                          className="uppercase text-emerald-700/70"
                          style={{
                            fontSize: "0.625rem",
                            fontWeight: 500,
                            letterSpacing: "0.3em",
                          }}
                        >
                          商品
                        </p>
                        <p
                          className="text-emerald-950 mt-1.5 font-medium"
                          style={{
                            fontSize: "0.9375rem",
                            letterSpacing: "-0.01em",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {productCount}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50/60 px-2 py-3">
                        <p
                          className="uppercase text-emerald-700/70"
                          style={{
                            fontSize: "0.625rem",
                            fontWeight: 500,
                            letterSpacing: "0.3em",
                          }}
                        >
                          訂單
                        </p>
                        <p
                          className="text-emerald-950 mt-1.5 font-medium"
                          style={{
                            fontSize: "0.9375rem",
                            letterSpacing: "-0.01em",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {orderCount}
                          {pending > 0 && (
                            <span
                              className="ml-1 text-amber-700 font-medium"
                              style={{ fontSize: "0.6875rem" }}
                            >
                              ({pending} 待)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg bg-emerald-50/60 px-2 py-3">
                        <p
                          className="uppercase text-emerald-700/70"
                          style={{
                            fontSize: "0.625rem",
                            fontWeight: 500,
                            letterSpacing: "0.3em",
                          }}
                        >
                          本月
                        </p>
                        <p
                          className="text-emerald-950 mt-1.5 font-medium"
                          style={{
                            fontSize: "0.9375rem",
                            letterSpacing: "-0.01em",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {monthRev > 0 ? formatPrice(monthRev) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-emerald-50">
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
            <div
              className="bg-white rounded-3xl p-14 text-center"
              style={{ boxShadow: "var(--sproutly-elev-2)" }}
            >
              <p
                className="uppercase text-emerald-700/70"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.4em",
                }}
              >
                Welcome
              </p>
              <div
                className="mt-4 mx-auto bg-emerald-700/40"
                style={{ width: "40px", height: "1px" }}
              />
              <h3
                className="mt-6 text-2xl md:text-3xl font-medium text-emerald-950"
                style={{ lineHeight: 1.15, letterSpacing: "-0.01em" }}
              >
                還沒有店面
              </h3>
              <p
                className="mt-4 text-emerald-900/55 max-w-md mx-auto"
                style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
              >
                建立你的第一間店，開始你的線上小生意
              </p>
              <Link
                href="/dashboard/new-store"
                className="mt-10 inline-block rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition"
                style={{ boxShadow: "var(--sproutly-elev-2)" }}
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
