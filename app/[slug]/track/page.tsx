import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTheme } from "../_theme";
import { PAYMENT_LABELS, decodeShippingFromNote } from "@/lib/order-labels";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ id?: string; phone?: string }>;

const STATUS_STEPS: { key: string; label: string; num: string }[] = [
  { key: "pending", label: "待店家確認", num: "1" },
  { key: "confirmed", label: "店家已確認", num: "2" },
  { key: "shipped", label: "已出貨", num: "3" },
  { key: "completed", label: "完成", num: "4" },
];

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawId = (sp.id ?? "").trim();
  const shortId = rawId.replace(/^#/, "").toLowerCase();
  const phone = (sp.phone ?? "").trim();

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name, slug, theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  type Order = {
    id: string;
    status: string;
    payment_status: string;
    paid_at: string | null;
    shipped_at: string | null;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    shipping_address: string | null;
    note: string | null;
    total_cents: number;
    currency: string;
    payment_method: string | null;
  };

  let order: Order | null = null;
  let items: {
    name_snapshot: string;
    quantity: number;
    price_cents_snapshot: number;
  }[] = [];
  let searched = false;

  if (shortId && phone) {
    searched = true;
    const admin = createAdminClient();
    const { data: orders } = await admin
      .from("sproutly_orders")
      .select(
        "id, status, payment_status, paid_at, shipped_at, created_at, customer_name, customer_phone, customer_email, shipping_address, note, total_cents, currency, payment_method"
      )
      .eq("merchant_id", store.id)
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false });
    order =
      (orders as Order[] | null)?.find((o) =>
        o.id.toLowerCase().startsWith(shortId)
      ) ?? null;

    if (order) {
      const { data: it } = await admin
        .from("sproutly_order_items")
        .select("name_snapshot, quantity, price_cents_snapshot")
        .eq("order_id", order.id);
      items = it ?? [];
    }
  }

  const inputStyle = {
    background: theme.surface,
    color: theme.text,
    border: `1px solid ${theme.border}`,
  };

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p
          className="text-xs uppercase tracking-widest"
          style={{ color: theme.accent }}
        >
          Order Tracking
        </p>
        <h1
          className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight"
          style={{ color: theme.text }}
        >
          訂單追蹤
        </h1>
        <p className="mt-3 text-sm" style={{ color: theme.textMuted }}>
          輸入下單時拿到的訂單編號 + 聯絡電話，就能查當前狀態
        </p>
      </div>

      <form
        method="GET"
        className="rounded-2xl p-6 shadow-sm mb-8 space-y-4"
        style={{ background: theme.surface }}
      >
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: theme.text }}
          >
            訂單編號
          </label>
          <input
            name="id"
            type="text"
            required
            defaultValue={rawId}
            placeholder="例如 #A1B2C3D4"
            className="w-full rounded-xl px-4 py-3 outline-none transition font-mono"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: theme.text }}
          >
            聯絡電話
          </label>
          <input
            name="phone"
            type="tel"
            required
            defaultValue={phone}
            placeholder="下單時填的電話"
            className="w-full rounded-xl px-4 py-3 outline-none transition"
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-full px-8 py-3.5 font-medium transition hover:opacity-90"
          style={{ background: theme.primary, color: theme.surface }}
        >
          查詢
        </button>
      </form>

      {searched && !order && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: theme.surface }}
        >
          <p
            className="text-xs tracking-widest uppercase mb-3"
            style={{ color: theme.textMuted }}
          >
            Not Found
          </p>
          <p className="font-medium" style={{ color: theme.text }}>
            找不到對應的訂單
          </p>
          <p
            className="mt-2 text-sm"
            style={{ color: theme.textMuted }}
          >
            請確認訂單編號跟電話都正確。或直接聯絡店家詢問
          </p>
        </div>
      )}

      {order && (
        <div className="space-y-6">
          {/* 狀態 step indicator */}
          <section
            className="rounded-2xl p-6 shadow-sm"
            style={{ background: theme.surface }}
          >
            {order.status === "cancelled" ? (
              <div className="text-center py-6">
                <p
                  className="text-sm tracking-widest uppercase"
                  style={{ color: theme.textMuted }}
                >
                  Cancelled
                </p>
                <p
                  className="mt-3 text-lg font-medium"
                  style={{ color: theme.text }}
                >
                  訂單已取消
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-6">
                  {STATUS_STEPS.map((step, i) => {
                    const currentIdx = STATUS_STEPS.findIndex(
                      (s) => s.key === order.status
                    );
                    const done = i <= currentIdx;
                    const current = i === currentIdx;
                    return (
                      <div
                        key={step.key}
                        className="flex flex-col items-center flex-1 min-w-0 relative"
                      >
                        {i < STATUS_STEPS.length - 1 && (
                          <div
                            className="absolute top-5 left-1/2 w-full h-0.5"
                            style={{
                              background:
                                i < currentIdx
                                  ? theme.primary
                                  : theme.border,
                            }}
                          />
                        )}
                        <div
                          className="relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition"
                          style={{
                            background: done ? theme.primary : theme.bg,
                            color: done ? theme.surface : theme.textMuted,
                            border: `2px solid ${done ? theme.primary : theme.border}`,
                            transform: current ? "scale(1.15)" : "scale(1)",
                          }}
                        >
                          {step.num}
                        </div>
                        <p
                          className="mt-2 text-xs text-center px-1"
                          style={{
                            color: done ? theme.text : theme.textMuted,
                            fontWeight: current ? 600 : 400,
                          }}
                        >
                          {step.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p
                  className="text-center text-sm"
                  style={{ color: theme.textMuted }}
                >
                  {order.status === "pending" && "店家收到你的訂單了，請等待確認"}
                  {order.status === "confirmed" &&
                    "店家已確認訂單，正在備貨中"}
                  {order.status === "shipped" && "商品已寄出，請耐心等待"}
                  {order.status === "completed" && "訂單完成，謝謝你的支持"}
                </p>
              </>
            )}
          </section>

          {/* 訂單詳細 */}
          <section
            className="rounded-2xl p-6 shadow-sm space-y-4"
            style={{ background: theme.surface }}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p
                className="text-xs uppercase tracking-widest"
                style={{ color: theme.accent }}
              >
                訂單編號
              </p>
              <p
                className="font-mono font-semibold"
                style={{ color: theme.text }}
              >
                #{order.id.split("-")[0].toUpperCase()}
              </p>
            </div>

            <hr style={{ borderColor: theme.border }} />

            <div>
              <p
                className="text-xs uppercase tracking-widest mb-2"
                style={{ color: theme.accent }}
              >
                商品
              </p>
              {items.map((it, i) => (
                <div
                  key={i}
                  className="flex justify-between items-baseline py-1 text-sm"
                  style={{ color: theme.text }}
                >
                  <span>
                    {it.name_snapshot} × {it.quantity}
                  </span>
                  <span>
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
                className="text-xl font-bold"
                style={{ color: theme.accent }}
              >
                {formatPrice(order.total_cents, order.currency)}
              </span>
            </div>

            {(() => {
              const decoded = decodeShippingFromNote(order.note);
              const paymentLabel = order.payment_method
                ? (PAYMENT_LABELS[order.payment_method] ?? order.payment_method)
                : null;
              if (!decoded.shippingLabel && !paymentLabel) return null;
              return (
                <>
                  <hr style={{ borderColor: theme.border }} />
                  <div className="text-sm space-y-1">
                    {decoded.shippingLabel && (
                      <p style={{ color: theme.text }}>
                        配送方式：{decoded.shippingLabel}
                      </p>
                    )}
                    {decoded.storeName && (
                      <p style={{ color: theme.text }}>
                        取貨門市：{decoded.storeName}
                      </p>
                    )}
                    {paymentLabel && (
                      <p style={{ color: theme.text }}>
                        付款方式：{paymentLabel}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      )}

      <div className="mt-12 text-center">
        <Link
          href={`/${slug}`}
          className="text-sm transition hover:opacity-70"
          style={{ color: theme.textMuted }}
        >
          ← 回 {store.name}
        </Link>
      </div>
    </main>
  );
}
