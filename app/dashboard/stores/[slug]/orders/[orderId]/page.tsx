import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateOrderStatus } from "./actions";
import { SubmitButton } from "@/app/_components/submit-button";
import { PrintButton } from "@/app/_components/print-button";
import { PAYMENT_LABELS, decodeShippingFromNote } from "@/lib/order-labels";

type Params = Promise<{ slug: string; orderId: string }>;
type SearchParams = Promise<{ error?: string; saved?: string }>;

const STATUS_OPTIONS = [
  { value: "pending", label: "待確認" },
  { value: "confirmed", label: "已確認" },
  { value: "shipped", label: "已出貨" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const PAYMENT_OPTIONS = [
  { value: "unpaid", label: "未付款" },
  { value: "paid", label: "已付款" },
  { value: "refunded", label: "已退款" },
];

// 跟訂單列表頁同一組色票（pending=amber 上色那組），讓商家從列表點進詳情時
// 第一眼就確認「這筆現在是什麼狀態」，不必去右側下拉選單裡找。
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pending: { label: "待確認", color: "bg-amber-100 text-amber-800" },
  confirmed: { label: "已確認", color: "bg-blue-100 text-blue-800" },
  shipped: { label: "已出貨", color: "bg-purple-100 text-purple-800" },
  completed: { label: "已完成", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "已取消", color: "bg-zinc-100 text-zinc-600" },
};

const PAYMENT_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  unpaid: { label: "未付款", color: "bg-amber-100 text-amber-800" },
  paid: { label: "已付款", color: "bg-emerald-100 text-emerald-800" },
  refunded: { label: "已退款", color: "bg-zinc-100 text-zinc-600" },
};

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug, orderId } = await params;
  const { error, saved } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  const { data: order } = await supabase
    .from("sproutly_orders")
    .select("*")
    .eq("id", orderId)
    .eq("merchant_id", store.id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await supabase
    .from("sproutly_order_items")
    .select("*")
    .eq("order_id", order.id);

  const updateBound = updateOrderStatus.bind(null, slug, order.id);
  const shortId = order.id.split("-")[0].toUpperCase();
  const decodedNote = decodeShippingFromNote(order.note);
  const paymentLabel = order.payment_method
    ? (PAYMENT_LABELS[order.payment_method] ?? order.payment_method)
    : null;
  const statusBadge = STATUS_BADGE[order.status] ?? STATUS_BADGE.pending;
  const paymentBadge =
    PAYMENT_STATUS_BADGE[order.payment_status] ?? PAYMENT_STATUS_BADGE.unpaid;

  return (
    <div id="order-print-area">
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          html, body { background: white !important; }
          /* 隱藏所有頁面元素，只保留訂單主體 */
          body * { visibility: hidden; }
          #order-print-area, #order-print-area * { visibility: visible; }
          #order-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          /* 隱藏 print area 內的 nav / buttons / 狀態管理 sidebar */
          .no-print { display: none !important; }
          /* sidebar 變上下排，不要 grid */
          .print-stack { display: block !important; }
          .print-stack > * { margin-bottom: 1rem; }
          /* card 邊框淺一點 */
          .print-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      <div className="no-print">
        <Link
          href={`/dashboard/stores/${slug}/orders`}
          className="inline-block mb-6 text-emerald-700/70 hover:text-emerald-900 transition uppercase"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.3em",
          }}
        >
          ← Back · 訂單列表
        </Link>
      </div>

      <div className="flex items-end justify-between gap-3 mb-10 flex-wrap">
        <div>
          <p
            className="uppercase text-emerald-700/70"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            Order · #{shortId}
          </p>
          <h2
            className="mt-3 text-3xl sm:text-4xl text-emerald-950 font-medium tracking-tight"
            style={{ letterSpacing: "-0.01em", lineHeight: 1.15 }}
          >
            單筆訂單詳情
          </h2>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block text-xs px-2.5 py-1 rounded-full ${statusBadge.color}`}
            >
              {statusBadge.label}
            </span>
            <span
              className={`inline-block text-xs px-2.5 py-1 rounded-full ${paymentBadge.color}`}
            >
              {paymentBadge.label}
            </span>
          </div>
          <span
            aria-hidden
            className="mt-4 block h-px w-12 bg-emerald-600/60"
          />
          <p
            className="mt-4 text-emerald-900/65"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {formatDateTime(order.created_at)} 下單 · 在右側更新狀態
          </p>
        </div>
        <div className="no-print">
          <PrintButton className="rounded-full bg-white border-2 border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50 transition">
            列印訂單
          </PrintButton>
        </div>
      </div>

      <div className="hidden print:block mb-6">
        <p className="text-sm text-zinc-600">
          {store.name} · sproutly.app/{slug}
        </p>
      </div>

      {error && (
        <div
          className="mb-6 rounded-2xl bg-red-50/80 border border-red-200/60 p-5"
          style={{ boxShadow: "var(--sproutly-elev-2)" }}
        >
          <p
            className="uppercase text-red-700/80"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            Notice · 錯誤
          </p>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      )}
      {saved && (
        <div
          className="mb-6 rounded-2xl bg-emerald-50/80 border border-emerald-200/60 p-5"
          style={{ boxShadow: "var(--sproutly-elev-2)" }}
        >
          <p
            className="uppercase text-emerald-700/80"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              letterSpacing: "0.4em",
            }}
          >
            Saved · 已儲存
          </p>
          <p className="mt-2 text-sm text-emerald-800">訂單狀態已更新</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-stack">
        <div className="lg:col-span-2 space-y-6 print-card">
          <section
            className="bg-white rounded-2xl p-7 sm:p-8 border border-emerald-100/70"
            style={{ boxShadow: "var(--sproutly-elev-2)" }}
          >
            <p
              className="uppercase text-emerald-700/70 mb-1.5"
              style={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                letterSpacing: "0.4em",
              }}
            >
              Items · 商品
            </p>
            <span
              aria-hidden
              className="block h-px w-10 bg-emerald-600/50 mb-5"
            />
            <div className="space-y-3">
              {items?.map((it) => (
                <div
                  key={it.id}
                  className="flex justify-between items-baseline py-1"
                >
                  <div>
                    <p className="text-emerald-950 font-medium">
                      {it.name_snapshot}
                    </p>
                    <p
                      className="text-emerald-900/55 mt-0.5"
                      style={{
                        fontSize: "0.75rem",
                        letterSpacing: "0.02em",
                      }}
                    >
                      單價 {formatPrice(it.price_cents_snapshot, order.currency)}
                      {" × "}
                      {it.quantity} 件
                    </p>
                  </div>
                  <p
                    className="text-emerald-950 tabular-nums"
                    style={{
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {formatPrice(
                      it.price_cents_snapshot * it.quantity,
                      order.currency
                    )}
                  </p>
                </div>
              ))}
            </div>
            <hr className="my-5 border-emerald-100" />
            <div className="flex justify-between items-end">
              <p
                className="uppercase text-emerald-700/70"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.4em",
                }}
              >
                Total · 合計
              </p>
              <span
                className="text-3xl sm:text-4xl text-emerald-700 tabular-nums"
                style={{
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                }}
              >
                {formatPrice(order.total_cents, order.currency)}
              </span>
            </div>
          </section>

          <section
            className="bg-white rounded-2xl p-7 sm:p-8 border border-emerald-100/70"
            style={{ boxShadow: "var(--sproutly-elev-2)" }}
          >
            <p
              className="uppercase text-emerald-700/70 mb-1.5"
              style={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                letterSpacing: "0.4em",
              }}
            >
              Recipient · 顧客資訊
            </p>
            <span
              aria-hidden
              className="block h-px w-10 bg-emerald-600/50 mb-5"
            />
            <dl className="text-sm space-y-2">
              <div className="flex gap-3">
                <dt className="text-emerald-900/50 w-20">姓名</dt>
                <dd className="text-emerald-950">{order.customer_name}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-emerald-900/50 w-20">電話</dt>
                <dd className="text-emerald-950">
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="hover:text-emerald-700 transition"
                  >
                    {order.customer_phone}
                  </a>
                </dd>
              </div>
              {order.customer_email && (
                <div className="flex gap-3">
                  <dt className="text-emerald-900/50 w-20">Email</dt>
                  <dd className="text-emerald-950">
                    <a
                      href={`mailto:${order.customer_email}`}
                      className="hover:text-emerald-700 transition"
                    >
                      {order.customer_email}
                    </a>
                  </dd>
                </div>
              )}
              {order.shipping_address && (
                <div className="flex gap-3">
                  <dt className="text-emerald-900/50 w-20">地址</dt>
                  <dd className="text-emerald-950">
                    {order.shipping_address}
                  </dd>
                </div>
              )}
              {decodedNote.userNote && (
                <div className="flex gap-3 pt-2 border-t border-emerald-50 mt-2">
                  <dt className="text-emerald-900/50 w-20">備註</dt>
                  <dd className="text-emerald-950 italic">{decodedNote.userNote}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* 物流 + 付款資訊 */}
          {(decodedNote.shippingLabel || paymentLabel) && (
            <section
              className="bg-white rounded-2xl p-7 sm:p-8 border border-emerald-100/70"
              style={{ boxShadow: "var(--sproutly-elev-2)" }}
            >
              <p
                className="uppercase text-emerald-700/70 mb-1.5"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.4em",
                }}
              >
                Logistics · 配送與付款
              </p>
              <span
                aria-hidden
                className="block h-px w-10 bg-emerald-600/50 mb-5"
              />
              <dl className="text-sm space-y-2">
                {decodedNote.shippingLabel && (
                  <div className="flex gap-3">
                    <dt className="text-emerald-900/50 w-20">配送方式</dt>
                    <dd className="text-emerald-950">
                      {decodedNote.shippingLabel}
                    </dd>
                  </div>
                )}
                {decodedNote.storeName && (
                  <div className="flex gap-3">
                    <dt className="text-emerald-900/50 w-20">取貨門市</dt>
                    <dd className="text-emerald-950">{decodedNote.storeName}</dd>
                  </div>
                )}
                {paymentLabel && (
                  <div className="flex gap-3">
                    <dt className="text-emerald-900/50 w-20">付款方式</dt>
                    <dd className="text-emerald-950">{paymentLabel}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        <aside className="space-y-4 no-print">
          <form action={updateBound}>
            <section
              className="bg-white rounded-2xl p-7 sm:p-8 border border-emerald-100/70 space-y-5"
              style={{ boxShadow: "var(--sproutly-elev-2)" }}
            >
              <div>
                <p
                  className="uppercase text-emerald-700/70 mb-1.5"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.4em",
                  }}
                >
                  Manage · 狀態管理
                </p>
                <span
                  aria-hidden
                  className="block h-px w-10 bg-emerald-600/50"
                />
              </div>

              <div>
                <label
                  className="block text-emerald-900/70 mb-2 uppercase"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.3em",
                  }}
                >
                  Status · 訂單狀態
                </label>
                <select
                  name="status"
                  defaultValue={order.status}
                  className="w-full rounded-xl border border-emerald-100 px-3 py-2.5 outline-none focus:border-emerald-400 transition bg-white text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-emerald-900/70 mb-2 uppercase"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.3em",
                  }}
                >
                  Payment · 付款狀態
                </label>
                <select
                  name="payment_status"
                  defaultValue={order.payment_status}
                  className="w-full rounded-xl border border-emerald-100 px-3 py-2.5 outline-none focus:border-emerald-400 transition bg-white text-sm"
                >
                  {PAYMENT_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <SubmitButton
                pendingText="儲存中..."
                className="w-full rounded-full bg-emerald-700 px-6 py-2.5 text-white text-sm font-medium hover:bg-emerald-800 shadow-lg shadow-emerald-700/20"
              >
                更新狀態
              </SubmitButton>
            </section>
          </form>

          <section
            className="bg-white rounded-2xl p-7 sm:p-8 border border-emerald-100/70 space-y-3"
            style={{ boxShadow: "var(--sproutly-elev-2)" }}
          >
            <div>
              <p
                className="uppercase text-emerald-700/70 mb-1.5"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.4em",
                }}
              >
                Timeline · 時間軸
              </p>
              <span
                aria-hidden
                className="block h-px w-10 bg-emerald-600/50 mb-4"
              />
            </div>
            <dl className="space-y-2.5 text-xs text-emerald-900/70">
              <div className="flex gap-3">
                <dt
                  className="text-emerald-700/60 uppercase w-16 shrink-0"
                  style={{ letterSpacing: "0.25em", fontWeight: 500 }}
                >
                  Placed
                </dt>
                <dd className="text-emerald-950 tabular-nums">
                  {formatDateTime(order.created_at)}
                </dd>
              </div>
              {order.paid_at && (
                <div className="flex gap-3">
                  <dt
                    className="text-emerald-700/60 uppercase w-16 shrink-0"
                    style={{ letterSpacing: "0.25em", fontWeight: 500 }}
                  >
                    Paid
                  </dt>
                  <dd className="text-emerald-950 tabular-nums">
                    {formatDateTime(order.paid_at)}
                  </dd>
                </div>
              )}
              {order.shipped_at && (
                <div className="flex gap-3">
                  <dt
                    className="text-emerald-700/60 uppercase w-16 shrink-0"
                    style={{ letterSpacing: "0.25em", fontWeight: 500 }}
                  >
                    Shipped
                  </dt>
                  <dd className="text-emerald-950 tabular-nums">
                    {formatDateTime(order.shipped_at)}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
