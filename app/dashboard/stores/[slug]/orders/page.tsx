import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/require-user";
// 訂單狀態徽章（label + 色票）跟店家首頁、訂單詳情共用同一份；篩選 chip 的狀態清單
// 也從同一條 canonical 順序（ORDER_STATUS_OPTIONS）衍生，前面再補一顆「全部」。
import {
  ORDER_STATUS_BADGES,
  ORDER_STATUS_OPTIONS,
  isPendingOrder,
  isPaidOrder,
  isUnpaidOrder,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  shortOrderId,
} from "@/lib/order-labels";
// 分日統計的台灣時區日期 key、時間戳、篩選區間起點跟店家首頁/匯出共用同一份（見檔內說明）。
import { taipeiStampShort, taipeiRangeSince } from "@/lib/format-date";
import { sumOrderCents } from "@/lib/sum-order-cents";
import { applyOrderSearch, matchesOrderSearch } from "@/lib/order-search";
import { phoneDigits } from "@/lib/phone-match";
import { fetchAllRows } from "@/lib/fetch-all-rows";

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

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  ...ORDER_STATUS_OPTIONS.map((o) => ({ key: o.value, label: o.label })),
];

// 做轉帳 / 貨到付款的店家常要找「出貨了還沒收到錢」的單，
// 訂單狀態 chip 篩不出這件事，另外給一排付款狀態的篩選。
const PAYMENT_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  ...PAYMENT_STATUSES.map((key) => ({ key, label: PAYMENT_STATUS_LABELS[key] })),
];

// 色票是列表獨有的「純文字色」視覺（跟詳情頁藥丸底色不同款），留在這頁；label 文字
// 改吃共用的 PAYMENT_STATUS_LABELS，不再另抄一份未付款/已付款/已退款。
const PAYMENT_TEXT_COLOR: Record<string, string> = {
  unpaid: "text-amber-700",
  paid: "text-emerald-700",
  refunded: "text-zinc-600",
};

const PAYMENT_LABEL: Record<string, { label: string; color: string }> =
  Object.fromEntries(
    PAYMENT_STATUSES.map((key) => [
      key,
      { label: PAYMENT_STATUS_LABELS[key], color: PAYMENT_TEXT_COLOR[key] },
    ])
  );

