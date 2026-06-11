"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCart, clearCart } from "@/lib/cart";
import { PAYMENT_OPTIONS, SHIPPING_OPTIONS } from "@/lib/order-labels";

type Product = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  image_urls: string[] | null;
};

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export default function CartCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [products, setProducts] = useState<Product[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState("");
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const cartRef = useRef(typeof window !== "undefined" ? getCart(slug) : []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ids = cartRef.current.map((c) => c.productId);
      if (ids.length === 0) {
        router.replace(`/${slug}/cart`);
        return;
      }
      const res = await fetch(
        `/${slug}/favorites/api?ids=${encodeURIComponent(ids.join(","))}`,
        { cache: "no-store" }
      );
      const data: Product[] = await res.json();
      if (!cancelled) setProducts(data);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, router]);

  if (products === null) {
    return (
      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
        <div
          className="h-3 w-32 rounded-full mb-10"
          style={{ background: "var(--store-surface, rgba(0,0,0,0.06))" }}
        />
        <div
          className="h-9 w-48 rounded-md mb-6"
          style={{ background: "var(--store-surface, rgba(0,0,0,0.06))" }}
        />
        <div
          className="h-px w-12 mb-6"
          style={{
            background: "var(--store-accent, currentColor)",
            opacity: 0.3,
          }}
        />
        <div
          className="h-4 w-64 rounded-md mb-16"
          style={{ background: "var(--store-surface, rgba(0,0,0,0.04))" }}
        />
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10 md:gap-12">
          <div className="space-y-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div
                  className="h-3 w-36 rounded-full"
                  style={{ background: "var(--store-surface, rgba(0,0,0,0.06))" }}
                />
                <div
                  className="h-12 w-full rounded-xl"
                  style={{ background: "var(--store-surface, rgba(0,0,0,0.04))" }}
                />
                <div
                  className="h-12 w-full rounded-xl"
                  style={{ background: "var(--store-surface, rgba(0,0,0,0.04))" }}
                />
              </div>
            ))}
          </div>
          <div
            className="h-72 rounded-2xl"
            style={{ background: "var(--store-surface, rgba(0,0,0,0.04))" }}
          />
        </div>
      </main>
    );
  }

  const itemRows = products.map((p) => ({
    product: p,
    qty: cartRef.current.find((c) => c.productId === p.id)?.qty ?? 0,
  }));
  const total = itemRows.reduce(
    (s, r) => s + r.product.price_cents * r.qty,
    0
  );
  const itemCount = itemRows.reduce((s, r) => s + r.qty, 0);

  const selectedShipping =
    SHIPPING_OPTIONS.find((o) => o.value === shippingMethod) ?? null;
  const needsStore = selectedShipping?.needsStore ?? false;
  const needsAddress = shippingMethod === "home_delivery";
  const isPickup = shippingMethod === "pickup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set(
      "cart_items",
      JSON.stringify(
        itemRows.map((r) => ({ productId: r.product.id, qty: r.qty }))
      )
    );

    try {
      const res = await fetch(`/${slug}/cart/checkout/submit`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "送出失敗");
        setSubmitting(false);
        return;
      }
      clearCart(slug);
      router.push(`/${slug}/checkout/success/${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出失敗");
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <Link
        href={`/${slug}/cart`}
        className="sproutly-link inline-block mb-12"
        style={{
          color: "var(--store-text-muted, rgba(0,0,0,0.6))",
          fontSize: "0.6875rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
        }}
      >
        ← Back · 回購物車
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
          {itemCount} 件商品 · 填妥資料 · 完成最後一步
        </p>
      </header>

      {error && (
        <div
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

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10 md:gap-12">
        <form onSubmit={onSubmit} className="space-y-12">
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
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--store-text, #1a1a1a)" }}
                >
                  姓名{" "}
                  <span style={{ color: "var(--store-accent, currentColor)" }}>
                    *
                  </span>
                </label>
                <input
                  name="customer_name"
                  type="text"
                  required
                  placeholder="王小明"
                  className="sproutly-input w-full"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: "var(--store-text, #1a1a1a)" }}
                >
                  電話{" "}
                  <span style={{ color: "var(--store-accent, currentColor)" }}>
                    *
                  </span>
                </label>
                <input
                  name="customer_phone"
                  type="tel"
                  required
                  placeholder="0912-345-678"
                  className="sproutly-input w-full"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--store-text, #1a1a1a)" }}
              >
                Email（選填）
              </label>
              <input
                name="customer_email"
                type="email"
                placeholder="you@example.com"
                className="sproutly-input w-full"
              />
            </div>
          </section>

          {/* 配送方式 */}
          <section className="space-y-4">
            <div>
              <p
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SHIPPING_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="cursor-pointer block has-[:checked]:ring-2 rounded-xl transition"
                  style={{
                    ["--tw-ring-color" as string]:
                      "var(--store-accent, currentColor)",
                  }}
                >
                  <input
                    type="radio"
                    name="shipping_method"
                    value={o.value}
                    required
                    checked={shippingMethod === o.value}
                    onChange={() => setShippingMethod(o.value)}
                    className="peer sr-only"
                  />
                  <div
                    className="rounded-xl p-3.5 transition peer-checked:font-medium"
                    style={{
                      background: "var(--store-surface, rgba(0,0,0,0.03))",
                      border:
                        "1px solid var(--store-border, rgba(0,0,0,0.12))",
                      color: "var(--store-text, #1a1a1a)",
                    }}
                  >
                    <span className="text-sm">{o.label}</span>
                  </div>
                </label>
              ))}
            </div>

            {needsStore && (
              <div className="pt-2">
                <label
                  className="block text-xs mb-1.5"
                  style={{ color: "var(--store-text-muted, rgba(0,0,0,0.6))" }}
                >
                  超商門市名稱{" "}
                  <span style={{ color: "var(--store-accent, currentColor)" }}>
                    *
                  </span>
                </label>
                <input
                  name="shipping_store_name"
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="例：7-11 信義門市"
                  className="sproutly-input w-full text-sm"
                />
              </div>
            )}

            {needsAddress && (
              <div className="pt-2">
                <label
                  className="block text-xs mb-1.5"
                  style={{ color: "var(--store-text-muted, rgba(0,0,0,0.6))" }}
                >
                  收件地址{" "}
                  <span style={{ color: "var(--store-accent, currentColor)" }}>
                    *
                  </span>
                </label>
                <input
                  name="shipping_address"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="台北市 ..."
                  className="sproutly-input w-full text-sm"
                />
              </div>
            )}

            {isPickup && (
              <p
                className="pt-2 text-xs"
                style={{
                  color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                  lineHeight: 1.6,
                }}
              >
                到店面取貨，不需填地址，店家會在備好後通知你。
              </p>
            )}
          </section>

          {/* 付款方式 */}
          <section className="space-y-4">
            <div>
              <p
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PAYMENT_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`block rounded-xl transition ${
                    o.disabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer has-[:checked]:ring-2"
                  }`}
                  style={{
                    ["--tw-ring-color" as string]:
                      "var(--store-accent, currentColor)",
                  }}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={o.value}
                    required
                    disabled={o.disabled}
                    className="peer sr-only"
                  />
                  <div
                    className="rounded-xl p-3.5 transition peer-checked:font-medium"
                    style={{
                      background: "var(--store-surface, rgba(0,0,0,0.03))",
                      border:
                        "1px solid var(--store-border, rgba(0,0,0,0.12))",
                      color: "var(--store-text, #1a1a1a)",
                    }}
                  >
                    <span className="text-sm">{o.label}</span>
                  </div>
                </label>
              ))}
            </div>

            <p
              className="text-xs"
              style={{
                color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                opacity: 0.6,
              }}
            >
              金流串接還沒完成，送出訂單後店家會聯絡你確認付款方式
            </p>
          </section>

          {/* 備註 */}
          <section className="space-y-3">
            <label
              className="block text-sm font-medium"
              style={{ color: "var(--store-text, #1a1a1a)" }}
            >
              備註（選填）
            </label>
            <textarea
              name="note"
              rows={3}
              placeholder="特殊需求、希望送達時間..."
              className="sproutly-input w-full resize-none"
            />
          </section>

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="sproutly-btn sproutly-btn-primary sproutly-btn-lg w-full"
              aria-disabled={submitting}
            >
              {submitting ? "送出中…" : "送出訂單"}
            </button>
          </div>
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

            <div className="space-y-4">
              {itemRows.map((r) => (
                <div key={r.product.id} className="flex gap-3">
                  <div
                    className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
                    style={{
                      background: "var(--store-bg, #ffffff)",
                      border: "1px solid var(--store-border, rgba(0,0,0,0.08))",
                    }}
                  >
                    {r.product.image_urls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.product.image_urls[0]}
                        alt={r.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span
                          className="text-[10px] tracking-wider"
                          style={{
                            color:
                              "var(--store-text-muted, rgba(0,0,0,0.4))",
                            opacity: 0.5,
                          }}
                        >
                          —
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-medium text-sm line-clamp-2"
                      style={{
                        color: "var(--store-text, #1a1a1a)",
                        lineHeight: 1.5,
                      }}
                    >
                      {r.product.name}
                    </h3>
                    <div className="flex items-center justify-between mt-1.5">
                      <p
                        className="text-xs tabular-nums"
                        style={{
                          color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                        }}
                      >
                        × {r.qty}
                      </p>
                      <p
                        className="text-xs tabular-nums"
                        style={{
                          color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                        }}
                      >
                        {formatPrice(
                          r.product.price_cents * r.qty,
                          r.product.currency
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <hr
              className="my-6"
              style={{
                borderColor: "var(--store-border, rgba(0,0,0,0.12))",
              }}
            />

            <div className="space-y-2.5 text-sm">
              <div
                className="flex justify-between tabular-nums"
                style={{ color: "var(--store-text-muted, rgba(0,0,0,0.6))" }}
              >
                <span>小計</span>
                <span>{formatPrice(total, "TWD")}</span>
              </div>
              <div
                className="flex justify-between"
                style={{ color: "var(--store-text-muted, rgba(0,0,0,0.6))" }}
              >
                <span>運費</span>
                <span className="text-xs opacity-60">由店家確認</span>
              </div>
            </div>

            <hr
              className="my-6"
              style={{
                borderColor: "var(--store-border, rgba(0,0,0,0.12))",
              }}
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
                  color: "var(--store-accent, currentColor)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {formatPrice(total, "TWD")}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
