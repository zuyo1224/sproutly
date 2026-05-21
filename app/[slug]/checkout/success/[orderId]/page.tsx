import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTheme } from "../../../_theme";
import { PAYMENT_LABELS, decodeShippingFromNote } from "@/lib/order-labels";
import { Confetti } from "@/app/_components/confetti";

type Params = Promise<{ slug: string; orderId: string }>;

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export default async function OrderSuccessPage({
  params,
}: {
  params: Params;
}) {
  const { slug, orderId } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  // 用 admin client 查訂單（顧客是匿名身份，無法 SELECT orders）
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("sproutly_orders")
    .select("*")
    .eq("id", orderId)
    .eq("merchant_id", store.id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await admin
    .from("sproutly_order_items")
    .select("*")
    .eq("order_id", order.id);

  const shortId = order.id.split("-")[0].toUpperCase();
  const decodedNote = decodeShippingFromNote(order.note);
  const paymentLabel = order.payment_method
    ? (PAYMENT_LABELS[order.payment_method] ?? order.payment_method)
    : null;
  const orderDate = new Date(order.created_at).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <Confetti count={70} />
      <div className="text-center mb-10">
        <p
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: theme.accent }}
        >
          Order Received
        </p>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: theme.text }}
        >
          訂單已送出
        </h1>
        <p
          className="mt-3"
          style={{ color: theme.textMuted }}
        >
          {store.name} 已收到你的訂單，會盡快聯絡你確認付款方式
        </p>
      </div>

      <div
        className="rounded-2xl p-6 shadow-sm space-y-5"
        style={{ background: theme.surface }}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: theme.accent }}
            >
              訂單編號
            </p>
            <p
              className="mt-1 text-xl font-mono font-semibold"
              style={{ color: theme.text }}
            >
              #{shortId}
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: theme.accent }}
            >
              下單時間
            </p>
            <p
              className="mt-1 text-sm"
              style={{ color: theme.text }}
            >
              {orderDate}
            </p>
          </div>
        </div>

        <hr style={{ borderColor: theme.border }} />

        <div>
          <p
            className="text-xs uppercase tracking-widest mb-3"
            style={{ color: theme.accent }}
          >
            商品
          </p>
          {items?.map((it) => (
            <div
              key={it.id}
              className="flex justify-between items-baseline py-1"
            >
              <span style={{ color: theme.text }}>
                {it.name_snapshot} × {it.quantity}
              </span>
              <span
                className="font-medium"
                style={{ color: theme.text }}
              >
                {formatPrice(
                  it.price_cents_snapshot * it.quantity,
                  order.currency
                )}
              </span>
            </div>
          ))}
        </div>

        <hr style={{ borderColor: theme.border }} />

        <div className="flex justify-between items-end">
          <span style={{ color: theme.textMuted }}>合計</span>
          <span
            className="text-2xl font-bold"
            style={{ color: theme.accent }}
          >
            {formatPrice(order.total_cents, order.currency)}
          </span>
        </div>

        <hr style={{ borderColor: theme.border }} />

        <div>
          <p
            className="text-xs uppercase tracking-widest mb-2"
            style={{ color: theme.accent }}
          >
            收件資訊
          </p>
          <div
            className="text-sm space-y-1"
            style={{ color: theme.text }}
          >
            <p>{order.customer_name}</p>
            <p>{order.customer_phone}</p>
            {order.customer_email && <p>{order.customer_email}</p>}
            {order.shipping_address && (
              <p style={{ color: theme.textMuted }}>
                {order.shipping_address}
              </p>
            )}
            {decodedNote.userNote && (
              <p
                className="pt-2 italic"
                style={{ color: theme.textMuted }}
              >
                備註：{decodedNote.userNote}
              </p>
            )}
          </div>
        </div>

        {(decodedNote.shippingLabel || paymentLabel) && (
          <>
            <hr style={{ borderColor: theme.border }} />
            <div>
              <p
                className="text-xs uppercase tracking-widest mb-2"
                style={{ color: theme.accent }}
              >
                配送與付款
              </p>
              <div
                className="text-sm space-y-1"
                style={{ color: theme.text }}
              >
                {decodedNote.shippingLabel && (
                  <p>配送方式：{decodedNote.shippingLabel}</p>
                )}
                {decodedNote.storeName && (
                  <p>取貨門市：{decodedNote.storeName}</p>
                )}
                {paymentLabel && <p>付款方式：{paymentLabel}</p>}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href={`/${slug}/shop`}
          className="text-center rounded-full px-6 py-3 font-medium transition hover:opacity-80"
          style={{
            background: theme.primary,
            color: theme.surface,
          }}
        >
          繼續逛
        </Link>
        <Link
          href={`/${slug}`}
          className="text-center rounded-full px-6 py-3 font-medium border-2 transition hover:opacity-80"
          style={{
            borderColor: theme.border,
            color: theme.text,
          }}
        >
          回首頁
        </Link>
      </div>

      <p
        className="text-xs text-center mt-8"
        style={{ color: theme.textMuted, opacity: 0.6 }}
      >
        請記下訂單編號 <strong className="font-mono">#{shortId}</strong>，跟店家確認付款時、或之後
        <Link
          href={`/${slug}/track`}
          className="underline ml-1 hover:opacity-80"
          style={{ color: theme.accent }}
        >
          追蹤訂單
        </Link>
        時都會用到
      </p>
    </main>
  );
}
