import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../_theme";
import { customerSignOut } from "./actions";

type Params = Promise<{ slug: string }>;

export default async function CustomerAccountHome({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name, theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect(`/${slug}/account/login?next=${encodeURIComponent(`/${slug}/account`)}`);
  }

  const { data: customer } = await supabase
    .from("sproutly_customers")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { count: orderCount } = await supabase
    .from("sproutly_orders")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", store.id)
    .eq("customer_id", user.id);

  const displayName =
    customer?.display_name ||
    customer?.email ||
    user.email ||
    "客人";

  const orders = orderCount ?? 0;
  const caption =
    orders === 0
      ? `${displayName} · 還沒下過訂單`
      : `${displayName} · ${orders} 筆訂單在追蹤`;

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <header className="mb-16 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.4em",
          }}
        >
          Account
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          歡迎回來
        </h1>
        <div
          className="mt-5 h-px w-12"
          style={{
            background: "var(--store-accent, currentColor)",
            opacity: 0.5,
          }}
        />
        <p
          className="mt-5 text-[0.9375rem]"
          style={{
            color: theme.textMuted,
            lineHeight: 1.7,
          }}
        >
          {caption}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mb-14">
        <Link
          href={`/${slug}/account/orders`}
          className="block rounded-2xl p-7 sm:p-8 transition hover:opacity-95"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            boxShadow: "var(--sproutly-elev-2)",
          }}
        >
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{
              color: "var(--store-accent, currentColor)",
              letterSpacing: "0.4em",
            }}
          >
            Orders
          </p>
          <p
            className="mt-5 text-3xl sm:text-4xl tabular-nums"
            style={{
              color: theme.text,
              fontFamily: "var(--store-font)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            {orders}
          </p>
          <p
            className="mt-3 text-sm"
            style={{ color: theme.textMuted, lineHeight: 1.7 }}
          >
            查看你的訂單歷史
          </p>
          <p
            className="mt-5 text-[0.6875rem] uppercase font-medium"
            style={{
              color: "var(--store-accent, currentColor)",
              letterSpacing: "0.3em",
            }}
          >
            看訂單 →
          </p>
        </Link>

        <Link
          href={`/${slug}/favorites`}
          className="block rounded-2xl p-7 sm:p-8 transition hover:opacity-95"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            boxShadow: "var(--sproutly-elev-2)",
          }}
        >
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{
              color: "var(--store-accent, currentColor)",
              letterSpacing: "0.4em",
            }}
          >
            Wishlist
          </p>
          <p
            className="mt-5 text-3xl sm:text-4xl"
            style={{
              color: theme.text,
              fontFamily: "var(--store-font)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            收藏
          </p>
          <p
            className="mt-3 text-sm"
            style={{ color: theme.textMuted, lineHeight: 1.7 }}
          >
            那些你還在想的植物
          </p>
          <p
            className="mt-5 text-[0.6875rem] uppercase font-medium"
            style={{
              color: "var(--store-accent, currentColor)",
              letterSpacing: "0.3em",
            }}
          >
            看收藏 →
          </p>
        </Link>
      </div>

      <div
        className="rounded-2xl p-7 sm:p-8 flex items-center justify-between gap-4"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          boxShadow: "var(--sproutly-elev-2)",
        }}
      >
        <div className="min-w-0">
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{
              color: theme.textMuted,
              letterSpacing: "0.4em",
            }}
          >
            Session
          </p>
          <p
            className="mt-3 text-sm truncate"
            style={{ color: theme.text }}
          >
            {user.email}
          </p>
        </div>
        <form action={customerSignOut}>
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            className="sproutly-btn sproutly-btn-secondary sproutly-btn-sm whitespace-nowrap"
          >
            登出
          </button>
        </form>
      </div>
    </main>
  );
}