import { formatPrice, displayCurrency } from "@/lib/format-price";

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
  const rangeSince = taipeiRangeSince(range);

  const { supabase, user } = await requireUser();

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  // 算每個狀態的 count（不受目前 filter 影響）。
  // 以前一次 select 整家店：Supabase 一次最多回約 1000 列，訂單破千後
  // chip 上的數字默默算少，改走共用的 fetchAllRows 分頁撈齊（id tiebreaker
  // 保證每頁切點穩定，這條只拿來數數，排序用 id 就夠）。
  const allOrders = await fetchAllRows<{
    status: string;
    payment_status: string;
  }>(async (from, to) => {
    const { data } = await supabase
      .from("sproutly_orders")
      .select("id, status, payment_status")
      .eq("merchant_id", store.id)
      .order("id", { ascending: true })
      .range(from, to);
    return {
      data: data as { status: string; payment_status: string }[] | null,
    };
  });
  const statusCounts: Record<string, number> = { all: allOrders.length };
  const paymentCounts: Record<string, number> = { all: allOrders.length };
  allOrders.forEach((o) => {
    statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
    paymentCounts[o.payment_status] =
      (paymentCounts[o.payment_status] ?? 0) + 1;
  });

  // 套用 filter + search 查訂單。同樣分頁撈齊——以前超過 1000 筆時，
  // 列表尾端的舊單直接看不到，下面的已收/未收金額也跟著算少。
  // 顯示維持新到舊，同時間再比 id 讓翻頁切點穩定。
  //
  // 搜尋字串含數字時（搜電話、或客人頁「看訂單」帶原文電話跳過來）不交給 DB ilike
  // 逐字比——訂單存的電話是下單當下的原文，格式不同就一筆搜不到——改撈回來在
  // 記憶體用 matchesOrderSearch 逐筆比（原文子字串照舊 + 轉純數字比對）。
  // 純文字查詢（姓名 / Email）維持 DB ilike，行為與成本不變。
  const qDigits = phoneDigits(q);
  const fetchedOrders = await fetchAllRows(async (from, to) => {
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
    if (q && qDigits === "") {
      query = applyOrderSearch(query, q);
    }
    if (rangeSince) {
      query = query.gte("created_at", rangeSince.toISOString());
    }
    const { data } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    return { data };
  });
  const orders =
    q && qDigits !== ""
      ? fetchedOrders.filter((o) => matchesOrderSearch(o, q))
      : fetchedOrders;

  // 這批篩出來的單裡錢的狀況：已取消的不算錢（沒成交）。
  // 轉帳 / 貨到付款的店家最在意「未收」這個數字 — 篩到「已出貨 + 未付款」時，
  // 這條就直接告訴他現在還有多少錢在外面沒進來，不用自己一筆筆加。
  const moneyOrders = (orders ?? []).filter((o) => o.status !== "cancelled");
  // 這頁的顯示幣別（取第一筆訂單、空退 TWD），見 displayCurrency。
  const summaryCurrency = displayCurrency(orders);
  const receivedCents = sumOrderCents(
    moneyOrders.filter((o) => isPaidOrder(o.payment_status))
  );
  const unpaidOrders = moneyOrders.filter((o) => isUnpaidOrder(o.payment_status));
  const outstandingCents = sumOrderCents(unpaidOrders);

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
            <span aria-hidden="true">⬇ </span>
            {filterActive ? "匯出這批" : "匯出 CSV"}
          </a>
        )}
      </div>

      {/* 狀態 chips + 日期 chips + 搜尋 bar */}
      <div className="bg-white rounded-2xl p-4 shadow-lg shadow-emerald-700/5 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="sr-only">狀態：</span>
          {STATUS_FILTERS.map((f) => {
            const count = statusCounts[f.key] ?? 0;
            const active = status === f.key;
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
                  {count}
                  <span className="sr-only"> 筆</span>
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
                aria-current={active ? "true" : undefined}
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
                aria-current={active ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full transition ${
                  active
                    ? "bg-emerald-100 text-emerald-900 font-medium"
                    : "text-emerald-900/60 hover:bg-emerald-50"
                }`}
              >
                {f.label}
                <span className="text-xs text-emerald-900/45 tabular-nums">
                  {count}
                  <span className="sr-only"> 筆</span>
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
            aria-label="搜尋訂單（顧客姓名、電話或 Email）"
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
            const s = ORDER_STATUS_BADGES[o.status] ?? ORDER_STATUS_BADGES.pending;
            const p = PAYMENT_LABEL[o.payment_status] ?? PAYMENT_LABEL.unpaid;
            const needsAction = isPendingOrder(o.status);
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
                      #{shortOrderId(o.id)}
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
                      {taipeiStampShort(o.created_at)}
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
                const s = ORDER_STATUS_BADGES[o.status] ?? ORDER_STATUS_BADGES.pending;
                const p =
                  PAYMENT_LABEL[o.payment_status] ?? PAYMENT_LABEL.unpaid;
                // 待確認 = 商家還沒處理的單，給整列上色 + 左側色條，掃一眼就抓得到哪幾筆要回
                const needsAction = isPendingOrder(o.status);
                return (
                  <tr
                    key={o.id}
                    className={`transition ${
                      needsAction
                        ? "bg-amber-50/50 hover:bg-amber-50"
                        : i % 2 === 0
                          ? "bg-white hover:bg-emerald-50/30"
                          : "bg-emerald-50/20 hover:bg-emerald-50/40"
                    }`}
                  >
                    <td
                      className={`px-5 py-4 font-mono text-emerald-900 border-l-[3px] ${
                        needsAction
                          ? "border-amber-400"
                          : "border-transparent"
                      }`}
                    >
                      #{shortOrderId(o.id)}
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
                      {taipeiStampShort(o.created_at)}
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
