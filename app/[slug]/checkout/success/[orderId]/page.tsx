import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTheme } from "../../../_theme";
import { PAYMENT_LABELS, decodeShippingFromNote, shortOrderId } from "@/lib/order-labels";
import { telHref, mailHref } from "@/lib/contact-href";
import { Confetti } from "@/app/_components/confetti";
import { CopyOrderId } from "@/app/_components/copy-order-id";
import { RememberOrder } from "@/app/_components/remember-order";
import { PrintButton } from "@/app/_components/print-button";

type Params = Promise<{ slug: string; orderId: string }>;

// 蓋掉父層 checkout/layout 的「結帳」，成立後分頁顯示「訂單成立」。
export const metadata: Metadata = { title: "訂單成立" };

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

  const shortId = shortOrderId(order.id);
  const decodedNote = decodeShippingFromNote(order.note);
  const paymentLabel = order.payment_method
    ? (PAYMENT_LABELS[order.payment_method] ?? order.payment_method)
    : null;

  const orderItems = items ?? [];

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <div className="print:hidden">
        <Confetti count={70} />
      </div>
      {/* 把這筆訂單記進這台裝置的小抄：成功頁是訪客唯一一次看到編號的地方，
          沒抄下來之後想查單就斷了。記下來後查訂單頁可以一鍵帶入。 */}
      <RememberOrder
        slug={slug}
        shortId={shortId}
        phone={order.customer_phone}
        totalCents={order.total_cents}
        currency={order.currency}
        createdAt={order.created_at}
      />

      <div className="text-center mb-14 sm:mb-20">
        <p
          className="font-medium uppercase mb-5"
          style={{
            color: theme.accent,
            fontSize: "0.6875rem",
            letterSpacing: "0.4em",
          }}
        >
          Order Received · #{shortId}
        </p>
        <div
          className="h-px w-12 mx-auto mb-7"
          style={{ background: theme.accent, opacity: 0.5 }}
        />
        <h1
          className="font-medium tracking-tight mb-5"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            fontSize: "clamp(1.875rem, 4vw, 2.25rem)",
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          訂單已送出
        </h1>
        <p
          className="mx-auto"
          style={{
            color: theme.textMuted,
            fontSize: "0.9375rem",
            lineHeight: 1.7,
            maxWidth: "32rem",
          }}
        >
          {store.name} 已收到你的訂單，{formatDateTime(order.created_at)} 送出，會盡快聯絡你確認付款方式
        </p>
        {/* 列印 / 存 PDF 收據：報帳或想要紙本留底的客人用得到。列印時自己藏起來，
            版面靠 layout 的 @media print 把導覽/頁尾收乾淨。 */}
        <div className="mt-7 print:hidden">
          <PrintButton className="sproutly-btn sproutly-btn-secondary sproutly-btn-sm">
            列印收據 · 存 PDF
          </PrintButton>
        </div>
      </div>

      <section
        className="rounded-2xl p-7 sm:p-8 mb-6"
        style={{
          background: "var(--store-surface)",
          border: "1px solid var(--store-border)",
          boxShadow: "var(--sproutly-elev-2)",
        }}
      >
        <div className="flex items-baseline gap-3 mb-6">
          <p
            className="font-medium uppercase"
            style={{
              color: theme.accent,
              fontSize: "0.6875rem",
              letterSpacing: "0.4em",
            }}
          >
            Items · 商品
          </p>
          <div
            className="h-px flex-1"
            style={{ background: theme.border, opacity: 0.6 }}
          />
        </div>
        <ul
          className="space-y-3"
          style={{
            color: theme.text,
            fontSize: "0.9375rem",
            lineHeight: 1.85,
          }}
        >
          {orderItems.map((it) => (
            <li
              key={it.id}
              className="flex justify-between gap-4 items-baseline"
            >
              <div className="min-w-0">
                <span className="block truncate">{it.name_snapshot}</span>
                <span
                  className="text-xs"
                  style={{ color: theme.textMuted }}
                >
                  {formatPrice(it.price_cents_snapshot, order.currency)} ×{" "}
                  {it.quantity}
                </span>
              </div>
              <span className="tabular-nums whitespace-nowrap">
                {formatPrice(
                  it.price_cents_snapshot * it.quantity,
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
            className="font-medium uppercase"
            style={{
              color: theme.textMuted,
              fontSize: "0.6875rem",
              letterSpacing: "0.4em",
            }}
          >
            Total · 合計
          </span>
          <span
            className="tabular-nums"
            style={{
              color: theme.accent,
              fontFamily: "var(--store-font)",
              fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {formatPrice(order.total_cents, order.currency)}
          </span>
        </div>
      </section>

      <section
        className="rounded-2xl p-7 sm:p-8 mb-6"
        style={{
          background: "var(--store-surface)",
          border: "1px solid var(--store-border)",
          boxShadow: "var(--sproutly-elev-2)",
        }}
      >
        <div className="flex items-baseline gap-3 mb-6">
          <p
            className="font-medium uppercase"
            style={{
              color: theme.accent,
              fontSize: "0.6875rem",
              letterSpacing: "0.4em",
            }}
          >
            Recipient · 收件資訊
          </p>
          <div
            className="h-px flex-1"
            style={{ background: theme.border, opacity: 0.6 }}
          />
        </div>
        <dl
          className="space-y-2"
          style={{
            color: theme.text,
            fontSize: "0.9375rem",
            lineHeight: 1.9,
          }}
        >
          <div className="flex gap-4">
            <dt
              className="w-20 flex-shrink-0"
              style={{ color: theme.textMuted }}
            >
              姓名
            </dt>
            <dd>{order.customer_name}</dd>
          </div>
          <div className="flex gap-4">
            <dt
              className="w-20 flex-shrink-0"
              style={{ color: theme.textMuted }}
            >
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
          className="rounded-2xl p-7 sm:p-8 mb-12"
          style={{
            background: "var(--store-surface)",
            border: "1px solid var(--store-border)",
            boxShadow: "var(--sproutly-elev-2)",
          }}
        >
          <div className="flex items-baseline gap-3 mb-6">
            <p
              className="font-medium uppercase"
              style={{
                color: theme.accent,
                fontSize: "0.6875rem",
                letterSpacing: "0.4em",
              }}
            >
              Logistics · 配送與付款
            </p>
            <div
              className="h-px flex-1"
              style={{ background: theme.border, opacity: 0.6 }}
            />
          </div>
          <dl
            className="space-y-2"
            style={{
              color: theme.text,
              fontSize: "0.9375rem",
              lineHeight: 1.9,
            }}
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
          </dl>
        </section>
      )}

      {/* 剛下單最容易發現「地址填錯了」「想先問付款」，這裡直接給聯絡店家的去處，
          不用再跳去聯絡頁找電話。Email 主旨先帶上訂單編號，店家一看就知道是哪一筆——
          跟查訂單頁、會員訂單詳情同一套。 */}
      {(store.contact_phone || store.contact_email) && (
        <section
          className="rounded-2xl p-7 sm:p-8 mb-6 print:hidden"
          style={{
            background: "var(--store-surface)",
            border: "1px solid var(--store-border)",
            boxShadow: "var(--sproutly-elev-2)",
          }}
        >
          <p
            className="font-medium uppercase mb-2"
            style={{
              color: theme.accent,
              fontSize: "0.6875rem",
              letterSpacing: "0.4em",
            }}
          >
            Need Help · 有問題
          </p>
          <p
            className="mb-5"
            style={{
              color: theme.textMuted,
              fontSize: "0.875rem",
              lineHeight: 1.7,
            }}
          >
            訂單資料填錯、想先問付款，都可以直接找店家
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {store.contact_phone && (
              <a
                href={telHref(store.contact_phone)}
                className="sproutly-btn sproutly-btn-primary flex-1"
              >
                聯絡店家
              </a>
            )}
            {store.contact_email && (
              <a
                href={mailHref(store.contact_email, { subject: `關於訂單 #${shortId}` })}
                className="sproutly-btn sproutly-btn-secondary flex-1"
              >
                Email 詢問
              </a>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10 print:hidden">
        <Link
          href={`/${slug}/shop`}
          className="sproutly-btn sproutly-btn-primary sproutly-btn-lg"
        >
          繼續逛
        </Link>
        <Link
          href={`/${slug}`}
          className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg"
        >
          回首頁
        </Link>
      </div>

      <p
        className="text-center print:hidden"
        style={{
          color: theme.textMuted,
          fontSize: "0.8125rem",
          lineHeight: 1.85,
          opacity: 0.85,
        }}
      >
        請記下訂單編號{" "}
        <CopyOrderId shortId={shortId} />
        ，跟店家確認付款、或之後{" "}
        <Link
          href={`/${slug}/track?id=${shortId}&phone=${encodeURIComponent(
            order.customer_phone
          )}`}
          className="sproutly-link"
          style={{ color: theme.accent }}
        >
          追蹤訂單
        </Link>{" "}
        時都會用到
      </p>

      {/* 列印專屬頁尾：導覽（店名/Logo）列印時被藏起來，這裡把店名＋實際聯絡方式
          補回紙本上，客人手上的收據才看得到要找誰。螢幕上不顯示。 */}
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
