import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{
  status?: string;
  q?: string;
  range?: string;
  pay?: string;
}>;

const DATE_RANGES: { key: string; label: string }[] = [
  { key: "all", label: "全部時間" },
  { key: "today", label: "今天" },
  { key: "week", label: "本週" },
  { key: "month", label: "本月" },
];

// 跟後台首頁同一套：日界線一律用台灣時間切，伺服器在 UTC 跑也不會把凌晨的單漏掉
function taipeiDateKey(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

function computeDateRange(key: string): { since: Date | null } {
  const todayKey = taipeiDateKey(new Date()); // YYYY-MM-DD（台灣的今天）
  const midnight = new Date(`${todayKey}T00:00:00+08:00`);
  if (key === "today") {
    return { since: midnight };
  }
  if (key === "week") {
    const day = new Date(`${todayKey}T00:00:00Z`).getUTCDay(); // 台灣今天星期幾，0 = 週日
    const back = day === 0 ? 6 : day - 1; // 回到本週一
    return { since: new Date(midnight.getTime() - back * 86_400_000) };
  }
  if (key === "month") {
    return { since: new Date(`${todayKey.slice(0, 8)}01T00:00:00+08:00`) };
  }
  return { since: null };
}

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待確認" },
  { key: "confirmed", label: "已確認" },
  { key: "shipped", label: "已出貨" },
  { key: "completed", label: "已完成" },
  { key: "cancelled", label: "已取消" },
];

