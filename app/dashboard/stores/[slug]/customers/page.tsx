import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { telHref, mailHref } from "@/lib/contact-href";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ q?: string; sort?: string }>;

// 客人名單的金額一律跟著這間店實際出單的幣別走（共用 formatPrice，不再對非 TWD 店家硬寫 NT$）。
import { formatPrice } from "@/lib/format-price";
import { taipeiDateNumeric } from "@/lib/format-date";
import {
  customerTier,
  isReturningCustomer,
  VIP_THRESHOLD_CENTS,
  REPEAT_ORDER_THRESHOLD,
} from "@/lib/customer-tags";

function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// 點客人 → 帶他的電話（沒有就 email / 姓名）去訂單列表用既有的 ?q= 篩出他的所有單
function customerOrdersHref(slug: string, r: CustomerRow) {
  const needle = (r.phone && r.phone !== "unknown" ? r.phone : "") || r.email || r.name;
  return `/dashboard/stores/${slug}/orders?q=${encodeURIComponent(needle)}`;
}

type CustomerRow = {
  key: string;
  identityType: "account" | "guest";
  customerId: string | null;
  name: string;
  email: string | null;
  phone: string;
  orderCount: number;
  paidCount: number;
  totalCents: number;
  paidCents: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

const SORT_OPTIONS = [
  { key: "recent", label: "最近下單" },
  { key: "spend", label: "總消費高 → 低" },
  { key: "orders", label: "訂單筆數多 → 少" },
  { key: "first", label: "最早成為客人" },
] as const;

export default async function StoreCustomersPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const sort = (SORT_OPTIONS.find((o) => o.key === sp.sort)?.key ??
    "recent") as (typeof SORT_OPTIONS)[number]["key"];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  type OrderRow = {
    id: string;
    customer_id: string | null;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string;
    total_cents: number;
    currency: string;
    payment_status: string;
    status: string;
    created_at: string;
  };

  const { data: orders } = await supabase
    .from("sproutly_orders")
    .select(
      "id, customer_id, customer_name, customer_email, customer_phone, total_cents, currency, payment_status, status, created_at"
    )
    .eq("merchant_id", store.id)
    .neq("status", "cancelled");

  const orderList = (orders as OrderRow[] | null) ?? [];
  // 單一店家實務上同一種幣別，取第一筆訂單的幣別當這頁的顯示單位；沒有訂單就退 TWD
  const storeCurrency = orderList[0]?.currency ?? "TWD";

  // 分群邏輯：有 customer_id → 用 customer_id；否則 fallback 用 phone
  const groups = new Map<string, OrderRow[]>();
  for (const order of orderList) {
    const key = order.customer_id
      ? `account:${order.customer_id}`
      : `guest:${order.customer_phone || "unknown"}`;
    const arr = groups.get(key) ?? [];
    arr.push(order);
    groups.set(key, arr);
  }

  const rows: CustomerRow[] = [];
  for (const [key, orders] of groups) {
    const sorted = [...orders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const latest = sorted[sorted.length - 1];
    const earliest = sorted[0];
    const total = orders.reduce((sum, o) => sum + o.total_cents, 0);
    const paidOrders = orders.filter((o) => o.payment_status === "paid");
    const paidCount = paidOrders.length;
    const paidCents = paidOrders.reduce((sum, o) => sum + o.total_cents, 0);
    const identityType: CustomerRow["identityType"] = key.startsWith("account:")
      ? "account"
      : "guest";
    rows.push({
      key,
      identityType,
      customerId: identityType === "account" ? latest.customer_id : null,
      name: latest.customer_name || "—",
      email: latest.customer_email,
      phone: latest.customer_phone,
      orderCount: orders.length,
      paidCount,
      totalCents: total,
      paidCents,
      firstOrderAt: earliest.created_at,
      lastOrderAt: latest.created_at,
    });
  }

  // 篩選
  const filtered = q
    ? rows.filter((r) => {
        const needle = q.toLowerCase();
        return (
          r.name.toLowerCase().includes(needle) ||
          (r.email ?? "").toLowerCase().includes(needle) ||
          r.phone.toLowerCase().includes(needle)
        );
      })
    : rows;

  // 排序
  switch (sort) {
    case "spend":
      filtered.sort((a, b) => b.totalCents - a.totalCents);
      break;
    case "orders":
      filtered.sort((a, b) => b.orderCount - a.orderCount);
      break;
    case "first":
      filtered.sort(
        (a, b) =>
          new Date(a.firstOrderAt).getTime() - new Date(b.firstOrderAt).getTime()
      );
      break;
    default:
      filtered.sort(
        (a, b) =>
          new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
      );
  }

  const totalCustomers = rows.length;
  const accountCount = rows.filter((r) => r.identityType === "account").length;
  const repeatCount = rows.filter((r) => isReturningCustomer(r.orderCount)).length;
  const grandTotal = rows.reduce((sum, r) => sum + r.totalCents, 0);
  const avgSpend = totalCustomers > 0 ? Math.round(grandTotal / totalCustomers) : 0;
  const topCustomer = [...rows].sort((a, b) => b.totalCents - a.totalCents)[0];

  const headerCaption = q
    ? `符合「${q}」${filtered.length} 位 · 全部 ${totalCustomers} 位`
    : totalCustomers > 0
      ? `${totalCustomers} 位客人 · ${repeatCount > 0 ? `${repeatCount} 位回購過` : "點任一位看細節"}`
      : "客人在店面下單後會出現在這裡";

  // 匯出連結帶上當下的搜尋／排序，按下去拿到的就是眼前這份名單（跟訂單匯出同一套）
  function exportHref() {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (sort !== "recent") usp.set("sort", sort);
    const qs = usp.toString();
    return `/dashboard/stores/${slug}/customers/export${qs ? `?${qs}` : ""}`;
  }
  const filterActive = q !== "" || sort !== "recent";

  return (
    <div>
      <div className="mb-10 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p
            className="uppercase text-emerald-700/70"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            Customers · 客人
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl text-emerald-950 font-medium tracking-tight"
            style={{ letterSpacing: "-0.01em", lineHeight: 1.15 }}
          >
            認識每一位客人
          </h2>
          <span aria-hidden className="mt-4 block h-px w-12 bg-emerald-600/60" />
          <p
            className="mt-4 text-emerald-900/65"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {headerCaption}
          </p>
        </div>
        {totalCustomers > 0 && (
          <a
            href={exportHref()}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50 transition whitespace-nowrap"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {filterActive ? "匯出這批" : "匯出名單"}
          </a>
        )}
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-2xl bg-white border border-emerald-50 p-5 shadow-lg shadow-emerald-700/5">
          <p className="text-[10px] tracking-[0.28em] uppercase text-emerald-700/70 mb-3">
            Total · 客人總數
          </p>
          <p
            className="text-3xl sm:text-4xl text-emerald-950 font-medium tabular-nums"
            style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {totalCustomers}
          </p>
          <p className="mt-2 text-xs text-emerald-900/50">
            其中 {accountCount} 位有註冊會員
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-emerald-50 p-5 shadow-lg shadow-emerald-700/5">
          <p className="text-[10px] tracking-[0.28em] uppercase text-emerald-700/70 mb-3">
            Repeat · 回購客人
          </p>
          <p
            className="text-3xl sm:text-4xl text-emerald-950 font-medium tabular-nums"
            style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {repeatCount}
          </p>
          <p className="mt-2 text-xs text-emerald-900/50">
            {totalCustomers > 0
              ? `回購率 ${Math.round((repeatCount / totalCustomers) * 100)}%`
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-emerald-50 p-5 shadow-lg shadow-emerald-700/5">
          <p className="text-[10px] tracking-[0.28em] uppercase text-emerald-700/70 mb-3">
            Avg Spend · 平均消費
          </p>
          <p
            className="text-3xl sm:text-4xl text-emerald-950 font-medium tabular-nums"
            style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            {formatPrice(avgSpend, storeCurrency)}
          </p>
          <p className="mt-2 text-xs text-emerald-900/50">每位客人</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-800 p-5 text-white">
          <p className="text-[10px] tracking-[0.28em] uppercase text-emerald-100/70 mb-3">
            Top · 最高消費
          </p>
          <p className="text-lg font-medium truncate" style={{ letterSpacing: "-0.01em" }}>
            {topCustomer?.name ?? "—"}
          </p>
          <p
            className="mt-2 text-emerald-100 tabular-nums"
            style={{ fontSize: "0.8125rem", letterSpacing: "-0.01em" }}
          >
            {topCustomer ? formatPrice(topCustomer.totalCents, storeCurrency) : ""}
          </p>
        </div>
      </div>

      {/* Search + sort */}
      <form
        method="GET"
        className="mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center"
      >
        <input
          name="q"
          defaultValue={q}
          aria-label="搜尋顧客（姓名、email 或電話）"
          placeholder="搜尋姓名、email 或電話..."
          className="flex-1 rounded-full px-5 py-2.5 text-sm border border-emerald-100 bg-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
        />
        <select
          name="sort"
          defaultValue={sort}
          aria-label="排序方式"
          className="rounded-full px-4 py-2.5 text-sm border border-emerald-100 bg-white outline-none focus:border-emerald-400 transition"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full px-6 py-2.5 text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition"
        >
          套用
        </button>
      </form>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 sm:p-16 text-center shadow-xl shadow-emerald-700/5">
          <p
            className="uppercase text-emerald-700/70"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            {q ? "No Match · 沒有符合" : "Empty · 還沒有客人"}
          </p>
          <span aria-hidden className="mt-4 block h-px w-10 bg-emerald-600/60 mx-auto" />
          <h3
            className="mt-6 text-2xl sm:text-3xl text-emerald-950 font-medium tracking-tight"
            style={{ letterSpacing: "-0.01em", lineHeight: 1.2 }}
          >
            {q ? (
              <>
                找不到符合
                <br />
                「{q}」的客人
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
            {q
              ? "換個關鍵字試試，或清除搜尋看全部"
              : "客人在店面下單後，會被分群整理在這裡"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-emerald-50 overflow-hidden shadow-lg shadow-emerald-700/5">
          {/* Desktop table */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-emerald-50/50 text-emerald-700/70">
              <tr style={{ fontSize: "0.6875rem", letterSpacing: "0.3em" }} className="uppercase">
                <th className="text-left px-5 py-3.5 font-medium">客人</th>
                <th className="text-left px-3 py-3.5 font-medium">聯絡</th>
                <th className="text-right px-3 py-3.5 font-medium">訂單</th>
                <th className="text-right px-3 py-3.5 font-medium">總消費</th>
                <th className="text-left px-3 py-3.5 font-medium">最近下單</th>
                <th className="text-left px-5 py-3.5 font-medium">成為客人</th>
                <th className="text-right px-5 py-3.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const recencyDays = daysAgo(r.lastOrderAt);
                const lifetimeDays = daysAgo(r.firstOrderAt);
                const tier = customerTier(r.totalCents, r.orderCount);
                return (
                  <tr
                    key={r.key}
                    className="border-t border-emerald-50 hover:bg-emerald-50/30 transition"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-emerald-950">
                          {r.name}
                        </span>
                        {r.identityType === "account" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase"
                            style={{ letterSpacing: "0.3em" }}
                          >
                            Member
                          </span>
                        )}
                        {tier === "vip" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase"
                            style={{ letterSpacing: "0.3em" }}
                          >
                            VIP
                          </span>
                        )}
                        {tier === "returning" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase"
                            style={{ letterSpacing: "0.3em" }}
                          >
                            Repeat
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {r.email && (
                        <a
                          href={mailHref(r.email)}
                          className="block text-emerald-700 hover:underline text-xs truncate max-w-44"
                        >
                          {r.email}
                        </a>
                      )}
                      <a
                        href={telHref(r.phone)}
                        className="block text-emerald-900/60 text-xs tabular-nums"
                      >
                        {r.phone}
                      </a>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <p
                        className="text-emerald-950 tabular-nums font-medium"
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {r.orderCount}
                      </p>
                      <p className="text-[10px] text-emerald-900/50">
                        付款 {r.paidCount}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <p
                        className="text-emerald-950 tabular-nums font-medium"
                        style={{ letterSpacing: "-0.01em" }}
                      >
                        {formatPrice(r.totalCents, storeCurrency)}
                      </p>
                      {r.paidCents < r.totalCents && (
                        <p className="text-[10px] text-amber-700/80 tabular-nums">
                          {r.paidCents === 0
                            ? "尚未收款"
                            : `已收 ${formatPrice(r.paidCents, storeCurrency)}`}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="text-emerald-950 tabular-nums">
                        {taipeiDateNumeric(r.lastOrderAt)}
                      </p>
                      <p className="text-[10px] text-emerald-900/50">
                        {recencyDays === 0
                          ? "今天"
                          : recencyDays === 1
                            ? "昨天"
                            : `${recencyDays} 天前`}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-emerald-950 tabular-nums">
                        {taipeiDateNumeric(r.firstOrderAt)}
                      </p>
                      <p className="text-[10px] text-emerald-900/50">
                        {lifetimeDays === 0
                          ? "今天"
                          : `已認識 ${lifetimeDays} 天`}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <Link
                        href={customerOrdersHref(slug, r)}
                        className="text-emerald-700 hover:text-emerald-900 text-sm font-medium"
                      >
                        看訂單 →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile card list */}
          <ul className="sm:hidden divide-y divide-emerald-50">
            {filtered.map((r) => {
              const recencyDays = daysAgo(r.lastOrderAt);
              const tier = customerTier(r.totalCents, r.orderCount);
              return (
                <li key={r.key}>
                  <Link
                    href={customerOrdersHref(slug, r)}
                    className="block p-4 hover:bg-emerald-50/40 transition"
                  >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-emerald-950 truncate">
                        {r.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {r.identityType === "account" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase"
                            style={{ letterSpacing: "0.3em" }}
                          >
                            Member
                          </span>
                        )}
                        {tier === "vip" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase"
                            style={{ letterSpacing: "0.3em" }}
                          >
                            VIP
                          </span>
                        )}
                        {tier === "returning" && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase"
                            style={{ letterSpacing: "0.3em" }}
                          >
                            Repeat
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-emerald-950 tabular-nums font-medium"
                        style={{ letterSpacing: "-0.02em", fontSize: "1.0625rem" }}
                      >
                        {formatPrice(r.totalCents, storeCurrency)}
                      </p>
                      <p className="text-[10px] text-emerald-900/50">
                        {r.orderCount} 筆訂單
                      </p>
                      {r.paidCents < r.totalCents && (
                        <p className="text-[10px] text-amber-700/80 tabular-nums mt-0.5">
                          {r.paidCents === 0
                            ? "尚未收款"
                            : `已收 ${formatPrice(r.paidCents, storeCurrency)}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-emerald-900/70 tabular-nums truncate">
                    {r.phone}
                    {r.email ? ` · ${r.email}` : ""}
                  </p>
                  <p className="text-[10px] text-emerald-900/50 mt-1.5">
                    最近 {recencyDays === 0
                      ? "今天"
                      : recencyDays === 1
                        ? "昨天"
                        : `${recencyDays} 天前`}{" "}
                    · 認識 {daysAgo(r.firstOrderAt)} 天
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-2 font-medium">
                    看訂單 →
                  </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-emerald-50">
        <p
          className="uppercase text-emerald-700/70 mb-3"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.4em",
          }}
        >
          Note · 分群說明
        </p>
        <p
          className="text-emerald-900/65"
          style={{ fontSize: "0.8125rem", lineHeight: 1.85, maxWidth: "44rem" }}
        >
          以電話為主分群（同一支電話的多次匿名下單算一位客人）；客人若有會員帳號，
          會用會員 ID 分群更準確。VIP = 累計消費 {formatPrice(VIP_THRESHOLD_CENTS, storeCurrency)}+；回購 = 下過 {REPEAT_ORDER_THRESHOLD} 次以上。
          「總消費」是累計下單金額（含轉帳、貨到付款還沒收到的單）；款項還沒到齊的，
          下方會標出實際已收多少。點任一位客人的「看訂單」，會帶他的電話到訂單列表，
          篩出他的每一筆單。
        </p>
        <Link
          href={`/dashboard/stores/${slug}/orders`}
          className="mt-4 inline-block text-emerald-700 hover:underline uppercase"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.3em",
          }}
        >
          → All Orders · 看所有訂單
        </Link>
      </div>
    </div>
  );
}
