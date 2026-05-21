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

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
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
          className="text-sm text-emerald-900/70 hover:text-emerald-900 transition inline-block mb-4"
        >
          ← 訂單列表
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h2 className="text-2xl font-bold text-emerald-950">
          訂單 #{shortId}
        </h2>
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
        <div className="mb-6 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">
          ✓ 訂單狀態已更新
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print-stack">
        <div className="lg:col-span-2 space-y-6 print-card">
          <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
            <h3 className="text-sm font-semibold text-emerald-900 mb-4">
              商品
            </h3>
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
                    <p className="text-xs text-emerald-900/50">
                      單價 {formatPrice(it.price_cents_snapshot, order.currency)}
                      {" × "}
                      {it.quantity} 件
                    </p>
                  </div>
                  <p className="font-semibold text-emerald-950">
                    {formatPrice(
                      it.price_cents_snapshot * it.quantity,
                      order.currency
                    )}
                  </p>
                </div>
              ))}
            </div>
            <hr className="my-4 border-emerald-100" />
            <div className="flex justify-between items-end">
              <span className="text-emerald-900/60">合計</span>
              <span className="text-2xl font-bold text-emerald-950">
                {formatPrice(order.total_cents, order.currency)}
              </span>
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
            <h3 className="text-sm font-semibold text-emerald-900 mb-4">
              顧客資訊
            </h3>
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
            <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
              <h3 className="text-sm font-semibold text-emerald-900 mb-4">
                配送與付款
              </h3>
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
            <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5 space-y-4">
              <h3 className="text-sm font-semibold text-emerald-900">
                狀態管理
              </h3>

              <div>
                <label className="block text-xs text-emerald-900/60 mb-1.5">
                  訂單狀態
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
                <label className="block text-xs text-emerald-900/60 mb-1.5">
                  付款狀態
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

          <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5 text-xs text-emerald-900/60 space-y-2">
            <div>
              <span className="text-emerald-900/40">下單：</span>
              {new Date(order.created_at).toLocaleString("zh-TW")}
            </div>
            {order.paid_at && (
              <div>
                <span className="text-emerald-900/40">付款：</span>
                {new Date(order.paid_at).toLocaleString("zh-TW")}
              </div>
            )}
            {order.shipped_at && (
              <div>
                <span className="text-emerald-900/40">出貨：</span>
                {new Date(order.shipped_at).toLocaleString("zh-TW")}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
