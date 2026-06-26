import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../../../_theme";
import {
  PAYMENT_LABELS,
  decodeShippingFromNote,
  orderStatusMessage,
} from "@/lib/order-labels";
import { telHref, mailHref } from "@/lib/contact-href";
import { PrintButton } from "@/app/_components/print-button";

// 蓋掉父層 account/layout 的「會員中心」，單筆訂單分頁顯示「訂單明細」。
export const metadata: Metadata = { title: "訂單明細" };

type Params = Promise<{ slug: string; id: string }>;

const STATUS_LABELS: Record<string, string> = {
  pending: "待店家確認",
  confirmed: "已確認",
  shipped: "已出貨",
  completed: "完成",
  cancelled: "取消",
};

// 一張單正常會走的四個階段，給客人看「現在到哪一步、還剩幾步」。
// cancelled 不在這條線上，會另外顯示已取消，不畫進度條。
const STATUS_FLOW = [
  { key: "pending", label: "待確認" },
  { key: "confirmed", label: "已確認" },
  { key: "shipped", label: "已出貨" },
  { key: "completed", label: "完成" },
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "未付款",
  paid: "已付款",
  refunded: "已退款",
};

import { formatPrice } from "@/lib/format-price";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name, theme, contact_phone, contact_email")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect(
      `/${slug}/account/login?next=${encodeURIComponent(`/${slug}/account/orders/${id}`)}`
    );
  }

  const { data: order } = await supabase
    .from("sproutly_orders")
    .select("*")
    .eq("id", id)
    .eq("merchant_id", store.id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await supabase
    .from("sproutly_order_items")
    .select("id, name_snapshot, quantity, price_cents_snapshot")
    .eq("order_id", order.id);

  const shortId = order.id.slice(0, 8).toUpperCase();
  const decodedNote = decodeShippingFromNote(order.note);
  const paymentLabel = order.payment_method
    ? (PAYMENT_LABELS[order.payment_method] ?? order.payment_method)
    : null;

  const orderItems = items ?? [];

  const isCancelled = order.status === "cancelled";
  // 找出目前走到第幾階段；查不到（理論上不會）就當還在第一步。
  const currentStep = STATUS_FLOW.findIndex((s) => s.key === order.status);
  const stepIndex = currentStep === -1 ? 0 : currentStep;

  return (
    <main className="max-w-3xl mx-auto px-6 py-24 sm:py-32">
      <div className="mb-14 sm:mb-20">
        <p
          className="text-[10px] tracking-[0.4em] uppercase mb-5"
          style={{ color: theme.accent }}
        >
          Order · #{shortId}
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
          {STATUS_LABELS[order.status] ?? order.status}
        </h1>
        <p
          className="mt-5 text-sm"
          style={{ color: theme.textMuted }}
        >
          {formatDateTime(order.created_at)}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 print:hidden">
          <Link
            href={`/${slug}/account/orders`}
            className="sproutly-link text-xs tracking-[0.3em] uppercase"
            style={{ color: theme.text }}
            data-default-line="true"
          >
            ← 訂單歷史
          </Link>
          {/* 列印 / 存 PDF 收據：要報帳或想留紙本底的客人用得到。結帳成功頁只看得到一次，
              過去的單要留底就靠這裡。列印時靠 layout 的 @media print 把導覽/頁尾收乾淨，
              這頁的按鈕自己 print:hidden、底部補一段紙本專屬店家資訊。 */}
          <PrintButton className="sproutly-link text-xs tracking-[0.3em] uppercase">
            列印收據 · 存 PDF
          </PrintButton>
        </div>
      </div>

      <section
        className="rounded-2xl p-7 sm:p-9 mb-6"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
        }}
      >
        <p
          className="text-[10px] tracking-[0.4em] uppercase mb-7"
          style={{ color: theme.accent }}
        >
          Progress · 訂單進度
        </p>
        {isCancelled ? (
          <p
            className="text-sm leading-[1.85]"
            style={{ color: theme.textMuted }}
          >
            這筆訂單已取消。如有疑問，可從下方聯絡店家。
          </p>
        ) : (
          <ol className="flex" aria-label="訂單進度">
            {STATUS_FLOW.map((step, i) => {
              const done = i <= stepIndex;
              const isCurrent = i === stepIndex;
              const last = i === STATUS_FLOW.length - 1;
              // 圈圈與連接線都 aria-hidden，純色塊報讀器讀不出意思；
              // 每步名稱後補一句 sr-only 狀態，目前那步再標 aria-current，
              // 讓看不見進度條的客人也聽得出走到第幾步（跟查訂單頁同一套）
              const stateText = isCurrent
                ? "目前進度"
                : done
                  ? "已完成"
                  : "尚未進行";
              return (
                <li
                  key={step.key}
                  className="relative flex flex-1 flex-col items-center"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-[7px] h-px w-full"
                      style={{
                        background: i < stepIndex ? theme.accent : theme.border,
                      }}
                    />
                  )}
                  <span
                    aria-hidden
                    className="relative z-10 h-3.5 w-3.5 rounded-full"
                    style={{
                      background: done ? theme.accent : theme.surface,
                      border: `1px solid ${done ? theme.accent : theme.border}`,
                      boxShadow: isCurrent
                        ? `0 0 0 4px ${theme.accent}1f`
                        : undefined,
                    }}
                  />
                  <span
                    className="mt-3 text-[11px] tracking-[0.08em]"
                    style={{
                      color: done ? theme.text : theme.textMuted,
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {step.label}
                    <span className="sr-only">（{stateText}）</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {/* 進度條只給「走到第幾步」，這句話補上「現在這步代表什麼、接下來怎樣」——
            已出貨那步還會依取貨方式提醒（超商取貨記得帶證件去門市），跟查訂單頁同一套說法。 */}
        {!isCancelled &&
          (() => {
            const msg = orderStatusMessage(
              order.status,
              decodedNote.shippingLabel,
              decodedNote.storeName
            );
            if (!msg) return null;
            return (
              <p
                className="mt-7 pt-6 border-t text-sm leading-[1.85]"
                style={{ borderColor: theme.border, color: theme.textMuted }}
              >
                {msg}
              </p>
            );
          })()}
      </section>

      <section
        className="rounded-2xl p-7 sm:p-9 mb-6"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
        }}
      >
        <p
          className="text-[10px] tracking-[0.4em] uppercase mb-5"
          style={{ color: theme.accent }}
        >
          Items
        </p>
        <ul
          className="space-y-3 text-sm leading-[1.85]"
          style={{ color: theme.text }}
        >
          {orderItems.map((item) => (
            <li
              key={item.id}
              className="flex justify-between gap-4 items-baseline"
            >
              <div className="min-w-0">
                <span className="block truncate">{item.name_snapshot}</span>
                <span
                  className="text-xs"
                  style={{ color: theme.textMuted }}
                >
                  {formatPrice(item.price_cents_snapshot, order.currency)} ×{" "}
                  {item.quantity}
                </span>
              </div>
              <span
                className="tabular-nums whitespace-nowrap"
                style={{ color: theme.text }}
              >
                {formatPrice(
                  item.price_cents_snapshot * item.quantity,
                  order.currency
                )}
              </span>
            </li>
          ))}
        </ul>

        <div
          className="mt-7 pt-6 border-t flex items-baseline justify-between"
          style={{ borderColor: theme.border }}
        >
          <span
            className="text-[10px] tracking-[0.4em] uppercase"
            style={{ color: theme.textMuted }}
          >
            合計
          </span>
          <span
            className="text-2xl sm:text-3xl tabular-nums"
            style={{
              color: theme.text,
              fontFamily: "var(--store-font)",
              fontWeight: 400,
              letterSpacing: "-0.01em",
            }}
          >
            {formatPrice(order.total_cents, order.currency)}
          </span>
        </div>
      </section>

      <section
        className="rounded-2xl p-7 sm:p-9 mb-6"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
        }}
      >
        <p
          className="text-[10px] tracking-[0.4em] uppercase mb-5"
          style={{ color: theme.accent }}
        >
          Recipient
        </p>
        <dl
          className="text-sm leading-[1.9] space-y-2"
          style={{ color: theme.text }}
        >
          <div className="flex gap-4">
            <dt className="w-20 flex-shrink-0" style={{ color: theme.textMuted }}>
              姓名
            </dt>
            <dd>{order.customer_name}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-20 flex-shrink-0" style={{ color: theme.textMuted }}>
              電話
            </dt>
            <dd>{order.customer_phone}</dd>
          </div>
          {order.customer_email && (
            <div className="flex gap-4">
              <dt
                className="w-20 flex-shrink-0"
                style={{ color: theme.textMuted }}
              >
                Email
              </dt>
              <dd className="min-w-0 truncate">{order.customer_email}</dd>
            </div>
          )}
          {order.shipping_address && (
            <div className="flex gap-4">
              <dt
                className="w-20 flex-shrink-0"
                style={{ color: theme.textMuted }}
              >
                地址
              </dt>
              <dd>{order.shipping_address}</dd>
            </div>
          )}
          {decodedNote.userNote && (
            <div
              className="flex gap-4 pt-3 mt-3 border-t"
              style={{ borderColor: theme.border }}
            >
              <dt
                className="w-20 flex-shrink-0"
                style={{ color: theme.textMuted }}
              >
                備註
              </dt>
              <dd className="italic" style={{ color: theme.textMuted }}>
                {decodedNote.userNote}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {(decodedNote.shippingLabel || paymentLabel) && (
        <section
          className="rounded-2xl p-7 sm:p-9 mb-6"
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
          }}
        >
          <p
            className="text-[10px] tracking-[0.4em] uppercase mb-5"
            style={{ color: theme.accent }}
          >
            Logistics
          </p>
          <dl
            className="text-sm leading-[1.9] space-y-2"
            style={{ color: theme.text }}
          >
            {decodedNote.shippingLabel && (
              <div className="flex gap-4">
                <dt
                  className="w-20 flex-shrink-0"
                  style={{ color: theme.textMuted }}
                >
                  配送方式
                </dt>
                <dd>{decodedNote.shippingLabel}</dd>
              </div>
            )}
            {decodedNote.storeName && (
              <div className="flex gap-4">
                <dt
                  className="w-20 flex-shrink-0"
                  style={{ color: theme.textMuted }}
                >
                  取貨門市
                </dt>
                <dd>{decodedNote.storeName}</dd>
              </div>
            )}
            {paymentLabel && (
              <div className="flex gap-4">
                <dt
                  className="w-20 flex-shrink-0"
                  style={{ color: theme.textMuted }}
                >
                  付款方式
                </dt>
                <dd>{paymentLabel}</dd>
              </div>
            )}
            <div className="flex gap-4">
              <dt
                className="w-20 flex-shrink-0"
                style={{ color: theme.textMuted }}
              >
                付款狀態
              </dt>
              <dd>
                {PAYMENT_STATUS_LABELS[order.payment_status] ??
                  order.payment_status}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section
        className="rounded-2xl p-7 sm:p-9 mb-12"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
        }}
      >
        <p
          className="text-[10px] tracking-[0.4em] uppercase mb-5"
          style={{ color: theme.accent }}
        >
          Timeline
        </p>
        <ul className="text-sm leading-[1.9] space-y-2.5" style={{ color: theme.text }}>
          <li className="flex gap-4">
            <span
              className="w-20 flex-shrink-0"
              style={{ color: theme.textMuted }}
            >
              下單
            </span>
            <span>{formatDateTime(order.created_at)}</span>
          </li>
          {order.paid_at && (
            <li className="flex gap-4">
              <span
                className="w-20 flex-shrink-0"
                style={{ color: theme.textMuted }}
              >
                付款
              </span>
              <span>{formatDateTime(order.paid_at)}</span>
            </li>
          )}
          {order.shipped_at && (
            <li className="flex gap-4">
              <span
                className="w-20 flex-shrink-0"
                style={{ color: theme.textMuted }}
              >
                出貨
              </span>
              <span>{formatDateTime(order.shipped_at)}</span>
            </li>
          )}
        </ul>
      </section>

      {(store.contact_phone || store.contact_email) && (
        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          {store.contact_phone && (
            <a
              href={telHref(store.contact_phone)}
              className="flex-1 text-center rounded-full px-6 py-3.5 text-sm transition hover:opacity-85"
              style={{
                background: theme.text,
                color: theme.bg,
                fontFamily: "var(--store-font)",
                letterSpacing: "0.05em",
              }}
            >
              聯絡店家
            </a>
          )}
          {store.contact_email && (
            <a
              href={mailHref(store.contact_email, { subject: `關於訂單 #${shortId}` })}
              className="flex-1 text-center rounded-full px-6 py-3.5 text-sm transition hover:opacity-80"
              style={{
                border: `1px solid ${theme.border}`,
                background: theme.surface,
                color: theme.text,
                fontFamily: "var(--store-font)",
                letterSpacing: "0.05em",
              }}
            >
              Email 詢問
            </a>
          )}
        </div>
      )}

      {/* 列印專屬頁尾：導覽（店名/Logo）與全站頁尾列印時都被藏起來，這裡把店名＋實際
          聯絡方式補回紙本上，客人手上的收據才看得到要找誰。螢幕上不顯示。
          跟結帳成功頁同一套。 */}
      <div
        className="hidden print:block mt-8 pt-6 border-t text-center"
        style={{ borderColor: theme.border }}
      >
        <p style={{ color: theme.text, fontSize: "0.9375rem", fontWeight: 500 }}>
          {store.name}
        </p>
        {(store.contact_phone || store.contact_email) && (
          <p
            style={{
              color: theme.textMuted,
              fontSize: "0.8125rem",
              marginTop: "0.25rem",
            }}
          >
            {[store.contact_phone, store.contact_email]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <p
          style={{
            color: theme.textMuted,
            fontSize: "0.8125rem",
            marginTop: "0.5rem",
          }}
        >
          感謝您的訂購 · 訂單編號 #{shortId}
        </p>
      </div>
    </main>
  );
}
