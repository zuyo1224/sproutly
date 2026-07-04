"use client";

import { useState } from "react";
import { SHIPPING_OPTIONS, shippingNeedsStore } from "@/lib/order-labels";
import { CVS_STORES, formatStoreLabel, CVS_LOOKUP_URLS } from "@/lib/cvs-stores";

// 單品結帳的配送欄位。原本門市／地址兩欄無條件常駐且不 required：選宅配漏填地址
// 要等 server 退回才知道；且門市欄打過字再改選宅配，字還留在欄位裡會被一起送出、
// 寫進宅配單的 note。抽成 client 元件照購物車結帳同款——選到才顯示、顯示就 required、
// 切走就卸載（不再進 FormData），自取則給「不需填地址」的提示。
export function ShippingFields({ ringColor }: { ringColor: string }) {
  const [shippingMethod, setShippingMethod] = useState("");
  const needsStore = shippingNeedsStore(shippingMethod);
  const needsAddress = shippingMethod === "home_delivery";
  const isPickup = shippingMethod === "pickup";

  return (
    <>
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
            style={{ ["--tw-ring-color" as string]: ringColor }}
          >
            <input
              type="radio"
              name="shipping_method"
              value={opt.value}
              className="peer sr-only"
              required
              checked={shippingMethod === opt.value}
              onChange={() => setShippingMethod(opt.value)}
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

      {needsStore && (
        <div className="pt-2">
          <label
            htmlFor="co-store"
            className="block text-xs mb-1.5"
            style={{ color: "var(--store-text-muted, rgba(0,0,0,0.6))" }}
          >
            超商門市名稱{" "}
            <span style={{ color: "var(--store-accent, currentColor)" }}>
              *
            </span>
          </label>
          <input
            id="co-store"
            name="shipping_store_name"
            type="text"
            required
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
            <span
              style={{
                color: "var(--store-text-muted, rgba(0,0,0,0.6))",
                opacity: 0.7,
              }}
            >
              找不到？打開官方查詢：
            </span>
            {(["7-11", "全家", "萊爾富"] as const).map((cvs) => (
              <a
                key={cvs}
                href={CVS_LOOKUP_URLS[cvs]}
                target="_blank"
                rel="noopener"
                className="sproutly-link"
                style={{ color: "var(--store-accent, currentColor)" }}
              >
                {cvs} ↗
              </a>
            ))}
          </div>
          <p
            id="co-store-help"
            className="mt-2 text-xs"
            style={{
              color: "var(--store-text-muted, rgba(0,0,0,0.6))",
              opacity: 0.5,
            }}
          >
            目前提供台北 / 新北 / 桃園熱門門市搜尋。接綠界 API 後會升級成全台 16,000+ 門市的地圖選店
          </p>
        </div>
      )}

      {needsAddress && (
        <div className="pt-2">
          <label
            htmlFor="co-address"
            className="block text-xs mb-1.5"
            style={{ color: "var(--store-text-muted, rgba(0,0,0,0.6))" }}
          >
            收件地址{" "}
            <span style={{ color: "var(--store-accent, currentColor)" }}>
              *
            </span>
          </label>
          <input
            id="co-address"
            name="shipping_address"
            type="text"
            required
            autoComplete="street-address"
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
    </>
  );
}
