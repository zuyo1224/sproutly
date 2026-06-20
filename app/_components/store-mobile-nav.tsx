"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 手機版店面導覽 — 把「首頁 / 商品 / 關於 / 聯絡」這幾條文字連結收進漢堡選單。
 *
 * 為什麼要這個：原本 header 在小螢幕把店名 + 4 條文字連結 + 4 個圖示擠在同一列
 * （overflow-x-auto），手機上會橫向溢出、要左右撥才看得到全部，店名也被擠到截斷。
 * 桌機維持原本一字排開（這個元件 sm:hidden），手機改成點漢堡才展開，把空間讓給店名與購物車圖示。
 *
 * 行為：點外面、按 Esc、換頁都會自動收起，避免展開狀態卡住。
 */
export function StoreMobileNav({
  slug,
  items,
  colorMuted,
  colorActive,
  surface,
  border,
  className,
}: {
  slug: string;
  items: { href: string; label: string }[];
  colorMuted: string;
  colorActive: string;
  surface: string;
  border: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const homeHref = `/${slug}`;

  // 換頁就收起（點了選單裡的連結之後不該還開著）
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 展開時：點外面 / 按 Esc 收起
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        // 鍵盤族若已 Tab 進選單某條連結，按 Esc 收合後那條連結被移除，
        // 焦點會掉回頁面最上面得重新一路 Tab。把焦點還回漢堡按鈕，停在原處。
        // （點外面是滑鼠操作，不在此路徑、不搶焦點。）
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center px-2 py-2 transition hover:opacity-70"
        style={{ color: colorMuted }}
        aria-label={open ? "關閉選單" : "開啟選單"}
        aria-expanded={open}
        aria-controls="store-mobile-menu"
      >
        {open ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        )}
      </button>

      {open && (
        <div
          id="store-mobile-menu"
          className="absolute right-0 top-full mt-2 min-w-[10rem] rounded-2xl border py-2 z-30"
          style={{
            backgroundColor: surface,
            borderColor: border,
            boxShadow: "var(--sproutly-elev-3)",
          }}
        >
          {items.map((item) => {
            const active =
              item.href === homeHref
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="block px-5 py-3 text-sm transition whitespace-nowrap"
                style={{
                  color: active ? colorActive : colorMuted,
                  fontWeight: active ? 500 : 400,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
