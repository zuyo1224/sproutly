import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{
  status?: string;
  q?: string;
  range?: string;
}>;

const DATE_RANGES: { key: string; label: string }[] = [
  { key: "all", label: "全部時間" },
  { key: "today", label: "今天" },
  { key: "week", label: "本週" },
  { key: "month", label: "本月" },
];

function computeDateRange(key: string): { since: Date | null; until: Date | null } {
  const now = new Date();
  if (key === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { since: start, until: null };
  }
  if (key === "week") {
    const start = new Date(now);
    const day = start.getDay() === 0 ? 7 : start.getDay(); // 週日視為第 7 天
    start.setDate(start.getDate() - (day - 1)); // 回到本週一
    start.setHours(0, 0, 0, 0);
    return { since: start, until: null };
  }
  if (key === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { since: start, until: null };
  }
  return { since: null, until: null };
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待確認" },
  { key: "confirmed", label: "已確認" },
  { key: "shipped", label: "已出貨" },
  { key: "completed", label: "已完成" },
  { key: "cancelled", label: "已取消" },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "待確認", color: "bg-amber-100 text-amber-800" },
  confirmed: { label: "已確認", color: "bg-blue-100 text-blue-800" },
  shipped: { label: "已出貨", color: "bg-purple-100 text-purple-800" },
  completed: { label: "已完成", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "已取消", color: "bg-zinc-100 text-zinc-600" },
};

