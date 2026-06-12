import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../../_theme";
import { PAYMENT_LABELS } from "@/lib/order-labels";

type Params = Promise<{ slug: string }>;

const STATUS_LABELS: Record<string, string> = {
  pending: "待店家確認",
  confirmed: "已確認",
  shipped: "已出貨",
  completed: "完成",
  cancelled: "取消",
};

// 列表一次列出多筆單，狀態 pill 若全長一樣，客人分不出哪些還在追蹤、哪些已結案。
// 沿用詳情頁進度條那套語言：還在跑的單（pending/confirmed/shipped）用店家 accent 點亮、
// 抓住客人的眼；completed 已結案維持中性退場；cancelled 用 muted 沉到背景。
// 不引入後台那套 amber/red 硬色票——客人頁吃店家自訂 theme，得跟著 accent 走才不衝突。
function statusPillStyle(status: string, theme: ReturnType<typeof resolveTheme>) {
  if (status === "cancelled") {
    return {
      background: theme.bg,
      color: theme.textMuted,
      border: `1px solid ${theme.border}`,
    };
  }
  if (status === "completed") {
    return {
      background: theme.bg,
      color: theme.text,
      border: `1px solid ${theme.border}`,
    };
  }
  return {
    background: `${theme.accent}14`,
    color: theme.accent,
    border: `1px solid ${theme.accent}33`,
  };
}

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function CustomerOrdersPage({
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
    redirect(
      `/${slug}/account/login?next=${encodeURIComponent(`/${slug}/account/orders`)}`
    );
  }

  type Order = {
    id: string;
    status: string;
    payment_status: string;
    payment_method: string | null;
    total_cents: number;
    currency: string;
    created_at: string;
  };
  type OrderItem = {
    order_id: string;
    name_snapshot: string;
    quantity: number;
    price_cents_snapshot: number;
  };

  const { data: orders } = await supabase
    .from("sproutly_orders")
    .select(
      "id, status, payment_status, payment_method, total_cents, currency, created_at"
    )
    .eq("merchant_id", store.id)
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const orderList = (orders as Order[] | null) ?? [];
  let items: OrderItem[] = [];
  if (orderList.length > 0) {
    const ids = orderList.map((o) => o.id);
    const { data: it } = await supabase
      .from("sproutly_order_items")
      .select("order_id, name_snapshot, quantity, price_cents_snapshot")
      .in("order_id", ids);
    items = (it as OrderItem[] | null) ?? [];
  }

  const totalCount = orderList.length;

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <header className="mb-14 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.4em",
          }}
        >
          Orders · 訂單歷史
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
          {totalCount === 0 ? "還沒下過訂單" : `${totalCount} 筆訂單在追蹤`}
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
          style={{ color: theme.textMuted, lineHeight: 1.7 }}
        >
          {totalCount === 0
            ? "下單後可以在這裡追蹤狀態跟付款進度。"
            : "點任一筆查看明細、配送資訊與聯絡店家。"}
        </p>
        <Link
          href={`/${slug}/account`}
          className="sproutly-link inline-block mt-8 text-[0.6875rem] tracking-[0.3em] uppercase font-medium"
          style={{ color: theme.text }}
          data-default-line="true"
        >
          ← Back · 會員中心
        </Link>
      </header>

      {orderList.length === 0 ? (
        <div
          className="rounded-2xl p-10 sm:p-12 text-center"
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
            Empty
          </p>
          <div
            className="mt-4 mx-auto h-px w-10"
            style={{
              background: "var(--store-accent, currentColor)",
              opacity: 0.5,
            }}
          />
          <p
            className="mt-5 text-[0.9375rem] leading-[1.9]"
            style={{ color: theme.textMuted }}
          >
            這裡空空的。
            <br />
            去店裡逛一圈？
          </p>
          <Link
            href={`/${slug}/shop`}
            className="sproutly-link inline-block mt-8 text-[0.6875rem] tracking-[0.3em] uppercase font-medium"
            style={{ color: theme.text }}
            data-default-line="true"
          >
            看商品 →
          </Link>
        </div>
      ) : (
        <ul className="space-y-6">
          {orderList.map((order) => {
            const orderItems = items.filter((i) => i.order_id === order.id);
            const shortId = order.id.slice(0, 8).toUpperCase();
            return (
              <li key={order.id}>
                <Link
                  href={`/${slug}/account/orders/${order.id}`}
                  className="block rounded-2xl p-7 sm:p-8 transition hover:opacity-95"
                  style={{
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
                    boxShadow: "var(--sproutly-elev-2)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="min-w-0">
                      <p
                        className="text-[0.6875rem] uppercase font-medium"
                        style={{
                          color: "var(--store-accent, currentColor)",
                          letterSpacing: "0.4em",
                        }}
                      >
                        Order · #{shortId}
                      </p>
                      <p
                        className="mt-3 text-sm"
                        style={{ color: theme.textMuted, lineHeight: 1.7 }}
                      >
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className="inline-block text-[0.6875rem] tracking-[0.3em] uppercase font-medium px-3 py-1.5 rounded-full"
                        style={statusPillStyle(order.status, theme)}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                  </div>

                  <ul
                    className="space-y-3 pb-6 mb-6 border-b text-[0.9375rem] leading-[1.85]"
                    style={{
                      borderColor: theme.border,
                      color: theme.text,
                    }}
                  >
                    {orderItems.map((item, i) => (
                      <li key={i} className="flex justify-between gap-4">
                        <span className="min-w-0 truncate">
                          {item.name_snapshot}
                          <span
                            className="ml-2 text-sm"
                            style={{ color: theme.textMuted }}
                          >
                            × {item.quantity}
                          </span>
                        </span>
                        <span
                          className="tabular-nums whitespace-nowrap text-sm"
                          style={{ color: theme.textMuted }}
                        >
                          {formatPrice(
                            item.price_cents_snapshot * item.quantity,
                            order.currency
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-end justify-between gap-4">
                    <div
                      className="text-[0.8125rem] space-y-1.5"
                      style={{ color: theme.textMuted, lineHeight: 1.7 }}
                    >
                      {order.payment_method && (
                        <p>
                          付款方式 ·{" "}
                          {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                        </p>
                      )}
                      <p>
                        付款狀態 ·{" "}
                        {order.payment_status === "paid"
                          ? "已付款"
                          : order.payment_status === "refunded"
                            ? "已退款"
                            : "未付款"}
                      </p>
                    </div>
                    <p
                      className="text-2xl sm:text-3xl tabular-nums"
                      style={{
                        color: theme.text,
                        fontFamily: "var(--store-font)",
                        fontWeight: 500,
                        letterSpacing: "-0.02em",
                        lineHeight: 1.1,
                      }}
                    >
                      {formatPrice(order.total_cents, order.currency)}
                    </p>
                  </div>

                  <p
                    className="mt-6 pt-5 border-t text-[0.6875rem] tracking-[0.3em] uppercase font-medium text-right"
                    style={{
                      borderColor: theme.border,
                      color: "var(--store-accent, currentColor)",
                    }}
                  >
                    查看訂單 →
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