// 做轉帳 / 貨到付款的店家常要找「出貨了還沒收到錢」的單，
// 訂單狀態 chip 篩不出這件事，另外給一排付款狀態的篩選。
const PAYMENT_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "unpaid", label: "未付款" },
  { key: "paid", label: "已付款" },
  { key: "refunded", label: "已退款" },
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
    pay: payFilter,
  } = await searchParams;
  const status =
    statusFilter && STATUS_FILTERS.some((f) => f.key === statusFilter)
      ? statusFilter
      : "all";
  const pay =
    payFilter && PAYMENT_FILTERS.some((f) => f.key === payFilter)
      ? payFilter
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
    .select("status, payment_status")
    .eq("merchant_id", store.id);
  const statusCounts: Record<string, number> = { all: allOrders?.length ?? 0 };
  const paymentCounts: Record<string, number> = { all: allOrders?.length ?? 0 };
  allOrders?.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    paymentCounts[o.payment_status] =
      (paymentCounts[o.payment_status] ?? 0) + 1;
  });

  // 套用 filter + search 查訂單
  let query = supabase
    .from("sproutly_orders")
    .select("*")
    .eq("merchant_id", store.id);
  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (pay !== "all") {
    query = query.eq("payment_status", pay);
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

  // 這批篩出來的單裡錢的狀況：已取消的不算錢（沒成交）。
  // 轉帳 / 貨到付款的店家最在意「未收」這個數字 — 篩到「已出貨 + 未付款」時，
  // 這條就直接告訴他現在還有多少錢在外面沒進來，不用自己一筆筆加。
  const moneyOrders = (orders ?? []).filter((o) => o.status !== "cancelled");
  const summaryCurrency = orders?.[0]?.currency ?? "TWD";
  const receivedCents = moneyOrders
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + o.total_cents, 0);
  const unpaidOrders = moneyOrders.filter((o) => o.payment_status === "unpaid");
  const outstandingCents = unpaidOrders.reduce((sum, o) => sum + o.total_cents, 0);

  // 給 chip 用的 URL builder（每個只換自己那一維，其餘篩選原樣帶著走）
  function chipHref(s: string) {
    const params = new URLSearchParams();
    if (s !== "all") params.set("status", s);
    if (q) params.set("q", q);
    if (range !== "all") params.set("range", range);
    if (pay !== "all") params.set("pay", pay);
    const qs = params.toString();
    return `/dashboard/stores/${slug}/orders${qs ? `?${qs}` : ""}`;
  }

  function dateRangeHref(r: string) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    if (r !== "all") params.set("range", r);
    if (pay !== "all") params.set("pay", pay);
    const qs = params.toString();
    return `/dashboard/stores/${slug}/orders${qs ? `?${qs}` : ""}`;
  }

  function payHref(p: string) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    if (range !== "all") params.set("range", range);
    if (p !== "all") params.set("pay", p);
    const qs = params.toString();
    return `/dashboard/stores/${slug}/orders${qs ? `?${qs}` : ""}`;
  }

  const filterActive =
    q !== "" || status !== "all" || range !== "all" || pay !== "all";

  // 匯出 CSV 帶上當下的篩選，按下去拿到的就是眼前列表這批，不是全部訂單
  function exportHref() {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    if (range !== "all") params.set("range", range);
    if (pay !== "all") params.set("pay", pay);
    const qs = params.toString();
    return `/dashboard/stores/${slug}/orders/export${qs ? `?${qs}` : ""}`;
  }

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
            href={exportHref()}
            className="rounded-full bg-white border-2 border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50 transition"
          >
            {filterActive ? "⬇ 匯出這批" : "⬇ 匯出 CSV"}
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

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-emerald-900/50 mr-1">付款：</span>
          {PAYMENT_FILTERS.map((f) => {
            const active = pay === f.key;
            const count = paymentCounts[f.key] ?? 0;
            return (
              <Link
                key={f.key}
                href={payHref(f.key)}
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full transition ${
                  active
                    ? "bg-emerald-100 text-emerald-900 font-medium"
                    : "text-emerald-900/60 hover:bg-emerald-50"
                }`}
              >
                {f.label}
                <span className="text-xs text-emerald-900/45 tabular-nums">
                  {count}
                </span>
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
          {pay !== "all" && <input type="hidden" name="pay" value={pay} />}
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
          {filterActive && (
            <Link
              href={`/dashboard/stores/${slug}/orders`}
              className="rounded-full border border-emerald-100 px-4 py-2 text-sm text-emerald-900/70 hover:bg-emerald-50 transition"
            >
              清除
            </Link>
          )}
        </form>
      </div>

      {orders && orders.length > 0 && (receivedCents > 0 || outstandingCents > 0) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mb-4 px-5 py-3 bg-white rounded-2xl shadow-lg shadow-emerald-700/5">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-emerald-900/50">這些單已收</span>
            <span
              className="text-emerald-800 font-semibold tabular-nums"
              style={{ letterSpacing: "-0.01em" }}
            >
              {formatPrice(receivedCents, summaryCurrency)}
            </span>
          </div>
          {outstandingCents > 0 && (
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-amber-700/70">未收</span>
              <span
                className="text-amber-700 font-semibold tabular-nums"
                style={{ letterSpacing: "-0.01em" }}
              >
                {formatPrice(outstandingCents, summaryCurrency)}
              </span>
              <span className="text-xs text-amber-700/60">
                · {unpaidOrders.length} 筆未付款
              </span>
            </div>
          )}
        </div>
      )}

      {orders && orders.length > 0 ? (
        <>
        {/* 手機卡片版：訂單列表在手機上常用（店家在外面隨手看單），
            7 欄的表格擠在窄螢幕會糊成一團，所以小螢幕改一筆一張卡。 */}
        <div className="sm:hidden space-y-3">
          {orders.map((o) => {
            const s = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending;
            const p = PAYMENT_LABEL[o.payment_status] ?? PAYMENT_LABEL.unpaid;
            const needsAction = o.status === "pending";
            return (
              <Link
                key={o.id}
                href={`/dashboard/stores/${slug}/orders/${o.id}`}
                className={`block bg-white rounded-2xl p-4 shadow-lg shadow-emerald-700/5 border-l-[3px] ${
                  needsAction ? "border-amber-400" : "border-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-sm text-emerald-900">
                      #{o.id.split("-")[0].toUpperCase()}
                    </span>
                    <div className="text-emerald-950 font-medium mt-1 truncate">
                      {o.customer_name}
                    </div>
                    <div className="text-xs text-emerald-900/50">
                      {o.customer_phone}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-emerald-950">
                      {formatPrice(o.total_cents, o.currency)}
                    </div>
                    <div className="text-xs text-emerald-900/50 mt-1">
                      {new Date(o.created_at).toLocaleString("zh-TW", {
                        timeZone: "Asia/Taipei",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span
                    className={`inline-block text-xs px-2 py-1 rounded-full ${s.color}`}
                  >
                    {s.label}
                  </span>
                  <span className={`text-xs ${p.color}`}>{p.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="hidden sm:block bg-white rounded-2xl shadow-lg shadow-emerald-700/5 overflow-hidden">
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
                        timeZone: "Asia/Taipei",
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
        </>
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
