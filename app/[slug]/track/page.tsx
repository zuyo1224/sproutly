import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTheme } from "../_theme";
import {
  paymentMethodLabel,
  paymentNextStepMessage,
  isUnpaidOrder,
  PAYMENT_STATUS_LABELS,
  decodeShippingFromNote,
  orderStatusMessage,
  shortOrderId,
  CUSTOMER_STATUS_FLOW,
  CUSTOMER_STATUS_LABELS,
} from "@/lib/order-labels";
import { telHref, mailHref } from "@/lib/contact-href";
import { RememberOrder } from "@/app/_components/remember-order";
import { RecentOrdersList } from "@/app/_components/recent-orders-list";
import { PrintButton } from "@/app/_components/print-button";
import { CopyOrderId } from "@/app/_components/copy-order-id";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ id?: string; phone?: string }>;

// 訂單查詢頁帶個人資訊，不讓搜尋引擎收錄
export const metadata: Metadata = {
  title: "查訂單",
  description: "輸入訂單編號與電話，查詢出貨進度。",
  robots: { index: false, follow: false },
};

import { formatPrice } from "@/lib/format-price";
import { taipeiStampMonthDay } from "@/lib/format-date";

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
    .select("id, name, slug, theme, contact_phone, contact_email")
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

  // 給客人看的訂單短碼是 UUID 第一段、固定 8 碼（success 頁、會員訂單、信裡都是這 8 碼）。
  // 比對用 startsWith，所以若不設下限，帶 ?id=a&phone= 進來就會用「電話 + 1 碼」撈到
  // 開頭剛好是 a 的最近一筆訂單，把雙因子查詢弱化成電話幾乎就能查到別人的姓名/地址/品項。
  // 低於 8 碼一律不查，當作查無訂單處理。
  const SHORT_ID_MIN = 8;

  if (shortId && phone) {
    searched = true;
    if (shortId.length >= SHORT_ID_MIN) {
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
  }

  const headerCaption = order
    ? `${store.name} · 訂單 #${shortOrderId(order.id)}`
    : searched
      ? `${store.name} · 沒找到符合的訂單`
      : `${store.name} · 輸入編號 + 電話即可查詢`;

  return (
    <main className="max-w-2xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <div className="mb-12 sm:mb-14 print:hidden">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{ color: theme.accent, letterSpacing: "0.4em" }}
        >
          Order Tracking · 訂單追蹤
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            color: theme.text,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          查當前狀態
        </h1>
        <div
          className="mt-5 h-px w-12"
          style={{ background: theme.accent, opacity: 0.5 }}
        />
        <p
          className="mt-5 text-[0.9375rem]"
          style={{ color: theme.textMuted, lineHeight: 1.7 }}
        >
          {headerCaption}
        </p>
      </div>

      <form
        method="GET"
        className="rounded-2xl p-7 sm:p-8 mb-10 space-y-5 print:hidden"
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
            Order ID · 訂單編號
          </label>
          <input
            id="track-id"
            name="id"
            type="text"
            required
            defaultValue={rawId}
            placeholder="例如 #A1B2C3D4"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="sproutly-input font-mono"
          />
        </div>
        <div>
          <label
            htmlFor="track-phone"
            className="block text-[0.6875rem] uppercase mb-2.5 font-medium"
            style={{ color: theme.textMuted, letterSpacing: "0.3em" }}
          >
            Phone · 聯絡電話
          </label>
          <input
            id="track-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
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

      {/* 還沒查到訂單時，給「這台裝置下過的單」捷徑：
          下單或查過的訂單記在客人自己的裝置上（localStorage），
          點一筆就帶入編號＋電話查詢，不用記也不用重打。 */}
      {!order && <RecentOrdersList slug={slug} />}

      {/* 查無訂單的版面對齊客人端其餘空／邊界狀態（cart／favorites／shop／orders／contact
          都是這套左對齊編輯風），不再是另一張置中卡片。上面的查詢表單卡與「這台裝置下過的單」
          捷徑都還在，這裡只是把「沒找到」的回饋文字換成同一套視覺語言。 */}
      {searched && !order && (
        <div className="py-16 max-w-md">
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{ color: theme.accent, letterSpacing: "0.4em" }}
          >
            Not Found
          </p>
          <div
            className="mt-5 h-px w-10"
            style={{ background: theme.accent, opacity: 0.4 }}
          />
          <p
            className="mt-6 text-2xl sm:text-3xl font-medium"
            style={{
              color: theme.text,
              fontFamily: "var(--store-font)",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            找不到
            <br />
            對應的訂單
          </p>
          <p
            className="mt-5 text-[0.9375rem]"
            style={{ color: theme.textMuted, lineHeight: 1.7 }}
          >
            請確認訂單編號跟電話都正確。還是查不到的話，直接問店家最快。
          </p>
          <Link
            href={`/${slug}/contact`}
            className="sproutly-link mt-10 inline-block text-[0.75rem] uppercase font-medium"
            style={{ color: theme.accent, letterSpacing: "0.3em" }}
          >
            聯絡店家 →
          </Link>
        </div>
      )}

      {order && (
        <div className="space-y-6">
          {/* 查到一次就記進這台裝置的小抄——在別台裝置下的單，
              只要在這裡查過一次，之後也能一鍵帶入。 */}
          <RememberOrder
            slug={slug}
            shortId={shortOrderId(order.id)}
            phone={order.customer_phone}
            totalCents={order.total_cents}
            currency={order.currency}
            createdAt={order.created_at}
          />

          {/* 列印 / 存 PDF 收據：轉帳要對帳、報帳或想留紙本底的客人用得到——
              成功頁、會員訂單詳情都印得了，匿名查單這頭原本沒有。列印時自己藏起來，
              導覽/頁尾靠 layout 的 @media print 收乾淨。 */}
          <div className="print:hidden">
            <PrintButton className="sproutly-btn sproutly-btn-secondary sproutly-btn-sm">
              列印收據 · 存 PDF
            </PrintButton>
          </div>

          {/* 列印專屬抬頭：螢幕上的頁首是「查當前狀態」搜尋標題，列印時被藏起來，
              這裡補上店名當紙本收據的抬頭。螢幕不顯示。 */}
          <div className="hidden print:block">
            <p style={{ color: theme.text, fontSize: "1.125rem", fontWeight: 500 }}>
              {store.name}
            </p>
            <p
              style={{
                color: theme.textMuted,
                fontSize: "0.8125rem",
                marginTop: "0.25rem",
              }}
            >
              訂單收據 · #{shortOrderId(order.id)}
            </p>
          </div>

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
                  Cancelled · 已取消
                </p>
                <div
                  className="my-4 h-px w-10 mx-auto"
                  style={{ background: theme.border }}
                />
                <p
                  className="text-xl font-medium"
                  style={{ color: theme.text, letterSpacing: "-0.005em" }}
                >
                  訂單已取消
                </p>
                {(store.contact_phone || store.contact_email) && (
                  <p
                    className="mt-3 text-[0.9375rem]"
                    style={{ color: theme.textMuted, lineHeight: 1.7 }}
                  >
                    如有疑問，可從下方聯絡店家
                  </p>
                )}
              </div>
            ) : (
              <>
                <p
                  className="text-[0.6875rem] uppercase mb-6 font-medium"
                  style={{ color: theme.accent, letterSpacing: "0.4em" }}
                >
                  Status · 進度
                </p>
                {/* 進度做成有序清單給報讀器：原本圈圈裡的數字、圈跟圈之間的連接線
                    都是純視覺，報讀器只念得到「1 待店家確認 2 已確認…」這串數字＋
                    步驟名，聽不出「走到第幾步」。把數字圈與連接線退出報讀器（aria-hidden），
                    每一步的名稱後補一句 sr-only 狀態（已完成／目前進度／尚未進行），
                    目前所在的那步再標 aria-current="step"，讓報讀器使用者也聽得出進度。 */}
                {(() => {
                  const currentIdx = CUSTOMER_STATUS_FLOW.indexOf(order.status);
                  return (
                    <ol
                      className="flex justify-between items-start mb-6"
                      aria-label="訂單進度"
                    >
                      {CUSTOMER_STATUS_FLOW.map((stepKey, i) => {
                        const done = i <= currentIdx;
                        const current = i === currentIdx;
                        const stateText = current
                          ? "目前進度"
                          : done
                            ? "已完成"
                            : "尚未進行";
                        return (
                          <li
                            key={stepKey}
                            className="flex flex-col items-center flex-1 min-w-0 relative"
                            aria-current={current ? "step" : undefined}
                          >
                            {i < CUSTOMER_STATUS_FLOW.length - 1 && (
                              <div
                                aria-hidden="true"
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
                              aria-hidden="true"
                              className="relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition"
                              style={{
                                background: done ? theme.primary : theme.bg,
                                color: done ? theme.surface : theme.textMuted,
                                border: `2px solid ${done ? theme.primary : theme.border}`,
                                transform: current ? "scale(1.15)" : "scale(1)",
                              }}
                            >
                              {i + 1}
                            </div>
                            <p
                              className="mt-2 text-xs text-center px-1"
                              style={{
                                color: done ? theme.text : theme.textMuted,
                                fontWeight: current ? 600 : 400,
                              }}
                            >
                              {CUSTOMER_STATUS_LABELS[stepKey]}
                              <span className="sr-only">（{stateText}）</span>
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  );
                })()}
                <p
                  className="text-center text-[0.9375rem]"
                  style={{ color: theme.textMuted, lineHeight: 1.7 }}
                >
                  {(() => {
                    const d = decodeShippingFromNote(order.note);
                    return orderStatusMessage(
                      order.status,
                      d.shippingLabel,
                      d.storeName
                    );
                  })()}
                </p>
              </>
            )}

            {/* 每一步是哪天發生的——進度條只給「走到第幾步」，這裡補上確切時間，
                客人才知道「我是 6/10 下單、6/12 出貨」而不用自己回想。
                已取消的單也照列：會員訂單詳情的 Timeline 區塊不分取消與否都看得到
                下單／付款時間，客人查一筆取消單想確認「哪天下的、款付過沒」在這頁
                原本完全沒時間可看，得跳去別頁翻。 */}
            {(() => {
              const stamps: { label: string; iso: string }[] = [
                { label: "下單時間", iso: order.created_at },
              ];
              if (order.paid_at)
                stamps.push({ label: "付款時間", iso: order.paid_at });
              if (order.shipped_at)
                stamps.push({ label: "出貨時間", iso: order.shipped_at });
              return (
                <dl
                  className="mt-6 pt-6 flex flex-col gap-2 text-[0.9375rem]"
                  style={{ borderTop: `1px solid ${theme.border}` }}
                >
                  {stamps.map((s) => (
                    <div
                      key={s.label}
                      className="flex justify-between gap-3"
                    >
                      <dt style={{ color: theme.textMuted }}>{s.label}</dt>
                      <dd
                        style={{
                          color: theme.text,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {taipeiStampMonthDay(s.iso)}
                      </dd>
                    </div>
                  ))}
                </dl>
              );
            })()}
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
                Order ID · 訂單編號
              </p>
              <span className="text-[0.9375rem]">
                <CopyOrderId shortId={shortOrderId(order.id)} />
              </span>
            </div>

            <hr style={{ borderColor: theme.border }} />

            <div>
              <p
                className="text-[0.6875rem] uppercase mb-4 font-medium"
                style={{ color: theme.accent, letterSpacing: "0.4em" }}
              >
                Items · 商品
              </p>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div
                    key={i}
                    className="flex justify-between gap-4 items-baseline text-[0.9375rem]"
                    style={{ color: theme.text }}
                  >
                    <div className="min-w-0">
                      <span className="block truncate">{it.name_snapshot}</span>
                      <span className="text-xs" style={{ color: theme.textMuted }}>
                        {formatPrice(it.price_cents_snapshot, order.currency)} ×{" "}
                        {it.quantity}
                      </span>
                    </div>
                    <span
                      className="whitespace-nowrap"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
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
                Total · 合計
              </span>
              <span
                className="text-3xl sm:text-4xl font-medium"
                style={{
                  color: theme.accent,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatPrice(order.total_cents, order.currency)}
              </span>
            </div>

            <hr style={{ borderColor: theme.border }} />

            {/* 收件資訊：客人查單常是要核對「地址／電話有沒有填錯」，結帳成功頁跟
                會員訂單詳情都看得到這段，匿名查單這頭原本沒有——查到單只看得到商品
                跟金額，想確認收件地址還得去翻信或問店家。能進到這裡已經過編號＋
                電話雙因子驗證，給的欄位跟那兩頁同一套。 */}
            {(() => {
              const decoded = decodeShippingFromNote(order.note);
              return (
                <div>
                  <p
                    className="text-[0.6875rem] uppercase mb-4 font-medium"
                    style={{ color: theme.accent, letterSpacing: "0.4em" }}
                  >
                    Recipient · 收件資訊
                  </p>
                  <dl className="text-[0.9375rem] space-y-2">
                    <div className="flex gap-3">
                      <dt
                        className="w-20 shrink-0"
                        style={{ color: theme.textMuted }}
                      >
                        姓名
                      </dt>
                      <dd style={{ color: theme.text }}>
                        {order.customer_name}
                      </dd>
                    </div>
                    <div className="flex gap-3">
                      <dt
                        className="w-20 shrink-0"
                        style={{ color: theme.textMuted }}
                      >
                        電話
                      </dt>
                      <dd style={{ color: theme.text }}>
                        {order.customer_phone}
                      </dd>
                    </div>
                    {order.customer_email && (
                      <div className="flex gap-3">
                        <dt
                          className="w-20 shrink-0"
                          style={{ color: theme.textMuted }}
                        >
                          Email
                        </dt>
                        <dd
                          className="min-w-0 truncate"
                          style={{ color: theme.text }}
                        >
                          {order.customer_email}
                        </dd>
                      </div>
                    )}
                    {order.shipping_address && (
                      <div className="flex gap-3">
                        <dt
                          className="w-20 shrink-0"
                          style={{ color: theme.textMuted }}
                        >
                          地址
                        </dt>
                        <dd style={{ color: theme.text }}>
                          {order.shipping_address}
                        </dd>
                      </div>
                    )}
                    {decoded.userNote && (
                      <div
                        className="flex gap-3 pt-3 mt-3 border-t"
                        style={{ borderColor: theme.border }}
                      >
                        <dt
                          className="w-20 shrink-0"
                          style={{ color: theme.textMuted }}
                        >
                          備註
                        </dt>
                        <dd className="italic" style={{ color: theme.textMuted }}>
                          {decoded.userNote}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              );
            })()}

            {(() => {
              const decoded = decodeShippingFromNote(order.note);
              const paymentLabel = paymentMethodLabel(order.payment_method);
              const paymentStatusLabel =
                PAYMENT_STATUS_LABELS[order.payment_status] ??
                order.payment_status;
              if (!decoded.shippingLabel && !paymentLabel && !paymentStatusLabel)
                return null;
              return (
                <>
                  <hr style={{ borderColor: theme.border }} />
                  <div>
                    <p
                      className="text-[0.6875rem] uppercase mb-4 font-medium"
                      style={{ color: theme.accent, letterSpacing: "0.4em" }}
                    >
                      Logistics · 物流付款
                    </p>
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
                      {/* 轉帳、貨到付款的客人最想知道店家收到錢沒——進度條只講出貨，
                          這裡補上付款狀態，已退款的取消單也看得到錢退了。跟會員訂單詳情同一套。 */}
                      <div className="flex gap-3">
                        <dt
                          className="w-20 shrink-0"
                          style={{ color: theme.textMuted }}
                        >
                          付款狀態
                        </dt>
                        <dd style={{ color: theme.text }}>
                          {paymentStatusLabel}
                        </dd>
                      </div>
                    </dl>
                    {/* 還沒付款的單，光一個「未付款」客人不知道下一步在誰身上——
                        要不要先匯、帳號哪來、還是到貨再付。結帳成功頁已依已選方式
                        講對的話（paymentNextStepMessage），查單這頁常是事後回來看的
                        入口反而漏了。同一支 helper，已付款／已退款或已取消的單不催。 */}
                    {isUnpaidOrder(order.payment_status) &&
                      order.status !== "cancelled" &&
                      (() => {
                        const next = paymentNextStepMessage(
                          order.payment_method
                        );
                        if (!next) return null;
                        return (
                          <p
                            className="mt-4 text-[0.8125rem]"
                            style={{ color: theme.textMuted, lineHeight: 1.7 }}
                          >
                            {next}
                          </p>
                        );
                      })()}
                  </div>
                </>
              );
            })()}
          </section>

          {/* 查到單之後若還有問題，這裡直接給聯絡店家的去處，不用再跳去聯絡頁。
              Email 主旨先帶上訂單編號，店家一看就知道是哪一筆——跟會員訂單詳情同一套。 */}
          {(store.contact_phone || store.contact_email) && (
            <div className="flex flex-col sm:flex-row gap-3 print:hidden">
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
                  href={mailHref(store.contact_email, {
                    subject: `關於訂單 #${shortOrderId(order.id)}`,
                  })}
                  className="sproutly-btn sproutly-btn-secondary flex-1"
                >
                  Email 詢問
                </a>
              )}
            </div>
          )}

          {/* 列印專屬頁尾：導覽（店名/Logo）列印時被藏起來，這裡把店名＋實際聯絡方式
              補回紙本上，客人手上的收據才看得到要找誰。螢幕上不顯示。跟成功頁同一套。 */}
          <div
            className="hidden print:block mt-8 pt-6 border-t text-center"
            style={{ borderColor: theme.border }}
          >
            <p
              style={{ color: theme.text, fontSize: "0.9375rem", fontWeight: 500 }}
            >
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
              感謝您的訂購 · 訂單編號 #
              {shortOrderId(order.id)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-14 text-center print:hidden">
        <Link
          href={`/${slug}`}
          className="sproutly-link text-[0.6875rem] uppercase font-medium transition"
          style={{ color: theme.textMuted, letterSpacing: "0.3em" }}
        >
          ← Back · {store.name}
        </Link>
      </div>
    </main>
  );
}