const PAYMENT_LABEL: Record<string, { label: string; color: string }> = {
  unpaid: { label: "未付款", color: "text-amber-700" },
  paid: { label: "已付款", color: "text-emerald-700" },
  refunded: { label: "已退款", color: "text-zinc-600" },
};

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export default async function OrdersListPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const {
    status: statusFilter,
    q: searchQuery,
    range: rangeFilter,
  } = await searchParams;
  const status =
    statusFilter && STATUS_FILTERS.some((f) => f.key === statusFilter)
      ? statusFilter
      : "all";
  const q = (searchQuery ?? "").trim();
  const range = DATE_RANGES.some((r) => r.key === rangeFilter)
    ? rangeFilter!
    : "all";
  const dateRange = computeDateRange(range);

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

  // 算每個狀態的 count（不受目前 filter 影響）
  const { data: allOrders } = await supabase
    .from("sproutly_orders")
    .select("status")
    .eq("merchant_id", store.id);
  const statusCounts: Record<string, number> = { all: allOrders?.length ?? 0 };
  allOrders?.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  });

  // 套用 filter + search 查訂單
  let query = supabase
    .from("sproutly_orders")
    .select("*")
    .eq("merchant_id", store.id);
  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    // 用 or 搜尋姓名 / 電話 / email
    const escaped = q.replace(/[%_]/g, (m) => `\\${m}`);
    query = query.or(
      `customer_name.ilike.%${escaped}%,customer_phone.ilike.%${escaped}%,customer_email.ilike.%${escaped}%`
    );
  }
  if (dateRange.since) {
    query = query.gte("created_at", dateRange.since.toISOString());
  }
  const { data: orders } = await query.order("created_at", {
    ascending: false,
  });

  // 給 chip 用的 URL builder
  function chipHref(s: string) {
    const params = new URLSearchParams();
    if (s !== "all") params.set("status", s);
    if (q) params.set("q", q);
    if (range !== "all") params.set("range", range);
    const qs = params.toString();
    return `/dashboard/stores/${slug}/orders${qs ? `?${qs}` : ""}`;
  }

  function dateRangeHref(r: string) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    if (r !== "all") params.set("range", r);
    const qs = params.toString();
    return `/dashboard/stores/${slug}/orders${qs ? `?${qs}` : ""}`;
  }

  const filterActive = q !== "" || status !== "all" || range !== "all";
  const matchCount = orders?.length ?? 0;
  const headerCaption = filterActive
    ? `符合條件 ${matchCount} 筆 · 全部 ${statusCounts.all} 筆`
    : statusCounts.all > 0
      ? `${statusCounts.all} 筆訂單 · 點任一筆看詳情`
      : "客人在店面下單後會出現在這裡";

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
            Orders · 訂單
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl text-emerald-950 font-medium tracking-tight"
            style={{ letterSpacing: "-0.01em", lineHeight: 1.15 }}
          >
            追蹤每一筆訂單
          </h2>
          <span
            aria-hidden
            className="mt-4 block h-px w-12 bg-emerald-600/60"
          />
          <p
            className="mt-4 text-emerald-900/65"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {headerCaption}
          </p>
        </div>
        {statusCounts.all > 0 && (
          <a
            href={`/dashboard/stores/${slug}/orders/export`}
            className="rounded-full bg-white border-2 border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50 transition"
          >
            ⬇ 匯出 CSV
          </a>
        )}
      </div>

      {/* 狀態 chips + 日期 chips + 搜尋 bar */}
      <div className="bg-white rounded-2xl p-4 shadow-lg shadow-emerald-700/5 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const count = statusCounts[f.key] ?? 0;
            const active = status === f.key;
            return (
              <Link
                key={f.key}
                href={chipHref(f.key)}
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
                  {count}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-emerald-900/50 mr-1">時間：</span>
          {DATE_RANGES.map((r) => {
            const active = range === r.key;
            return (
              <Link
                key={r.key}
                href={dateRangeHref(r.key)}
                className={`text-sm px-3 py-1 rounded-full transition ${
                  active
                    ? "bg-emerald-100 text-emerald-900 font-medium"
                    : "text-emerald-900/60 hover:bg-emerald-50"
                }`}
              >
                {r.label}
              </Link>
            );
          })}
        </div>

        <form
          action={`/dashboard/stores/${slug}/orders`}
          method="GET"
          className="flex gap-2"
        >
          {status !== "all" && (
            <input type="hidden" name="status" value={status} />
          )}
          {range !== "all" && (
            <input type="hidden" name="range" value={range} />
          )}
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="搜尋顧客姓名 / 電話 / Email..."
            className="flex-1 rounded-full border border-emerald-100 px-4 py-2 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition text-sm"
          />
          <button
            type="submit"
            className="rounded-full bg-emerald-700 text-white px-5 py-2 text-sm font-medium hover:bg-emerald-800 transition"
          >
            搜尋
          </button>
          {(q || status !== "all") && (
            <Link
              href={`/dashboard/stores/${slug}/orders`}
              className="rounded-full border border-emerald-100 px-4 py-2 text-sm text-emerald-900/70 hover:bg-emerald-50 transition"
            >
              清除
            </Link>
          )}
        </form>
      </div>

      {orders && orders.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-lg shadow-emerald-700/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-emerald-50/50 text-xs uppercase tracking-wider text-emerald-900/60">
              <tr>
                <th className="text-left px-5 py-3">訂單</th>
                <th className="text-left px-5 py-3">顧客</th>
                <th className="text-left px-5 py-3">金額</th>
                <th className="text-left px-5 py-3">狀態</th>
                <th className="text-left px-5 py-3">付款</th>
                <th className="text-left px-5 py-3">時間</th>
                <th className="text-right px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const s = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending;
                const p =
                  PAYMENT_LABEL[o.payment_status] ?? PAYMENT_LABEL.unpaid;
                // 待確認 = 商家還沒處理的單，給整列上色 + 左側色條，掃一眼就抓得到哪幾筆要回
                const needsAction = o.status === "pending";
                return (
                  <tr
                    key={o.id}
                    className={
                      needsAction
                        ? "bg-amber-50/50"
                        : i % 2 === 0
                          ? "bg-white"
                          : "bg-emerald-50/20"
                    }
                  >
                    <td
                      className={`px-5 py-4 font-mono text-emerald-900 border-l-[3px] ${
                        needsAction
                          ? "border-amber-400"
                          : "border-transparent"
                      }`}
                    >
                      #{o.id.split("-")[0].toUpperCase()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-emerald-950 font-medium">
                        {o.customer_name}
                      </div>
                      <div className="text-xs text-emerald-900/50">
                        {o.customer_phone}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-emerald-950">
                      {formatPrice(o.total_cents, o.currency)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded-full ${s.color}`}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className={`px-5 py-4 text-xs ${p.color}`}>
                      {p.label}
                    </td>
                    <td className="px-5 py-4 text-xs text-emerald-900/60">
                      {new Date(o.created_at).toLocaleString("zh-TW", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/stores/${slug}/orders/${o.id}`}
                        className="text-emerald-700 hover:text-emerald-900 text-sm font-medium"
                      >
                        詳情 →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
            {filterActive ? "No Match · 沒有符合" : "Empty · 還沒接單"}
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
                條件的訂單
              </>
            ) : (
              <>
                還沒有
                <br />
                客人下單
              </>
            )}
          </h3>
          <p
            className="mt-5 text-emerald-900/65 max-w-md mx-auto"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {filterActive
              ? "換個篩選條件或清除搜尋試試"
              : "客人在店面下單後，會出現在這個列表"}
          </p>
        </div>
      )}
    </div>
  );
}
