import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { resolveTheme } from "@/app/[slug]/_theme";
import { updateOrderStatus } from "./orders/[orderId]/actions";

type Params = Promise<{ slug: string }>;

// 後台首頁的金額一律跟著這間店實際出單的幣別走（共用 formatPrice，不再對非 TWD 店家硬寫 NT$）。
import { formatPrice } from "@/lib/format-price";
import { isSoldOut, LOW_STOCK_THRESHOLD } from "@/lib/product-stock";
// 訂單狀態徽章（label + 色票）跟訂單列表、訂單詳情共用同一份，三頁同一筆單同色同字。
import { ORDER_STATUS_BADGES } from "@/lib/order-labels";

// 回傳該時刻在台灣時區的日期字串（YYYY-MM-DD），分日統計一律用這個當 key，
// 不能用 toISOString / created_at 直接切：那是 UTC 日界線，跟台灣差 8 小時
function taipeiDateKey(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

export default async function StoreInsightsPage({
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
    .select(
      "id, name, slug, description, contact_phone, contact_email, address, business_hours, theme, is_published"
    )
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);
  const businessHoursText =
    typeof store.business_hours === "object" && store.business_hours !== null
      ? ((store.business_hours as { text?: string }).text ?? "")
      : "";

  // 過去 30 天訂單 + 商品數 + 全部訂單摘要（用來算統計）
  const now = new Date();
  const todayKey = taipeiDateKey(now);
  // 台灣的今天 00:00 與本月 1 號 00:00（伺服器在 Vercel 是 UTC，不能用本地 midnight）
  const taipeiMidnight = new Date(`${todayKey}T00:00:00+08:00`);
  const startOfMonth = new Date(`${todayKey.slice(0, 7)}-01T00:00:00+08:00`);
  const since14 = new Date(taipeiMidnight.getTime() - 13 * 86_400_000);

  const [
    { count: productCount },
    { data: allOrders },
    { data: monthOrders },
    { data: recentOrders },
    { data: orderItems },
    { data: lowStockProducts },
  ] = await Promise.all([
    supabase
      .from("sproutly_products")
      .select("*", { count: "exact", head: true })
      .eq("merchant_id", store.id),
    supabase
      .from("sproutly_orders")
      .select("id, created_at, total_cents, status, payment_status, currency")
      .eq("merchant_id", store.id),
    supabase
      .from("sproutly_orders")
      .select("id, total_cents, payment_status, status")
      .eq("merchant_id", store.id)
      .gte("created_at", startOfMonth.toISOString()),
    supabase
      .from("sproutly_orders")
      .select("*")
      .eq("merchant_id", store.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("sproutly_order_items")
      .select(
        "product_id, name_snapshot, quantity, price_cents_snapshot, sproutly_orders!inner(merchant_id, status)"
      )
      .eq("sproutly_orders.merchant_id", store.id)
      .neq("sproutly_orders.status", "cancelled"),
    supabase
      .from("sproutly_products")
      .select("id, name, stock, image_urls")
      .eq("merchant_id", store.id)
      .eq("is_active", true)
      .not("stock", "is", null)
      // 快沒貨/售完門檻收進 product-stock 的 LOW_STOCK_THRESHOLD，跟後台商品列表、
      // 客人端「剩 N」同一份。以前寫死 < 5（≤4），客人端卻是 ≤3，兩邊對不上。
      .lte("stock", LOW_STOCK_THRESHOLD)
      .order("stock", { ascending: true })
      .limit(10),
  ]);

  // 這間店出單用的幣別。跟訂單列表頁同一套：拿任一筆訂單的 currency 當基準
  // （單一店家實務上同一種幣別），沒有訂單時退回 TWD。
  const storeCurrency = allOrders?.[0]?.currency ?? "TWD";

  const totalOrders = allOrders?.length ?? 0;
  const totalRevenue =
    allOrders
      ?.filter(
        (o) => o.payment_status === "paid" && o.status !== "cancelled"
      )
      .reduce((sum, o) => sum + o.total_cents, 0) ?? 0;
  const pendingOrders =
    allOrders?.filter((o) => o.status === "pending").length ?? 0;
  // 「出貨了還沒收到錢」的應收。轉帳 / 貨到付款的店家最在意這個，
  // 但首頁四張指標只有「已付款」營收，看不出還有多少錢在外面——
  // 訂單列表（pay=unpaid 篩選）、客人列表、趨勢圖都已標出，唯獨第一眼的首頁漏了。
  // 口徑跟訂單列表一致：未取消的單裡 payment_status 還是 unpaid 的（已退款不算）。
  const unpaidOrders =
    allOrders?.filter(
      (o) => o.status !== "cancelled" && o.payment_status === "unpaid"
    ) ?? [];
  const outstandingCount = unpaidOrders.length;
  const outstandingCents = unpaidOrders.reduce(
    (sum, o) => sum + o.total_cents,
    0
  );
  const monthRevenue =
    monthOrders
      ?.filter(
        (o) => o.payment_status === "paid" && o.status !== "cancelled"
      )
      .reduce((sum, o) => sum + o.total_cents, 0) ?? 0;
  const monthOrderCount = monthOrders?.length ?? 0;
  const avgOrderValue =
    totalOrders > 0
      ? Math.round(
          (allOrders!
            .filter((o) => o.status !== "cancelled")
            .reduce((s, o) => s + o.total_cents, 0) /
            Math.max(
              allOrders!.filter((o) => o.status !== "cancelled").length,
              1
            ))
        )
      : 0;

  // 14 天訂單趨勢（按台灣時區分日 group）
  const dayMap = new Map<
    string,
    { label: string; orders: number; revenue: number }
  >();
  for (let i = 13; i >= 0; i--) {
    const key = taipeiDateKey(
      new Date(taipeiMidnight.getTime() - i * 86_400_000)
    );
    dayMap.set(key, {
      label: `${parseInt(key.slice(5, 7), 10)}/${parseInt(key.slice(8, 10), 10)}`,
      orders: 0,
      revenue: 0,
    });
  }
  allOrders
    ?.filter((o) => new Date(o.created_at) >= since14)
    .forEach((o) => {
      const key = taipeiDateKey(new Date(o.created_at));
      const stats = dayMap.get(key);
      if (stats) {
        stats.orders++;
        if (
          o.payment_status === "paid" &&
          o.status !== "cancelled"
        ) {
          stats.revenue += o.total_cents;
        }
      }
    });
  const trendData = Array.from(dayMap.values());
  const maxOrders = Math.max(...trendData.map((d) => d.orders), 1);
  // 這 14 天的總筆數與總進帳。revenue 本來每天都算好了卻只拿來畫筆數，
  // 店家分不出「來了單」跟「真的收到錢」——把已算好的進帳一起顯示。
  const total14Orders = trendData.reduce((s, d) => s + d.orders, 0);
  const total14Revenue = trendData.reduce((s, d) => s + d.revenue, 0);

  // 熱銷商品 top 5
  const productMap = new Map<
    string,
    { name: string; qty: number; revenue: number; productId: string | null }
  >();
  type ItemRow = {
    product_id: string | null;
    name_snapshot: string;
    quantity: number;
    price_cents_snapshot: number;
  };
  (orderItems as ItemRow[] | null)?.forEach((item) => {
    const key = item.product_id ?? `__deleted_${item.name_snapshot}`;
    const existing = productMap.get(key) ?? {
      name: item.name_snapshot,
      qty: 0,
      revenue: 0,
      productId: item.product_id,
    };
    existing.qty += item.quantity;
    existing.revenue += item.price_cents_snapshot * item.quantity;
    productMap.set(key, existing);
  });
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // 店面設置進度（6 步）
  const settingsHref = `/dashboard/stores/${slug}/settings`;
  const productsHref = `/dashboard/stores/${slug}/products`;
  const onboardingSteps = [
    {
      label: "填店名 + 簡介",
      done: !!store.name && !!store.description,
      href: settingsHref,
    },
    {
      label: "上傳 Logo 或 Hero 大圖",
      done: !!theme.logoUrl || !!theme.heroUrl,
      href: settingsHref,
    },
    {
      label: "加 3 個以上商品",
      done: (productCount ?? 0) >= 3,
      href: productsHref,
    },
    {
      label: "填聯絡資訊（電話 / Email / 地址擇一）",
      done:
        !!store.contact_phone ||
        !!store.contact_email ||
        !!store.address,
      href: settingsHref,
    },
    {
      label: "設定營業時間",
      done: !!businessHoursText,
      href: settingsHref,
    },
    {
      label: "發布店面，讓客人能看到",
      done: !!store.is_published,
      href: settingsHref,
    },
  ];
  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const allDone = completedSteps === onboardingSteps.length;
  const progressPct = (completedSteps / onboardingSteps.length) * 100;

  return (
    <div className="space-y-6">
      {!allDone && (
        <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
          <div className="flex items-start justify-between mb-5 gap-4">
            <div>
              <p className="text-[10px] tracking-[0.28em] uppercase text-emerald-700/70">
                Onboarding
              </p>
              <h3 className="mt-1.5 text-lg font-medium text-emerald-950 tracking-tight">
                店面設置進度
              </h3>
              <p className="text-xs text-emerald-900/55 mt-1">
                完成這 6 步，朋友就能看到你的店、客人也能下單
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-medium text-emerald-700 tracking-tight">
                {completedSteps}/{onboardingSteps.length}
              </div>
              <div className="text-xs text-emerald-900/50 mt-0.5">
                {Math.round(progressPct)}% 完成
              </div>
            </div>
          </div>

          <div className="h-2 bg-emerald-50 rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <ul className="space-y-1.5">
            {onboardingSteps.map((s, i) => (
              <li key={i}>
                {s.done ? (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                    <span
                      aria-hidden="true"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-600 text-white flex-shrink-0"
                    >
                      ✓
                    </span>
                    {/* 報讀器只看到 line-through（純視覺）跟孤立的 ✓（念成核取記號），
                        聽不出這步「已完成」；補一句 sr-only 把狀態講白。 */}
                    <span className="sr-only">已完成：</span>
                    <span className="text-sm text-emerald-900/60 line-through">
                      {s.label}
                    </span>
                  </div>
                ) : (
                  <Link
                    href={s.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50/60 transition group"
                  >
                    <span
                      aria-hidden="true"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-100 text-emerald-700 flex-shrink-0"
                    >
                      {i + 1}
                    </span>
                    <span className="sr-only">待完成：</span>
                    <span className="flex-1 text-sm font-medium text-emerald-950">
                      {s.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-xs text-emerald-700 opacity-0 group-hover:opacity-100 transition"
                    >
                      去做 →
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {allDone && !store.is_published && (
        <section className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
          <h3 className="font-semibold text-amber-900">
            ⚠ 店面還沒發布
          </h3>
          <p className="text-sm text-amber-800/80 mt-1">
            設定都完成了，但店面是草稿狀態。客人現在還看不到你的店。
          </p>
          <Link
            href={settingsHref}
            className="mt-3 inline-block text-sm font-medium text-amber-900 hover:text-amber-700 transition"
          >
            去發布 →
          </Link>
        </section>
      )}

      {/* 4 個主要指標 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5">
          <p className="text-[10px] text-emerald-700/70 uppercase tracking-[0.28em]">
            總營收（已付款）
          </p>
          <p className="mt-3 text-2xl font-medium text-emerald-950 tracking-tight">
            {formatPrice(totalRevenue, storeCurrency)}
          </p>
          <p className="mt-1.5 text-xs text-emerald-900/50">
            來自 {allOrders?.filter((o) => o.payment_status === "paid").length ?? 0} 筆訂單
          </p>
        </div>
        <Link
          href={`/dashboard/stores/${slug}/orders`}
          className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5 hover:shadow-xl transition"
        >
          <p className="text-[10px] text-emerald-700/70 uppercase tracking-[0.28em]">
            訂單總數
          </p>
          <p className="mt-3 text-2xl font-medium text-emerald-950 tracking-tight">
            {totalOrders}
          </p>
          <p className="mt-1.5 text-xs text-emerald-900/50">
            平均 {formatPrice(avgOrderValue, storeCurrency)}/筆
          </p>
        </Link>
        <Link
          href={`/dashboard/stores/${slug}/orders`}
          className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5 hover:shadow-xl transition"
        >
          <p className="text-[10px] text-emerald-700/70 uppercase tracking-[0.28em]">
            待處理訂單
          </p>
          <p
            className={`mt-3 text-2xl font-medium tracking-tight ${
              pendingOrders > 0 ? "text-amber-600" : "text-emerald-950"
            }`}
          >
            {pendingOrders}
          </p>
          <p className="mt-1.5 text-xs text-emerald-900/50">
            {pendingOrders > 0 ? "請盡快確認" : "都處理完了"}
          </p>
        </Link>
        <div className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5">
          <p className="text-[10px] text-emerald-700/70 uppercase tracking-[0.28em]">
            本月營收
          </p>
          <p className="mt-3 text-2xl font-medium text-emerald-950 tracking-tight">
            {formatPrice(monthRevenue, storeCurrency)}
          </p>
          <p className="mt-1.5 text-xs text-emerald-900/50">
            本月 {monthOrderCount} 筆訂單
          </p>
        </div>
      </div>

      {/* 應收（出貨了還沒收到錢）— 轉帳 / 貨到付款的店家一眼看到還有多少錢在外面，
          直接點進訂單列表的「未付款」篩選去追。沒有未收款就不顯示，保持乾淨。 */}
      {outstandingCount > 0 && (
        <Link
          href={`/dashboard/stores/${slug}/orders?pay=unpaid`}
          className="flex items-center justify-between gap-4 bg-amber-50 rounded-2xl px-6 py-4 border border-amber-200 hover:bg-amber-100/60 transition group"
        >
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.28em] uppercase text-amber-700/80">
              Outstanding
            </p>
            <p className="mt-1 text-sm text-amber-900/90">
              有 <span className="font-semibold">{outstandingCount}</span>{" "}
              筆訂單還沒收到錢
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-medium text-amber-800 tracking-tight">
              {formatPrice(outstandingCents, storeCurrency)}
            </p>
            <p className="text-[11px] text-amber-700/70 group-hover:text-amber-800 transition">
              看未付款訂單 →
            </p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 14 天訂單趨勢 */}
        <section className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] tracking-[0.28em] uppercase text-emerald-700/70">
                Trend · 14d
              </p>
              <h3 className="mt-1.5 text-lg font-medium text-emerald-950 tracking-tight">
                過去 14 天訂單趨勢
              </h3>
              <p className="text-xs text-emerald-900/50 mt-1">
                每天接到的訂單數
              </p>
            </div>
            <p className="text-xs text-emerald-900/55 text-right">
              共 {total14Orders} 筆
              {total14Revenue > 0 && (
                <>
                  <br />
                  <span className="text-emerald-900/45">
                    進帳 {formatPrice(total14Revenue, storeCurrency)}
                  </span>
                </>
              )}
            </p>
          </div>
          {trendData.every((d) => d.orders === 0) ? (
            <div className="h-40 flex items-center justify-center text-sm text-emerald-900/40">
              這 14 天還沒有訂單
            </div>
          ) : (
            /* 長條圖純靠高度與 hover 浮層傳資料，報讀器使用者觸發不了浮層、
               念到的反而是 DOM 裡 opacity-0 的浮層字（每個空日子都念「尚無訂單」很吵）。
               整排補 role=list、每根長條補一句完整 aria-label（日期＋筆數＋進帳），
               內部浮層與日期字改 aria-hidden 退出報讀器，避免重複念。零視覺更動。 */
            <div
              className="flex items-end gap-1.5 h-40"
              role="list"
              aria-label="過去 14 天每日訂單數"
            >
              {trendData.map((d, i) => {
                const heightPct = (d.orders / maxOrders) * 100;
                const isToday = i === trendData.length - 1;
                const dateStr = d.label;
                const srLabel = `${d.label}${isToday ? "（今天）" : ""}：${
                  d.orders === 0
                    ? "尚無訂單"
                    : `${d.orders} 筆訂單${
                        d.revenue > 0
                          ? `，進帳 ${formatPrice(d.revenue, storeCurrency)}`
                          : "，未進帳"
                      }`
                }`;
                return (
                  <div
                    key={i}
                    role="listitem"
                    aria-label={srLabel}
                    className="relative flex-1 flex flex-col items-center gap-1.5 group"
                  >
                    {/* 浮層用絕對定位，不撐高長條；hover 同時看到當天筆數與進帳，
                        當天有單卻沒收到錢就明寫「未進帳」，一眼分得出空有訂單的日子。 */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full z-10 px-2 py-1 rounded-md bg-emerald-900 text-white text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-sm"
                    >
                      {d.orders === 0
                        ? "尚無訂單"
                        : `${d.orders} 筆 · ${
                            d.revenue > 0 ? formatPrice(d.revenue, storeCurrency) : "未進帳"
                          }`}
                    </div>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition group-hover:opacity-80 ${
                          isToday ? "bg-emerald-700" : "bg-emerald-400"
                        }`}
                        style={{
                          height: d.orders > 0 ? `${Math.max(heightPct, 4)}%` : "2px",
                          opacity: d.orders > 0 ? 1 : 0.15,
                        }}
                      />
                    </div>
                    <span
                      aria-hidden="true"
                      className={`text-[10px] ${
                        isToday
                          ? "text-emerald-900 font-medium"
                          : "text-emerald-900/40"
                      }`}
                    >
                      {dateStr}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 熱銷商品 top 5 */}
        <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
          <p className="text-[10px] tracking-[0.28em] uppercase text-emerald-700/70">
            Top Sellers
          </p>
          <h3 className="mt-1.5 text-lg font-medium text-emerald-950 tracking-tight">
            熱銷商品
          </h3>
          <p className="text-xs text-emerald-900/50 mb-5 mt-1">依營收排序</p>
          {topProducts.length > 0 ? (
            <ol className="space-y-3">
              {topProducts.map((p, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? "bg-amber-100 text-amber-800"
                        : i === 1
                          ? "bg-zinc-200 text-zinc-700"
                          : i === 2
                            ? "bg-orange-100 text-orange-800"
                            : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-950 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-emerald-900/50">
                      賣出 {p.qty} 件
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-950">
                    {formatPrice(p.revenue, storeCurrency)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-emerald-900/40 text-center py-8">
              還沒有銷售紀錄
            </p>
          )}
        </section>
      </div>

      {/* 庫存警示 */}
      {lowStockProducts && lowStockProducts.length > 0 && (
        <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5 border-l-4 border-amber-400">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] tracking-[0.28em] uppercase text-amber-700/80">
                Low Stock
              </p>
              <h3 className="mt-1.5 text-lg font-medium text-emerald-950 tracking-tight">
                庫存不足
              </h3>
              <p className="text-xs text-emerald-900/50 mt-1">
                {lowStockProducts.length} 件商品庫存剩 {LOW_STOCK_THRESHOLD} 件以內
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lowStockProducts.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/stores/${slug}/products/${p.id}/edit`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-50/60 transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {p.image_urls && p.image_urls.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_urls[0]}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-emerald-900/40 tracking-wider">
                      —
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-950 truncate">
                    {p.name}
                  </p>
                  <p
                    className={`text-xs ${
                      isSoldOut(p.stock)
                        ? "text-red-600 font-medium"
                        : "text-amber-700"
                    }`}
                  >
                    {isSoldOut(p.stock) ? "已售完" : `剩 ${p.stock} 件`}
                  </p>
                </div>
                <span className="text-xs text-emerald-700 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                  補貨 →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 近期訂單 */}
      <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-[10px] tracking-[0.28em] uppercase text-emerald-700/70">
              Recent
            </p>
            <h3 className="mt-1.5 text-lg font-medium text-emerald-950 tracking-tight">
              近期訂單
            </h3>
          </div>
          <Link
            href={`/dashboard/stores/${slug}/orders`}
            className="text-xs text-emerald-700 hover:text-emerald-900 transition"
          >
            看全部 →
          </Link>
        </div>
        {recentOrders && recentOrders.length > 0 ? (
          <div className="space-y-1">
            {recentOrders.map((o) => {
              const status =
                ORDER_STATUS_BADGES[o.status] ?? ORDER_STATUS_BADGES.pending;
              const isPending = o.status === "pending";
              return (
                <div
                  key={o.id}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-emerald-50/50 transition group"
                >
                  <Link
                    href={`/dashboard/stores/${slug}/orders/${o.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <span className="font-mono text-xs text-emerald-900/60 w-16 flex-shrink-0">
                      #{o.id.split("-")[0].toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-950 truncate">
                        {o.customer_name}
                      </p>
                      <p className="text-xs text-emerald-900/50">
                        {o.customer_phone}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${status.color}`}
                    >
                      {status.label}
                    </span>
                    <span className="font-semibold text-emerald-950 text-sm w-20 sm:w-24 text-right flex-shrink-0">
                      {formatPrice(o.total_cents, storeCurrency)}
                    </span>
                    <span className="text-xs text-emerald-900/40 hidden md:inline w-20 text-right flex-shrink-0">
                      {new Date(o.created_at).toLocaleString("zh-TW", {
                        timeZone: "Asia/Taipei",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </Link>
                  {isPending && (
                    <form
                      action={updateOrderStatus.bind(null, slug, o.id)}
                      className="flex-shrink-0"
                    >
                      <input
                        type="hidden"
                        name="status"
                        value="confirmed"
                      />
                      <button
                        type="submit"
                        className="text-xs px-3 py-1.5 rounded-full bg-emerald-700 text-white hover:bg-emerald-800 transition font-medium shadow-sm"
                        title="一鍵確認訂單"
                      >
                        確認{" "}
                        <span aria-hidden="true">✓</span>
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-emerald-900/40 text-center py-8">
            還沒有訂單
          </p>
        )}
      </section>

      {/* 店資訊（縮成小 row）*/}
      <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[10px] tracking-[0.28em] uppercase text-emerald-700/70">
              Info
            </p>
            <h3 className="mt-1.5 text-base font-medium text-emerald-900 tracking-tight">
              基本資訊
            </h3>
          </div>
          <span className="text-xs text-emerald-900/45">
            商品 {productCount ?? 0} 件
          </span>
        </div>
        <dl className="space-y-1.5 text-sm">
          {store.contact_phone && (
            <div className="flex gap-3">
              <dt className="text-emerald-900/50 w-16">電話</dt>
              <dd className="text-emerald-900/90">{store.contact_phone}</dd>
            </div>
          )}
          {store.contact_email && (
            <div className="flex gap-3">
              <dt className="text-emerald-900/50 w-16">Email</dt>
              <dd className="text-emerald-900/90">{store.contact_email}</dd>
            </div>
          )}
          {store.address && (
            <div className="flex gap-3">
              <dt className="text-emerald-900/50 w-16">地址</dt>
              <dd className="text-emerald-900/90">{store.address}</dd>
            </div>
          )}
          {!store.contact_phone &&
            !store.contact_email &&
            !store.address && (
              <p className="text-emerald-900/40 italic text-sm">
                還沒填聯絡資訊。
                <Link
                  href={`/dashboard/stores/${slug}/settings`}
                  className="text-emerald-700 hover:text-emerald-900 not-italic ml-1"
                >
                  去填寫 →
                </Link>
              </p>
            )}
        </dl>
      </section>
    </div>
  );
}
