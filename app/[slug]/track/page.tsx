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

  return (
    <main className="max-w-2xl mx-auto px-6 py-16 sm:py-20">
      <div className="mb-12 sm:mb-14">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{ color: theme.accent, letterSpacing: "0.4em" }}
        >
          Order Tracking
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            color: theme.text,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          訂單追蹤
        </h1>
        <div
          className="mt-5 h-px w-12"
          style={{ background: theme.accent, opacity: 0.5 }}
        />
        <p
          className="mt-5 text-[0.9375rem]"
          style={{ color: theme.textMuted, lineHeight: 1.7 }}
        >
          輸入下單時拿到的訂單編號 + 聯絡電話，就能查當前狀態
        </p>
      </div>

      <form
        method="GET"
        className="rounded-2xl p-7 sm:p-8 mb-10 space-y-5"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          boxShadow: "var(--sproutly-elev-2)",
        }}
      >
        <div>
          <label
            htmlFor="track-id"
            className="block text-[0.6875rem] uppercase mb-2.5 font-medium"
            style={{ color: theme.textMuted, letterSpacing: "0.3em" }}
          >
            訂單編號
          </label>
          <input
            id="track-id"
            name="id"
            type="text"
            required
            defaultValue={rawId}
            placeholder="例如 #A1B2C3D4"
            className="sproutly-input font-mono"
          />
        </div>
        <div>
          <label
            htmlFor="track-phone"
            className="block text-[0.6875rem] uppercase mb-2.5 font-medium"
            style={{ color: theme.textMuted, letterSpacing: "0.3em" }}
          >
            聯絡電話
          </label>
          <input
            id="track-phone"
            name="phone"
            type="tel"
            required
            defaultValue={phone}
            placeholder="下單時填的電話"
            className="sproutly-input"
          />
        </div>
        <button
          type="submit"
          className="sproutly-btn sproutly-btn-primary sproutly-btn-lg w-full"
        >
          查詢訂單
        </button>
      </form>

      {searched && !order && (
        <div
          className="rounded-2xl p-10 text-center"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            boxShadow: "var(--sproutly-elev-1)",
          }}
        >
          <p
            className="text-[0.6875rem] uppercase mb-4 font-medium"
            style={{ color: theme.textMuted, letterSpacing: "0.4em" }}
          >
            Not Found
          </p>
          <p
            className="text-xl font-medium"
            style={{ color: theme.text, letterSpacing: "-0.005em" }}
          >
            找不到對應的訂單
          </p>
          <div
            className="my-5 h-px w-10 mx-auto"
            style={{ background: theme.border }}
          />
          <p
            className="text-sm"
            style={{ color: theme.textMuted, lineHeight: 1.7 }}
          >
            請確認訂單編號跟電話都正確
            <br className="sm:hidden" />
            。或直接聯絡店家詢問
          </p>
        </div>
      )}

      {order && (
        <div className="space-y-6">
          {/* 狀態 step indicator */}
          <section
            className="rounded-2xl p-7 sm:p-8"
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              boxShadow: "var(--sproutly-elev-2)",
            }}
          >
            {order.status === "cancelled" ? (
              <div className="text-center py-8">
                <p
                  className="text-[0.6875rem] uppercase font-medium"
                  style={{ color: theme.textMuted, letterSpacing: "0.4em" }}
                >
                  Cancelled
                </p>
                <p
                  className="mt-4 text-xl font-medium"
                  style={{ color: theme.text, letterSpacing: "-0.005em" }}
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
            className="rounded-2xl p-7 sm:p-8 space-y-6"
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              boxShadow: "var(--sproutly-elev-2)",
            }}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p
                className="text-[0.6875rem] uppercase font-medium"
                style={{ color: theme.accent, letterSpacing: "0.4em" }}
              >
                訂單編號
              </p>
              <p
                className="font-mono text-[0.9375rem] font-semibold"
                style={{ color: theme.text, letterSpacing: "0.02em" }}
              >
                #{order.id.split("-")[0].toUpperCase()}
              </p>
            </div>

            <hr style={{ borderColor: theme.border }} />

            <div>
              <p
                className="text-[0.6875rem] uppercase mb-4 font-medium"
                style={{ color: theme.accent, letterSpacing: "0.4em" }}
              >
                商品
              </p>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-baseline text-[0.9375rem]"
                    style={{ color: theme.text }}
                  >
                    <span>
                      {it.name_snapshot} × {it.quantity}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatPrice(
                        it.price_cents_snapshot * it.quantity,
                        order.currency
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <hr style={{ borderColor: theme.border }} />

            <div className="flex justify-between items-end">
              <span
                className="text-[0.6875rem] uppercase font-medium"
                style={{ color: theme.textMuted, letterSpacing: "0.4em" }}
              >
                合計
              </span>
              <span
                className="text-2xl font-medium"
                style={{
                  color: theme.accent,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                }}
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
                  <dl className="text-[0.9375rem] space-y-2">
                    {decoded.shippingLabel && (
                      <div className="flex gap-3">
                        <dt
                          className="w-20 shrink-0"
                          style={{ color: theme.textMuted }}
                        >
                          配送方式
                        </dt>
                        <dd style={{ color: theme.text }}>
                          {decoded.shippingLabel}
                        </dd>
                      </div>
                    )}
                    {decoded.storeName && (
                      <div className="flex gap-3">
                        <dt
                          className="w-20 shrink-0"
                          style={{ color: theme.textMuted }}
                        >
                          取貨門市
                        </dt>
                        <dd style={{ color: theme.text }}>
                          {decoded.storeName}
                        </dd>
                      </div>
                    )}
                    {paymentLabel && (
                      <div className="flex gap-3">
                        <dt
                          className="w-20 shrink-0"
                          style={{ color: theme.textMuted }}
                        >
                          付款方式
                        </dt>
                        <dd style={{ color: theme.text }}>{paymentLabel}</dd>
                      </div>
                    )}
                  </dl>
                </>
              );
            })()}
          </section>
        </div>
      )}

      <div className="mt-14 text-center">
        <Link
          href={`/${slug}`}
          className="sproutly-link text-[0.6875rem] uppercase font-medium transition"
          style={{ color: theme.textMuted, letterSpacing: "0.3em" }}
        >
          ← 回 {store.name}
        </Link>
      </div>
    </main>
  );
}
