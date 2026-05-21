"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
      <main className="max-w-3xl mx-auto px-8 py-32">
        <p className="opacity-60 text-sm">載入中...</p>
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
    <main className="max-w-5xl mx-auto px-6 py-12">
      <h1
        className="text-2xl sm:text-3xl tracking-tight mb-8"
        style={{ fontFamily: "var(--store-font)", fontWeight: 400 }}
      >
        結帳
      </h1>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        <form onSubmit={onSubmit} className="space-y-8">
          <section className="space-y-5">
            <h2 className="text-xs uppercase tracking-widest opacity-60">
              收件資訊
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <input name="customer_name" required placeholder="姓名 *" className="rounded-xl px-4 py-3 outline-none border border-stone-300" />
              <input name="customer_phone" required placeholder="電話 *" className="rounded-xl px-4 py-3 outline-none border border-stone-300" />
            </div>
            <input name="customer_email" type="email" placeholder="Email（選填）" className="w-full rounded-xl px-4 py-3 outline-none border border-stone-300" />
          </section>

          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest opacity-60">
              配送方式 *
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {SHIPPING_OPTIONS.map((o) => (
                <label key={o.value} className="cursor-pointer block has-[:checked]:ring-2 has-[:checked]:ring-stone-900 rounded-xl">
                  <input type="radio" name="shipping_method" value={o.value} required className="peer sr-only" />
                  <div className="rounded-xl border border-stone-300 p-3 text-sm peer-checked:font-medium">{o.label}</div>
                </label>
              ))}
            </div>
            <input name="shipping_store_name" placeholder="超商門市名稱（超商取貨必填）" className="w-full rounded-xl px-4 py-3 outline-none border border-stone-300 text-base" />
            <input name="shipping_address" placeholder="收件地址（宅配必填）" className="w-full rounded-xl px-4 py-3 outline-none border border-stone-300 text-base" />
          </section>

          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest opacity-60">
              付款方式 *
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_OPTIONS.map((o) => (
                <label key={o.value} className={`block rounded-xl ${o.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-stone-900"}`}>
                  <input type="radio" name="payment_method" value={o.value} required disabled={o.disabled} className="peer sr-only" />
                  <div className="rounded-xl border border-stone-300 p-3 text-sm peer-checked:font-medium">{o.label}</div>
                </label>
              ))}
            </div>
          </section>

          <textarea name="note" rows={3} placeholder="備註（選填）" className="w-full rounded-xl px-4 py-3 outline-none border border-stone-300 resize-none" />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full px-8 py-4 text-sm tracking-wider transition disabled:opacity-50"
            style={{ background: "var(--store-primary)", color: "var(--store-surface)" }}
          >
            {submitting ? "送出中..." : "送出訂單"}
          </button>
        </form>

        <aside>
          <div className="rounded-2xl p-6 sticky top-24 bg-white shadow-sm">
            <h2 className="text-xs uppercase tracking-widest opacity-60 mb-4">
              訂單摘要
            </h2>
            <div className="space-y-3 text-sm">
              {itemRows.map((r) => (
                <div key={r.product.id} className="flex justify-between gap-3">
                  <span className="line-clamp-1">
                    {r.product.name} × {r.qty}
                  </span>
                  <span className="flex-shrink-0">
                    {formatPrice(r.product.price_cents * r.qty, r.product.currency)}
                  </span>
                </div>
              ))}
            </div>
            <hr className="my-5 border-stone-200" />
            <div className="flex justify-between items-end">
              <span className="opacity-70">合計</span>
              <span
                className="text-2xl"
                style={{ fontFamily: "var(--store-font)" }}
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
