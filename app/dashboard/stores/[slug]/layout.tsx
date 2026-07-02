import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/require-user";
import { signOut } from "@/app/auth/actions";
import { DashboardStoreTabs } from "@/app/_components/dashboard-store-tabs";

type Params = Promise<{ slug: string }>;

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { slug } = await params;
  const { supabase, user } = await requireUser();

  const [{ data: store }, { data: allStores }] = await Promise.all([
    supabase
      .from("sproutly_merchants")
      .select("id, name, slug, is_published")
      .eq("slug", slug)
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase
      .from("sproutly_merchants")
      .select("name, slug, is_published")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!store) notFound();

  // 未處理訂單數（給 nav badge 用）
  const { count: pendingOrderCount } = await supabase
    .from("sproutly_orders")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", store.id)
    .eq("status", "pending");

  // 總覽是店面根路徑、會是其他子頁的前綴，標 exact 才不會在每一頁都亮；其餘子頁 startsWith
  const tabs = [
    { label: "總覽", href: `/dashboard/stores/${slug}`, badge: 0, exact: true },
    { label: "編輯器", href: `/dashboard/stores/${slug}/editor`, badge: 0, exact: false },
    { label: "商品", href: `/dashboard/stores/${slug}/products`, badge: 0, exact: false },
    {
      label: "訂單",
      href: `/dashboard/stores/${slug}/orders`,
      badge: pendingOrderCount ?? 0,
      badgeLabel: "筆待處理",
      exact: false,
    },
    { label: "客人", href: `/dashboard/stores/${slug}/customers`, badge: 0, exact: false },
    { label: "設定", href: `/dashboard/stores/${slug}/settings`, badge: 0, exact: false },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50">
      <header className="px-8 py-6 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-emerald-900 font-bold tracking-tight"
          >
            Sproutly
          </Link>
          <span className="text-emerald-900/30">/</span>
          <details className="group relative">
            <summary className="cursor-pointer list-none flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 transition">
              <span className="text-sm font-medium text-emerald-900 truncate max-w-32 sm:max-w-none">
                {store.name}
              </span>
              <svg
                className="w-4 h-4 text-emerald-700 transition group-open:rotate-180 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <div className="absolute top-full left-0 mt-2 min-w-64 bg-white rounded-2xl shadow-xl shadow-emerald-700/10 border border-emerald-50 py-2 z-30">
              <p className="px-4 py-1.5 text-xs text-emerald-900/50 uppercase tracking-wider">
                切換店面
              </p>
              <div className="max-h-72 overflow-y-auto">
                {allStores?.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/dashboard/stores/${s.slug}`}
                    aria-current={s.slug === slug ? "true" : undefined}
                    className={`block px-4 py-2.5 hover:bg-emerald-50/60 transition ${
                      s.slug === slug ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${
                          s.slug === slug
                            ? "font-semibold text-emerald-900"
                            : "text-emerald-900/80"
                        }`}
                      >
                        {s.name}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            s.is_published
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {s.is_published ? "已發布" : "草稿"}
                        </span>
                        {s.slug === slug && (
                          <span
                            className="text-emerald-600 text-sm"
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-emerald-900/40 mt-0.5 font-mono truncate">
                      sproutly.app/{s.slug}
                    </p>
                  </Link>
                ))}
              </div>
              <hr className="my-2 border-emerald-50" />
              <Link
                href="/dashboard/new-store"
                className="block px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50/60 transition font-medium"
              >
                ＋ 開新店
              </Link>
              <Link
                href="/dashboard"
                className="block px-4 py-2 text-sm text-emerald-900/60 hover:bg-emerald-50/60 transition"
              >
                ← 回主後台
              </Link>
            </div>
          </details>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-emerald-900/70 hover:text-emerald-900 transition"
          >
            登出
          </button>
        </form>
      </header>

      <div className="max-w-6xl mx-auto px-8 pb-16">
        <div className="bg-white rounded-2xl p-7 shadow-lg shadow-emerald-700/5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] tracking-[0.32em] uppercase text-emerald-700/70">
                Storefront
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-medium text-emerald-950 tracking-tight leading-[1.15]">
                {store.name}
              </h1>
              <p className="text-xs text-emerald-900/45 mt-2 font-mono break-all tracking-tight">
                sproutly.app/{store.slug}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span
                className={`text-[10px] uppercase tracking-[0.18em] px-3 py-1 rounded-full ${
                  store.is_published
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {store.is_published ? "已發布" : "草稿"}
              </span>
              {store.is_published && (
                <Link
                  href={`/${slug}`}
                  target="_blank"
                  className="text-xs text-emerald-700 hover:text-emerald-900 transition"
                >
                  看公開店面 ↗
                </Link>
              )}
            </div>
          </div>
        </div>

        <DashboardStoreTabs tabs={tabs} />

        {children}
      </div>
    </div>
  );
}
