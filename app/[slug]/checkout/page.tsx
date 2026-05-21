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

  const total = product.price_cents * quantity;
  const placeBound = placeOrder.bind(null, slug);

  const inputStyle = {
    background: theme.surface,
    color: theme.text,
    border: `1px solid ${theme.border}`,
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <Link
        href={`/${slug}/products/${product.id}`}
        className="text-sm inline-block mb-8 hover:opacity-70 transition"
        style={{ color: theme.textMuted }}
      >
        ← 回商品
      </Link>

      <h1
        className="text-2xl sm:text-3xl font-semibold tracking-tight mb-8"
        style={{ color: theme.text }}
      >
        結帳
      </h1>

      {error && (
        <div
          className="mb-6 rounded-xl border p-4 text-sm"
          style={{
            background: "#FEF2F2",
            borderColor: "#FCA5A5",
            color: "#991B1B",
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        <form action={placeBound} className="space-y-8">
          <input type="hidden" name="product_id" value={product.id} />
          <input type="hidden" name="quantity" value={quantity} />

          {/* 收件資訊 */}
          <section className="space-y-5">
            <h2
              className="text-xs uppercase tracking-widest"
              style={{ color: theme.accent }}
            >
              收件資訊
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text }}
                >
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  name="customer_name"
                  type="text"
                  required
                  placeholder="王小明"
                  className="w-full rounded-xl px-4 py-3 outline-none transition"
                  style={inputStyle}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text }}
                >
                  電話 <span className="text-red-500">*</span>
                </label>
                <input
                  name="customer_phone"
                  type="tel"
                  required
                  placeholder="0912-345-678"
                  className="w-full rounded-xl px-4 py-3 outline-none transition"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: theme.text }}
              >
                Email（選填）
              </label>
              <input
                name="customer_email"
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 outline-none transition"
                style={inputStyle}
              />
            </div>
          </section>

          {/* 配送方式 */}
          <section className="space-y-3">
            <h2
              className="text-xs uppercase tracking-widest"
              style={{ color: theme.accent }}
            >
              配送方式 <span className="text-red-500">*</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    className="rounded-xl p-3 transition peer-checked:font-medium"
                    style={{
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      color: theme.text,
                    }}
                  >
                    <span className="text-sm">{opt.label}</span>
                  </div>
                </label>
              ))}
            </div>

            {/* 超商門市搜尋（用 datalist 提供下拉建議） */}
            <div>
              <label
                className="block text-xs mb-1.5"
                style={{ color: theme.textMuted }}
              >
                超商取貨門市（若選超商取貨必填）
              </label>
              <input
                name="shipping_store_name"
                type="text"
                list="cvs-stores-list"
                placeholder="開始打字搜尋⋯例如「信義」「板橋」「7-11」"
                autoComplete="off"
                className="w-full rounded-xl px-4 py-3 outline-none transition text-sm"
                style={inputStyle}
              />
              <datalist id="cvs-stores-list">
                {CVS_STORES.map((s) => (
                  <option key={`${s.cvs}-${s.code}`} value={formatStoreLabel(s)} />
                ))}
              </datalist>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span style={{ color: theme.textMuted, opacity: 0.7 }}>
                  找不到？打開官方查詢：
                </span>
                <a
                  href={CVS_LOOKUP_URLS["7-11"]}
                  target="_blank"
                  rel="noopener"
                  className="underline hover:opacity-80 transition"
                  style={{ color: theme.accent }}
                >
                  7-11 ↗
                </a>
                <a
                  href={CVS_LOOKUP_URLS["全家"]}
                  target="_blank"
                  rel="noopener"
                  className="underline hover:opacity-80 transition"
                  style={{ color: theme.accent }}
                >
                  全家 ↗
                </a>
                <a
                  href={CVS_LOOKUP_URLS["萊爾富"]}
                  target="_blank"
                  rel="noopener"
                  className="underline hover:opacity-80 transition"
                  style={{ color: theme.accent }}
                >
                  萊爾富 ↗
                </a>
              </div>
              <p
                className="mt-2 text-xs"
                style={{ color: theme.textMuted, opacity: 0.5 }}
              >
                目前提供台北 / 新北 / 桃園熱門門市搜尋。接綠界 API 後會升級成全台 16,000+ 門市的地圖選店
              </p>
            </div>

            <div>
              <label
                className="block text-xs mb-1.5"
                style={{ color: theme.textMuted }}
              >
                收件地址（宅配必填）
              </label>
              <input
                name="shipping_address"
                type="text"
                placeholder="台北市 ..."
                className="w-full rounded-xl px-4 py-3 outline-none transition text-sm"
                style={inputStyle}
              />
            </div>
          </section>

          {/* 付款方式 */}
          <section className="space-y-3">
            <h2
              className="text-xs uppercase tracking-widest"
              style={{ color: theme.accent }}
            >
              付款方式 <span className="text-red-500">*</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    className="rounded-xl p-3 transition peer-checked:font-medium"
                    style={{
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      color: theme.text,
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
          <section>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: theme.text }}
            >
              備註（選填）
            </label>
            <textarea
              name="note"
              rows={3}
              placeholder="特殊需求、希望送達時間..."
              className="w-full rounded-xl px-4 py-3 outline-none transition resize-none"
              style={inputStyle}
            />
          </section>

          <SubmitButton
            pendingText="送出中…"
            className="sproutly-btn sproutly-btn-primary sproutly-btn-lg w-full"
          >
            送出訂單
          </SubmitButton>
          <style>{`
            form button[type="submit"].sproutly-btn-primary {
              /* sproutly-btn-primary 已套 var(--store-text)，保留覆寫成 primary 配色 */
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
            className="rounded-2xl p-6 shadow-sm sticky top-24"
            style={{ background: theme.surface }}
          >
            <h2
              className="text-xs uppercase tracking-widest mb-4"
              style={{ color: theme.accent }}
            >
              訂單摘要
            </h2>
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                {product.image_urls?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_urls[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: theme.bg }}
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
                  style={{ color: theme.text }}
                >
                  {product.name}
                </h3>
                <p
                  className="text-xs mt-1"
                  style={{ color: theme.textMuted }}
                >
                  × {quantity}
                </p>
              </div>
            </div>

            <hr
              className="my-5"
              style={{ borderColor: theme.border }}
            />

            <div className="space-y-2 text-sm">
              <div
                className="flex justify-between"
                style={{ color: theme.textMuted }}
              >
                <span>小計</span>
                <span>{formatPrice(total, product.currency)}</span>
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
              className="my-5"
              style={{ borderColor: theme.border }}
            />

            <div className="flex justify-between items-end">
              <span style={{ color: theme.textMuted }}>合計</span>
              <span
                className="text-2xl font-bold"
                style={{ color: theme.accent }}
              >
                {formatPrice(total, product.currency)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
