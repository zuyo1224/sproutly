import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../../_theme";
import {
  paymentMethodLabel,
  PAYMENT_STATUS_LABELS,
  shortOrderId,
  CUSTOMER_STATUS_LABELS,
} from "@/lib/order-labels";
import { RecentlyViewed } from "@/app/_components/recently-viewed";
import { StoreEmptyState } from "@/app/_components/store-empty-state";

// 蓋掉父層 account/layout 的「會員中心」，訂單列表分頁顯示「訂單紀錄」。
export const metadata: Metadata = { title: "訂單紀錄" };

type Params = Promise<{ slug: string }>;

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

import { formatPrice } from "@/lib/format-price";
import { taipeiDateLong } from "@/lib/format-date";

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
  // 「在追蹤」只算真的還在跑的單。卡片 pill 已把進行中（accent）跟已結案（灰）分開，
  // 標題若把已完成/已取消也算進「追蹤」，就跟下面的卡片講不同的話。
  const activeCount = orderList.filter(
    (o) =>
      o.status === "pending" ||
      o.status === "confirmed" ||
      o.status === "shipped"
  ).length;

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
          {totalCount === 0
            ? "還沒下過訂單"
            : activeCount > 0
              ? `${activeCount} 筆訂單進行中`
              : `共 ${totalCount} 筆訂單`}
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
            : activeCount === 0
              ? "這些單都結束了，點任一筆回顧明細或聯絡店家。"
              : activeCount < totalCount
                ? `${activeCount} 筆還在處理，其餘已結束。點任一筆查看明細、配送與聯絡店家。`
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
        <>
        {/* 對齊購物車、收藏的編輯風空狀態（左對齊 eyebrow + 大標 + 說明 + 連結），
            不再用置中卡片配「這裡空空的／去店裡逛一圈」那套較口語、排版也跟其餘頁
            對不上的寫法。標題列已說「還沒下過訂單／下單後可在這裡追蹤」，所以這裡
            的大標走邀請語氣、不重複那句；說明與「去逛逛 →」連結跟 cart／favorites 同款。 */}
        <StoreEmptyState
          titleColor={theme.text}
          descriptionColor={theme.textMuted}
          title={
            <>
              逛一圈，
              <br />
              帶第一株回家
            </>
          }
          description={
            <>
              遇到合眼緣的，加進購物車結帳，
              <br />
              這裡就會留下第一筆紀錄。
            </>
          }
        >
          <Link
            href={`/${slug}/shop`}
            className="sproutly-link mt-10 inline-block text-[0.75rem] uppercase font-medium"
            style={{ color: theme.text, letterSpacing: "0.3em" }}
            data-default-line="true"
          >
            去逛逛 →
          </Link>
        </StoreEmptyState>
        {/* 登入會員一筆單都沒下過時，上面那塊本身只有「去逛逛」一條出口。
            把這台裝置剛看過的幾株接回來，客人想起「剛剛那株」可直接點回去——
            跟購物車、收藏、shop 搜不到時完全同一套救援列（純 client localStorage
            讀取，不傳 current 故只讀不記錄、不傳 colors 吃店面 --store-* 變數）。
            沒看過紀錄就整段不出現（元件自判），第一次逛店的人不受影響。
            放在左對齊文字塊外，讓商品網格用整個容器寬度。 */}
        <RecentlyViewed slug={slug} className="mt-12" />
        </>
      ) : (
        <ul className="space-y-6">
          {orderList.map((order) => {
            const orderItems = items.filter((i) => i.order_id === order.id);
            const shortId = shortOrderId(order.id);
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
                        {taipeiDateLong(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className="inline-block text-[0.6875rem] tracking-[0.3em] uppercase font-medium px-3 py-1.5 rounded-full"
                        style={statusPillStyle(order.status, theme)}
                      >
                        {CUSTOMER_STATUS_LABELS[order.status] ?? order.status}
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
                          {paymentMethodLabel(order.payment_method)}
                        </p>
                      )}
                      <p>
                        付款狀態 ·{" "}
                        {PAYMENT_STATUS_LABELS[order.payment_status] ??
                          order.payment_status}
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
