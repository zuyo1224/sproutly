import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ q?: string; sort?: string }>;

function formatPrice(cents: number) {
  return `NT$ ${Math.round(cents / 100).toLocaleString("zh-TW")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function daysAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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
    payment_status: string;
    status: string;
    created_at: string;
  };

  const { data: orders } = await supabase
    .from("sproutly_orders")
    .select(
      "id, customer_id, customer_name, customer_email, customer_phone, total_cents, payment_status, status, created_at"
    )
    .eq("merchant_id", store.id)
    .neq("status", "cancelled");

  const orderList = (orders as OrderRow[] | null) ?? [];

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
    const paidCount = orders.filter((o) => o.payment_status === "paid").length;
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
  const repeatCount = rows.filter((r) => r.orderCount >= 2).length;
  const grandTotal = rows.reduce((sum, r) => sum + r.totalCents, 0);
  const avgSpend = totalCustomers > 0 ? Math.round(grandTotal / totalCustomers) : 0;
  const topCustomer = [...rows].sort((a, b) => b.totalCents - a.totalCents)[0];

  return (
    <main className="max-w-6xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-950">客人</h1>
        <p className="mt-1.5 text-sm text-emerald-900/60">
          看誰下過單、誰回購過、誰是 VIP
        </p>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-2xl bg-white border border-emerald-50 p-5 shadow-sm shadow-emerald-700/5">
          <p className="text-xs uppercase tracking-wider text-emerald-900/50 mb-2">
            客人總數
          </p>
          <p className="text-2xl font-bold text-emerald-950 tabular-nums">
            {totalCustomers}
          </p>
          <p className="mt-1 text-xs text-emerald-900/50">
            其中 {accountCount} 位有註冊會員
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-emerald-50 p-5 shadow-sm shadow-emerald-700/5">
          <p className="text-xs uppercase tracking-wider text-emerald-900/50 mb-2">
            回購客人
          </p>
          <p className="text-2xl font-bold text-emerald-950 tabular-nums">
            {repeatCount}
          </p>
          <p className="mt-1 text-xs text-emerald-900/50">
            {totalCustomers > 0
              ? `回購率 ${Math.round((repeatCount / totalCustomers) * 100)}%`
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-emerald-50 p-5 shadow-sm shadow-emerald-700/5">
          <p className="text-xs uppercase tracking-wider text-emerald-900/50 mb-2">
            平均消費
          </p>
          <p className="text-2xl font-bold text-emerald-950 tabular-nums">
            {formatPrice(avgSpend)}
          </p>
          <p className="mt-1 text-xs text-emerald-900/50">每位客人</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-800 p-5 text-white">
          <p className="text-xs uppercase tracking-wider text-emerald-100/70 mb-2">
            最高消費客人
          </p>
          <p className="text-lg font-semibold truncate">
            {topCustomer?.name ?? "—"}
          </p>
          <p className="mt-1 text-xs text-emerald-100 tabular-nums">
            {topCustomer ? formatPrice(topCustomer.totalCents) : ""}
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
          placeholder="搜尋姓名、email 或電話..."
          className="flex-1 rounded-full px-5 py-2.5 text-sm border border-emerald-100 bg-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
        />
        <select
          name="sort"
          defaultValue={sort}
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
        <div className="rounded-2xl bg-white border border-emerald-50 p-10 text-center">
          <p className="text-emerald-900/60">
            {q ? `找不到符合「${q}」的客人` : "還沒有訂單"}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-emerald-50 overflow-hidden shadow-sm shadow-emerald-700/5">
          {/* Desktop table */}
          <table className="hidden sm:table w-full text-sm">
            <thead className="bg-emerald-50/50 text-emerald-900/70 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3.5 font-medium">客人</th>
                <th className="text-left px-3 py-3.5 font-medium">聯絡</th>
                <th className="text-right px-3 py-3.5 font-medium">訂單</th>
                <th className="text-right px-3 py-3.5 font-medium">總消費</th>
                <th className="text-left px-3 py-3.5 font-medium">最近下單</th>
                <th className="text-left px-5 py-3.5 font-medium">成為客人</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const recencyDays = daysAgo(r.lastOrderAt);
                const lifetimeDays = daysAgo(r.firstOrderAt);
                const isVip = r.totalCents >= 200000; // NT$ 2000+
                const isReturning = r.orderCount >= 2;
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
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 tracking-wider uppercase">
                            會員
                          </span>
                        )}
                        {isVip && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 tracking-wider uppercase">
                            VIP
                          </span>
                        )}
                        {isReturning && !isVip && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 tracking-wider uppercase">
                            回購
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {r.email && (
                        <a
                          href={`mailto:${r.email}`}
                          className="block text-emerald-700 hover:underline text-xs truncate max-w-44"
                        >
                          {r.email}
                        </a>
                      )}
                      <a
                        href={`tel:${r.phone}`}
                        className="block text-emerald-900/60 text-xs tabular-nums"
                      >
                        {r.phone}
                      </a>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <p className="font-medium text-emerald-950 tabular-nums">
                        {r.orderCount}
                      </p>
                      <p className="text-[10px] text-emerald-900/50">
                        付款 {r.paidCount}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <p className="font-medium text-emerald-950 tabular-nums">
                        {formatPrice(r.totalCents)}
                      </p>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="text-emerald-950 tabular-nums">
                        {formatDate(r.lastOrderAt)}
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
                        {formatDate(r.firstOrderAt)}
                      </p>
                      <p className="text-[10px] text-emerald-900/50">
                        {lifetimeDays === 0
                          ? "今天"
                          : `已認識 ${lifetimeDays} 天`}
                      </p>
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
              const isVip = r.totalCents >= 200000;
              const isReturning = r.orderCount >= 2;
              return (
                <li key={r.key} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-emerald-950 truncate">
                        {r.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {r.identityType === "account" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 tracking-wider uppercase">
                            會員
                          </span>
                        )}
                        {isVip && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 tracking-wider uppercase">
                            VIP
                          </span>
                        )}
                        {isReturning && !isVip && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 tracking-wider uppercase">
                            回購
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-950 tabular-nums">
                        {formatPrice(r.totalCents)}
                      </p>
                      <p className="text-[10px] text-emerald-900/50">
                        {r.orderCount} 筆訂單
                      </p>
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
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-6 text-xs text-emerald-900/50 leading-relaxed">
        說明：以電話為主分群（同一支電話的多次匿名下單算一位客人）；如果客人有會員帳號則
        會用會員 ID 分群更準確。VIP = 累計消費 NT$ 2,000+；回購 = 下過 2 次以上。
      </p>
      <p className="mt-2 text-xs text-emerald-900/50">
        <Link
          href={`/dashboard/stores/${slug}/orders`}
          className="text-emerald-700 hover:underline"
        >
          → 看所有訂單
        </Link>
      </p>
    </main>
  );
}
