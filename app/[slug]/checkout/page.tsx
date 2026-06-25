import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../_theme";
import { placeOrder } from "./actions";
import { SubmitButton } from "@/app/_components/submit-button";
import { PAYMENT_OPTIONS, SHIPPING_OPTIONS } from "@/lib/order-labels";
import { CVS_STORES, formatStoreLabel, CVS_LOOKUP_URLS } from "@/lib/cvs-stores";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{
  product_id?: string;
  qty?: string;
  error?: string;
}>;

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const productId = sp.product_id ?? "";
  const quantity = Math.min(Math.max(Number(sp.qty ?? 1), 1), 99) || 1;
  const error = sp.error;

  if (!productId) notFound();

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  const { data: product } = await supabase
    .from("sproutly_products")
    .select("*")
    .eq("id", productId)
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!product) notFound();

  // 把顯示數量夾到實際庫存。商品詳情頁的數量選單雖已限在庫存內，但庫存可能
  // 在客人從商品頁載入到結帳之間被別人買走，或客人帶著舊的分享／書籤網址
  // （?qty=...）直接進來——沒夾的話結帳頁會照樣顯示一個結不掉的數量與總價，
  // 整張表單填完按送出才被伺服器退回「庫存只剩 N 件」，等於白填一遍。
  const stock: number | null = product.stock;
  const soldOut = stock !== null && stock <= 0;
  const effectiveQty =
    stock !== null ? Math.min(quantity, Math.max(stock, 0)) : quantity;
  const wasClamped = !soldOut && effectiveQty < quantity;
  const total = product.price_cents * effectiveQty;
  const placeBound = placeOrder.bind(null, slug);

  return (
    <main className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <Link
        href={`/${slug}/products/${product.id}`}
        className="sproutly-link inline-block mb-12"
        style={{
          color: "var(--store-text-muted, rgba(0,0,0,0.6))",
          fontSize: "0.6875rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
        }}
      >
        ← Back · 回到商品
      </Link>

      <header className="mb-16 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{
            color: "var(--store-accent, currentColor)",
            letterSpacing: "0.4em",
          }}
        >
          Checkout
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          結帳
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
          style={{
            color: "var(--store-text-muted, rgba(0,0,0,0.6))",
            lineHeight: 1.7,
          }}
        >
          填妥資料 · 完成最後一步
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-10 rounded-2xl p-5"
          style={{
            background: "rgba(220, 38, 38, 0.04)",
            border: "1px solid rgba(220, 38, 38, 0.2)",
            color: "#991B1B",
          }}
        >
          <p
            className="text-[0.6875rem] uppercase font-medium mb-2"
            style={{ letterSpacing: "0.4em", opacity: 0.8 }}
          >
            Notice
          </p>
          <p className="text-sm" style={{ lineHeight: 1.6 }}>
            {error}
          </p>
        </div>
      )}

      {soldOut && (
        <div
          role="alert"
          className="mb-10 rounded-2xl p-5"
          style={{
            background: "rgba(220, 38, 38, 0.04)",
            border: "1px solid rgba(220, 38, 38, 0.2)",
            color: "#991B1B",
          }}
        >
          <p
            className="text-[0.6875rem] uppercase font-medium mb-2"
            style={{ letterSpacing: "0.4em", opacity: 0.8 }}
          >
            Sold Out · 已售完
          </p>
          <p className="text-sm" style={{ lineHeight: 1.6 }}>
            這株目前沒有庫存了，沒辦法下單。可以回去看看店裡其他的。
          </p>
          <Link
            href={`/${slug}/shop`}
            className="sproutly-link inline-block mt-3 text-sm"
            style={{ color: theme.accent }}
          >
            看其他商品 →
          </Link>
        </div>
      )}

      {wasClamped && (
        <div
          role="status"
          aria-live="polite"
          className="mb-10 rounded-2xl p-5"
          style={{
            background: "rgba(217, 119, 6, 0.06)",
            border: "1px solid rgba(217, 119, 6, 0.25)",
            color: "#92400E",
          }}
        >
          <p
            className="text-[0.6875rem] uppercase font-medium mb-2"
            style={{ letterSpacing: "0.4em", opacity: 0.8 }}
          >
            Notice · 庫存提醒
          </p>
          <p className="text-sm" style={{ lineHeight: 1.6 }}>
            這株目前只剩 {stock} 件，數量已自動調整成 {effectiveQty} 件。
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10 md:gap-12">
        <form action={placeBound} className="space-y-12">
          <input type="hidden" name="product_id" value={product.id} />
          <input type="hidden" name="quantity" value={effectiveQty} />

          {/* 收件資訊 */}
          <section className="space-y-5">
            <div>
              <p
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                Recipient · 收件資訊
              </p>
              <div
                className="mt-3 h-px w-10"
                style={{
                  background: "var(--store-accent, currentColor)",
                  opacity: 0.5,
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="co-name"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text }}
                >
                  姓名 <span style={{ color: theme.accent }}>*</span>
                </label>
                <input
                  id="co-name"
                  name="customer_name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="王小明"
                  className="sproutly-input w-full"
                />
              </div>
              <div>
                <label
                  htmlFor="co-phone"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text }}
                >
                  電話 <span style={{ color: theme.accent }}>*</span>
                </label>
                <input
                  id="co-phone"
                  name="customer_phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="0912-345-678"
                  className="sproutly-input w-full"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="co-email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: theme.text }}
              >
                Email（選填）
              </label>
              <input
                id="co-email"
                name="customer_email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                className="sproutly-input w-full"
              />
            </div>
          </section>

          {/* 配送方式 */}
          <section className="space-y-4">
            <div>
              <p
                id="co-shipping-label"
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                Shipping · 配送方式 <span>*</span>
              </p>
              <div
                className="mt-3 h-px w-10"
                style={{
                  background: "var(--store-accent, currentColor)",
                  opacity: 0.5,
                }}
              />
            </div>

            <div
              role="radiogroup"
              aria-labelledby="co-shipping-label"
              aria-required="true"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {SHIPPING_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="cursor-pointer block has-[:checked]:ring-2 rounded-xl transition"
                  style={{ ["--tw-ring-color" as string]: theme.primary }}
                >
                  <input
                    type="radio"
                    name="shipping_method"
                    value={opt.value}
                    className="peer sr-only"
                    required
                  />
                  <div
                    className="rounded-xl p-3.5 transition peer-checked:font-medium"
                    style={{
                      background: "var(--store-surface, rgba(0,0,0,0.03))",
                      border: "1px solid var(--store-border, rgba(0,0,0,0.12))",
                      color: "var(--store-text, #1a1a1a)",
                    }}
                  >
                    <span className="text-sm">{opt.label}</span>
                  </div>
                </label>
              ))}
            </div>

            {/* 超商門市搜尋 */}
            <div className="pt-2">
              <label
                htmlFor="co-store"
                className="block text-xs mb-1.5"
                style={{ color: theme.textMuted }}
              >
                超商取貨門市（若選超商取貨必填）
              </label>
              <input
                id="co-store"
                name="shipping_store_name"
                type="text"
                list="cvs-stores-list"
                placeholder="開始打字搜尋⋯例如「信義」「板橋」「7-11」"
                autoComplete="off"
                aria-describedby="co-store-help"
                className="sproutly-input w-full text-sm"
              />
              <datalist id="cvs-stores-list">
                {CVS_STORES.map((s) => (
                  <option key={`${s.cvs}-${s.code}`} value={formatStoreLabel(s)} />
                ))}
              </datalist>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span style={{ color: theme.textMuted, opacity: 0.7 }}>
                  找不到？打開官方查詢：
                </span>
                <a
                  href={CVS_LOOKUP_URLS["7-11"]}
                  target="_blank"
                  rel="noopener"
                  className="sproutly-link"
                  style={{ color: theme.accent }}
                >
                  7-11 ↗
                </a>
                <a
                  href={CVS_LOOKUP_URLS["全家"]}
                  target="_blank"
                  rel="noopener"
                  className="sproutly-link"
                  style={{ color: theme.accent }}
                >
                  全家 ↗
                </a>
                <a
                  href={CVS_LOOKUP_URLS["萊爾富"]}
                  target="_blank"
                  rel="noopener"
                  className="sproutly-link"
                  style={{ color: theme.accent }}
                >
                  萊爾富 ↗
                </a>
              </div>
              <p
                id="co-store-help"
                className="mt-2 text-xs"
                style={{ color: theme.textMuted, opacity: 0.5 }}
              >
                目前提供台北 / 新北 / 桃園熱門門市搜尋。接綠界 API 後會升級成全台 16,000+ 門市的地圖選店
              </p>
            </div>

            <div className="pt-2">
              <label
                htmlFor="co-address"
                className="block text-xs mb-1.5"
                style={{ color: theme.textMuted }}
              >
                收件地址（宅配必填）
              </label>
              <input
                id="co-address"
                name="shipping_address"
                type="text"
                autoComplete="street-address"
                placeholder="台北市 ..."
                className="sproutly-input w-full text-sm"
              />
            </div>
          </section>

          {/* 付款方式 */}
          <section className="space-y-4">
            <div>
              <p
                id="co-payment-label"
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                Payment · 付款方式 <span>*</span>
              </p>
              <div
                className="mt-3 h-px w-10"
                style={{
                  background: "var(--store-accent, currentColor)",
                  opacity: 0.5,
                }}
              />
            </div>

            <div
              role="radiogroup"
              aria-labelledby="co-payment-label"
              aria-required="true"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {PAYMENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`block rounded-xl transition ${opt.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer has-[:checked]:ring-2"}`}
                  style={{ ["--tw-ring-color" as string]: theme.primary }}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={opt.value}
                    className="peer sr-only"
                    required
                    disabled={opt.disabled}
                  />
                  <div
                    className="rounded-xl p-3.5 transition peer-checked:font-medium"
                    style={{
                      background: "var(--store-surface, rgba(0,0,0,0.03))",
                      border: "1px solid var(--store-border, rgba(0,0,0,0.12))",
                      color: "var(--store-text, #1a1a1a)",
                    }}
                  >
                    <span className="text-sm">{opt.label}</span>
                  </div>
                </label>
              ))}
            </div>

            <p
              className="text-xs"
              style={{ color: theme.textMuted, opacity: 0.6 }}
            >
              金流串接還沒完成，送出訂單後店家會聯絡你確認付款方式
            </p>
          </section>

          {/* 備註 */}
          <section className="space-y-3">
            <label
              htmlFor="co-note"
              className="block text-sm font-medium"
              style={{ color: theme.text }}
            >
              備註（選填）
            </label>
            <textarea
              id="co-note"
              name="note"
              rows={3}
              placeholder="特殊需求、希望送達時間..."
              className="sproutly-input w-full resize-none"
            />
          </section>

          <div className="pt-4">
            {soldOut ? (
              <Link
                href={`/${slug}/shop`}
                className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg w-full"
              >
                看其他商品
              </Link>
            ) : (
              <SubmitButton
                pendingText="送出中…"
                className="sproutly-btn sproutly-btn-primary sproutly-btn-lg w-full"
              >
                送出訂單
              </SubmitButton>
            )}
          </div>
          <style>{`
            form button[type="submit"].sproutly-btn-primary {
              background: ${theme.primary};
              color: ${theme.surface};
            }
            form button[type="submit"]:hover:not(:disabled) {
              opacity: 0.9;
            }
          `}</style>
        </form>

        {/* 訂單摘要（右側 sticky）*/}
        <aside>
          <div
            className="rounded-2xl p-7 sticky top-24"
            style={{
              background: "var(--store-surface, rgba(0,0,0,0.03))",
              border: "1px solid var(--store-border, rgba(0,0,0,0.12))",
              boxShadow: "var(--sproutly-elev-2)",
            }}
          >
            <div className="mb-6">
              <p
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                Summary · 訂單摘要
              </p>
              <div
                className="mt-3 h-px w-10"
                style={{
                  background: "var(--store-accent, currentColor)",
                  opacity: 0.5,
                }}
              />
            </div>

            <div className="flex gap-4">
              <div
                className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"
                style={{
                  background: "var(--store-bg, #ffffff)",
                  border: "1px solid var(--store-border, rgba(0,0,0,0.08))",
                }}
              >
                {product.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_urls[0]}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                  >
                    <span
                      className="text-[10px] tracking-wider"
                      style={{ color: theme.textMuted, opacity: 0.4 }}
                    >
                      —
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-medium text-sm line-clamp-2"
                  style={{ color: theme.text, lineHeight: 1.5 }}
                >
                  {product.name}
                </h3>
                <p
                  className="text-xs mt-2 tabular-nums"
                  style={{ color: theme.textMuted }}
                >
                  {soldOut ? "已售完" : `× ${effectiveQty}`}
                </p>
              </div>
            </div>

            <hr
              className="my-6"
              style={{ borderColor: "var(--store-border, rgba(0,0,0,0.12))" }}
            />

            <div className="space-y-2.5 text-sm">
              <div
                className="flex justify-between tabular-nums"
                style={{ color: theme.textMuted }}
              >
                <span>小計</span>
                <span>{soldOut ? "—" : formatPrice(total, product.currency)}</span>
              </div>
              <div
                className="flex justify-between"
                style={{ color: theme.textMuted }}
              >
                <span>運費</span>
                <span className="text-xs opacity-60">由店家確認</span>
              </div>
            </div>

            <hr
              className="my-6"
              style={{ borderColor: "var(--store-border, rgba(0,0,0,0.12))" }}
            />

            <div className="flex justify-between items-end">
              <span
                className="text-[0.6875rem] uppercase font-medium"
                style={{
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "0.4em",
                }}
              >
                Total
              </span>
              <span
                className="text-3xl sm:text-4xl font-medium tabular-nums"
                style={{
                  color: theme.accent,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {soldOut ? "—" : formatPrice(total, product.currency)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
