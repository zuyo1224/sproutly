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

  return (
    <main className="max-w-3xl mx-auto px-6 py-24 sm:py-32">
      <div className="mb-16 sm:mb-20">
        <p
          className="text-[10px] tracking-[0.4em] uppercase mb-5"
          style={{ color: theme.accent }}
        >
          Account
        </p>
        <h1
          className="text-3xl sm:text-4xl lg:text-[2.5rem]"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          歡迎回來
        </h1>
        <p
          className="mt-5 text-base leading-[1.85]"
          style={{ color: theme.textMuted }}
        >
          {displayName}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 mb-14">
        <Link
          href={`/${slug}/account/orders`}
          className="block rounded-2xl p-7 transition hover:opacity-90"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
          }}
        >
          <p
            className="text-[10px] tracking-[0.4em] uppercase mb-3"
            style={{ color: theme.accent }}
          >
            Orders
          </p>
          <p
            className="text-2xl sm:text-3xl tabular-nums"
            style={{
              color: theme.text,
              fontFamily: "var(--store-font)",
              fontWeight: 400,
            }}
          >
            {orderCount ?? 0}
          </p>
          <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>
            查看你的訂單歷史
          </p>
        </Link>

        <Link
          href={`/${slug}/favorites`}
          className="block rounded-2xl p-7 transition hover:opacity-90"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
          }}
        >
          <p
            className="text-[10px] tracking-[0.4em] uppercase mb-3"
            style={{ color: theme.accent }}
          >
            Favorites
          </p>
          <p
            className="text-2xl sm:text-3xl"
            style={{
              color: theme.text,
              fontFamily: "var(--store-font)",
              fontWeight: 400,
            }}
          >
            收藏
          </p>
          <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>
            那些你還在想的植物
          </p>
        </Link>
      </div>

      <div
        className="rounded-2xl p-7 flex items-center justify-between gap-4"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
        }}
      >
        <div className="min-w-0">
          <p
            className="text-[10px] tracking-[0.4em] uppercase mb-2"
            style={{ color: theme.textMuted }}
          >
            Logged in
          </p>
          <p
            className="text-sm truncate"
            style={{ color: theme.text }}
          >
            {user.email}
          </p>
        </div>
        <form action={customerSignOut}>
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            className="sproutly-btn sproutly-btn-primary sproutly-btn-sm whitespace-nowrap"
          >
            登出
          </button>
        </form>
      </div>
    </main>
  );
}
