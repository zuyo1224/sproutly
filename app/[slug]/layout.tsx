import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Cormorant_Garamond,
  Playfair_Display,
  Inter,
  Noto_Sans_TC,
  Noto_Serif_TC,
  Lora,
} from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { telHref } from "@/lib/contact-href";
import { resolveTheme, themeToCssVars, HOMEPAGE_DEFAULTS } from "./_theme";
import { FavoritesCounter } from "@/app/_components/favorite-button";
import { CartIcon } from "@/app/_components/cart-icon";
import { SearchOverlay } from "@/app/_components/search-overlay";
import { EditorClickBridge } from "@/app/_components/editor-click-bridge";
import { StoreNavLink } from "@/app/_components/store-nav-link";
import { StoreMobileNav } from "@/app/_components/store-mobile-nav";
import { BackToTop } from "@/app/_components/back-to-top";

const RESERVED = new Set([
  "api",
  "auth",
  "dashboard",
  "login",
  "signup",
  "logout",
  "favicon.ico",
]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (RESERVED.has(slug)) return {};

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("name, description, theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) return {};

  const theme = resolveTheme(store.theme);
  // 商家描述先 trim 再決定要不要用：`??` 只擋 null／undefined，商家若只打了
  // 空白（或前後黏了換行），會讓 meta description 與 OG／Twitter 描述變成一串
  // 空白，搜尋結果與分享卡片的摘要就整段空掉。trim 後沒字才退回平台預設描述。
  const trimmedDescription = store.description?.trim();
  const description =
    trimmedDescription || `${store.name} · 在 Sproutly 上的線上店面`;
  const ogImage = theme.heroUrl || theme.logoUrl || null;
  const iconUrl = theme.logoUrl;

  return {
    title: {
      default: store.name,
      template: `%s · ${store.name}`,
    },
    description,
    // 各店自己的 web manifest：加到主畫面顯示店名＋店家 logo，不再是平台「Sproutly」
    manifest: `/${slug}/site.webmanifest`,
    icons: iconUrl
      ? {
          icon: iconUrl,
          shortcut: iconUrl,
          apple: iconUrl,
        }
      : undefined,
    openGraph: {
      title: store.name,
      description,
      siteName: store.name,
      type: "website",
      images: ogImage
        ? [
            {
              url: ogImage,
              alt: store.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: store.name,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Viewport> {
  const { slug } = await params;
  if (RESERVED.has(slug)) return {};

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) return {};

  const theme = resolveTheme(store.theme);
  return {
    themeColor: theme.bg,
    colorScheme: "light",
  };
}

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"],
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "700"],
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
const noto = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-noto",
  weight: ["400", "500", "700"],
});
const notoSerif = Noto_Serif_TC({
  subsets: ["latin"],
  variable: "--font-noto-serif",
  weight: ["400", "500", "600", "700"],
});
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "500", "700"],
});

type Params = Promise<{ slug: string }>;

export default async function PublicStoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { slug } = await params;
  if (RESERVED.has(slug)) notFound();

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select(
      "name, slug, theme, is_published, contact_phone, address, business_hours"
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);
  const cssVars = themeToCssVars(theme);

  // 客人最常重複問的就是地址 / 電話 / 營業時間，本來只埋在聯絡頁。
  // 這幾欄商家後台早就有（聯絡頁、查訂單頁都在用），這裡直接撈來放進
  // 全站頁尾，讓客人不論逛到哪一頁、捲到底都看得到，不用再特地點進聯絡頁。
  // 顯示與否沿用聯絡頁同一組 section 開關（商家關掉 contact / hours 區段
  // 就不該從頁尾外洩），只放有填的欄位。
  const businessHoursText =
    typeof store.business_hours === "object" && store.business_hours !== null
      ? ((store.business_hours as { text?: string }).text ?? "").trim()
      : "";
  const footerAddress =
    theme.sections.contact && store.address ? store.address : "";
  const footerPhone =
    theme.sections.contact && store.contact_phone ? store.contact_phone : "";
  const footerHours = theme.sections.hours ? businessHoursText : "";
  const showStoreInfo = !!(footerAddress || footerPhone || footerHours);

  // 客人是否登入（決定 nav 上「會員」連結指向哪）
  const { data: userData } = await supabase.auth.getUser();
  const isLoggedIn = !!userData.user;
  const accountHref = isLoggedIn ? `/${slug}/account` : `/${slug}/account/login`;

  const navItems = [
    { href: `/${slug}`, label: "首頁", always: true },
    { href: `/${slug}/shop`, label: "商品", always: true },
    {
      href: `/${slug}/about`,
      label: "關於",
      always: false,
      show: theme.sections.about,
    },
    {
      href: `/${slug}/contact`,
      label: "聯絡",
      always: false,
      show: theme.sections.contact || theme.sections.hours,
    },
  ].filter((item) => item.always || item.show);

  const showSocial =
    theme.sections.social &&
    (theme.social.instagram || theme.social.facebook || theme.social.line);

  return (
    <div
      className={`${cormorant.variable} ${playfair.variable} ${inter.variable} ${noto.variable} ${notoSerif.variable} ${lora.variable} min-h-screen flex flex-col`}
      style={{
        ...cssVars,
        background: theme.bg,
        color: theme.text,
        // 中文用思源宋體當底，西文配 user 選的 store font；數字 / 標籤 也走 store font
        fontFamily: "var(--store-font), var(--font-noto-serif), serif",
        lineHeight: 1.8,
        letterSpacing: "0.01em",
      }}
    >
      <style>{`
        /* Skip link：鍵盤 focus 才出現，跳過 nav 到主要內容 */
        .sproutly-skip {
          position: fixed;
          top: -100%;
          left: 1rem;
          z-index: 100;
          padding: 0.625rem 1rem;
          background: var(--store-text, #1a1a1a);
          color: var(--store-bg, #ffffff);
          font-size: 0.8125rem;
          letter-spacing: 0.06em;
          border-radius: 9999px;
          text-decoration: none;
          box-shadow: var(--sproutly-elev-2);
          transition: top 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sproutly-skip:focus-visible {
          top: 1rem;
          outline: 2px solid var(--store-accent, currentColor);
          outline-offset: 2px;
        }

        /* 列印 / 存 PDF：藏掉導覽、頁尾、捲動進度與互動按鈕陰影，
           只留乾淨內容（給結帳成功頁印收據留底用，其他頁面列印也順便乾淨） */
        @media print {
          html, body { background: #fff !important; }
          .sproutly-skip,
          .sproutly-scroll-progress,
          header.sproutly-nav-shrink,
          footer { display: none !important; }
          .sproutly-btn { box-shadow: none !important; }
        }

        /* 全站 focus-visible：鍵盤 tab 才出現，滑鼠點不出現（不擾視覺） */
        a:focus-visible,
        button:focus-visible,
        [tabindex]:focus-visible {
          outline: 2px solid var(--store-accent, currentColor);
          outline-offset: 3px;
          border-radius: 4px;
        }
        /* .sproutly-btn 已有 padding/rounded，focus offset 略加大避免吃進 button 內 */
        .sproutly-btn:focus-visible {
          outline: 2px solid var(--store-accent, currentColor);
          outline-offset: 4px;
        }
        /* input / textarea / select 自己已有 :focus border + ring，這裡 :focus-visible 額外加 outline 給鍵盤 */
        .sproutly-input:focus-visible {
          outline: 2px solid var(--store-accent, currentColor);
          outline-offset: 2px;
        }

        /* FAQ accordion 的 <summary> 自己畫了一枚 + 號當開關指示，
           要把瀏覽器預設的揭露三角形收掉。Tailwind 的 list-none 只關了
           list-style，Safari／iOS 另外用 ::-webkit-details-marker 畫三角形，
           沒一起關掉的話 iPhone 上三角形會跟自訂的 + 疊在一起。 */
        summary { list-style: none; }
        summary::-webkit-details-marker { display: none; }

        /* 全站平滑滾動 */
        html { scroll-behavior: smooth; }

        /* 跨頁過場：fade in/out（Chrome 126+ / Safari 18+ 支援，其他 graceful degrade） */
        @view-transition { navigation: auto; }
        ::view-transition-old(root) {
          animation: sproutly-vt-fade-out 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        ::view-transition-new(root) {
          animation: sproutly-vt-fade-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes sproutly-vt-fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes sproutly-vt-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* 頂部滾動進度條：CSS-only scroll-timeline */
        .sproutly-scroll-progress {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: currentColor;
          transform-origin: left;
          transform: scaleX(0);
          z-index: 50;
          pointer-events: none;
          opacity: 0.7;
          animation: sproutly-scroll-grow linear;
          animation-timeline: scroll(root);
        }
        @keyframes sproutly-scroll-grow {
          to { transform: scaleX(1); }
        }

        /* Hero 圖視差：完全停用（scroll-timeline 在某些 viewport 會引起 transform 偏移留白）*/
        .sproutly-hero-parallax {
          animation: none !important;
          transform: none !important;
        }

        /* 頂部 header scroll 時縮高 + 加深 blur */
        .sproutly-nav-shrink {
          animation: sproutly-nav-shrink linear;
          animation-timeline: scroll(root);
          animation-range: 0 200px;
        }
        @keyframes sproutly-nav-shrink {
          to {
            backdrop-filter: blur(20px) saturate(140%);
            -webkit-backdrop-filter: blur(20px) saturate(140%);
            box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 8px 24px -8px rgba(0,0,0,0.06);
          }
        }
        .sproutly-nav-shrink > div {
          animation: sproutly-nav-shrink-inner linear;
          animation-timeline: scroll(root);
          animation-range: 0 200px;
        }
        @keyframes sproutly-nav-shrink-inner {
          to {
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
        }

        /* 商品 grid stagger 入場：進視窗時一個個出現 */
        .sproutly-stagger > * {
          animation: sproutly-stagger-fade 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-timeline: view();
          animation-range: entry 0% entry 35%;
        }
        .sproutly-stagger > *:nth-child(2) { animation-delay: 0.06s; }
        .sproutly-stagger > *:nth-child(3) { animation-delay: 0.12s; }
        .sproutly-stagger > *:nth-child(4) { animation-delay: 0.18s; }
        .sproutly-stagger > *:nth-child(5) { animation-delay: 0.24s; }
        .sproutly-stagger > *:nth-child(6) { animation-delay: 0.30s; }
        @keyframes sproutly-stagger-fade {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }


        /* CTA 底線：從中間往外繪製，回收從中間收回 */
        .sproutly-link {
          position: relative;
          display: inline-block;
          padding-bottom: 4px;
          border: 0 !important;
        }
        .sproutly-link::after {
          content: "";
          position: absolute;
          left: 50%;
          right: 50%;
          bottom: 0;
          height: 1px;
          background: currentColor;
          transition: left 0.55s cubic-bezier(0.22, 1, 0.36, 1),
                      right 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sproutly-link:hover::after,
        .sproutly-link:focus-visible::after {
          left: 0;
          right: 0;
        }
        .sproutly-link[data-default-line="true"]::after {
          left: 0;
          right: 0;
          opacity: 0.45;
        }
        .sproutly-link[data-default-line="true"]:hover::after {
          opacity: 1;
        }

        /* Layered elevation tokens — 已提升到 globals.css :root，全站共用 */

        /* 商品 card：layered shadow + hover lift + 圖 zoom + 暗化 + 文字字距開 */
        .sproutly-card { display: block; }
        .sproutly-card .sproutly-card-image {
          overflow: hidden;
          position: relative;
          border-radius: 4px;
          box-shadow: var(--sproutly-elev-2);
          transition: box-shadow 0.7s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sproutly-card:hover .sproutly-card-image {
          box-shadow: var(--sproutly-elev-4);
          transform: translateY(-6px);
        }
        .sproutly-card .sproutly-card-image img {
          transition: transform 2.4s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sproutly-card:hover .sproutly-card-image img {
          transform: scale(1.05);
        }
        /* image inner 漸層暗化 + hover 推進 */
        .sproutly-card .sproutly-card-image::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0) 60%,
            rgba(0, 0, 0, 0.08) 100%
          );
          pointer-events: none;
          z-index: 1;
          opacity: 0.7;
        }
        .sproutly-card .sproutly-card-image::after {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0);
          transition: background 0.6s cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
          z-index: 2;
        }
        .sproutly-card:hover .sproutly-card-image::after {
          background: rgba(0, 0, 0, 0.06);
        }
        .sproutly-card .sproutly-card-title {
          transition: letter-spacing 0.6s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sproutly-card:hover .sproutly-card-title {
          letter-spacing: 0.06em;
        }
        .sproutly-card .sproutly-card-meta {
          opacity: 0.7;
          transform: translateY(0);
          transition: opacity 0.6s, transform 0.6s;
        }
        .sproutly-card:hover .sproutly-card-meta {
          opacity: 1;
        }
        .sproutly-card .sproutly-card-action {
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s,
                      transform 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s;
          margin-top: 12px;
        }
        .sproutly-card:hover .sproutly-card-action,
        .sproutly-card:focus-within .sproutly-card-action {
          opacity: 1;
          transform: translateY(0);
        }

        /* Button system - 3 variants 對應 Wix / Squarespace 級的 button 質感 */
        .sproutly-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 1.75rem;
          border-radius: 9999px;
          font-size: 0.8125rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          font-family: var(--store-font), inherit;
          font-weight: 500;
          line-height: 1;
          cursor: pointer;
          text-decoration: none;
          transition: box-shadow 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                      background-color 0.4s ease,
                      color 0.4s ease,
                      opacity 0.4s ease,
                      border-color 0.4s ease;
          -webkit-appearance: none;
          appearance: none;
          border: 1px solid transparent;
        }
        .sproutly-btn-sm {
          padding: 0.625rem 1.25rem;
          font-size: 0.75rem;
        }
        .sproutly-btn-lg {
          padding: 1.125rem 2.25rem;
          font-size: 0.875rem;
        }
        .sproutly-btn-primary {
          background: var(--store-text, #1a1a1a);
          color: var(--store-bg, #ffffff);
          box-shadow: var(--sproutly-elev-1);
        }
        .sproutly-btn-primary:hover {
          box-shadow: var(--sproutly-elev-3);
          transform: translateY(-2px);
          opacity: 0.92;
        }
        .sproutly-btn-primary:active {
          transform: translateY(0);
          box-shadow: var(--sproutly-elev-1);
        }
        .sproutly-btn-secondary {
          background: transparent;
          color: var(--store-text, #1a1a1a);
          border-color: var(--store-border, rgba(0,0,0,0.12));
        }
        .sproutly-btn-secondary:hover {
          background: var(--store-surface, rgba(0,0,0,0.03));
          border-color: var(--store-text, rgba(0,0,0,0.4));
          transform: translateY(-1px);
        }
        .sproutly-btn-ghost {
          background: transparent;
          color: var(--store-text-muted, rgba(0,0,0,0.6));
          padding: 0.625rem 1rem;
          letter-spacing: 0.14em;
        }
        .sproutly-btn-ghost:hover {
          color: var(--store-text, #1a1a1a);
          background: var(--store-surface, rgba(0,0,0,0.04));
        }
        .sproutly-btn:disabled,
        .sproutly-btn[aria-disabled="true"] {
          opacity: 0.4;
          cursor: not-allowed;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .sproutly-btn { transition: none !important; }
          .sproutly-btn:hover { transform: none !important; }
        }

        /* Form input system - 跟 button 對齊質感 */
        .sproutly-input {
          width: 100%;
          padding: 0.875rem 1.25rem;
          border-radius: 9999px;
          background: var(--store-surface, #fafaf9);
          color: var(--store-text, #1a1a1a);
          border: 1px solid var(--store-border, rgba(0,0,0,0.12));
          font-size: 0.9375rem;
          line-height: 1.4;
          outline: none;
          transition: border-color 0.3s ease,
                      box-shadow 0.3s ease,
                      background-color 0.3s ease;
          font-family: inherit;
          -webkit-appearance: none;
          appearance: none;
        }
        .sproutly-input::placeholder {
          color: var(--store-text-muted, rgba(0,0,0,0.4));
          opacity: 0.7;
        }
        .sproutly-input:hover {
          border-color: var(--store-text-muted, rgba(0,0,0,0.3));
        }
        .sproutly-input:focus {
          border-color: var(--store-text, #1a1a1a);
          box-shadow: 0 0 0 4px var(--store-accent-ring, rgba(0,0,0,0.06)),
                      var(--sproutly-elev-1);
          background: var(--store-bg, #ffffff);
        }
        .sproutly-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        textarea.sproutly-input {
          border-radius: 1.25rem;
          padding: 1rem 1.25rem;
          resize: vertical;
          min-height: 5rem;
        }
        select.sproutly-input {
          padding-right: 2.5rem;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 1.25rem center;
          background-size: 0.75rem;
        }

        /* 圖片 hover 浮起 (商品詳情主圖) */
        .sproutly-zoomable {
          cursor: zoom-in;
          transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sproutly-zoomable:hover {
          transform: translateY(-2px);
        }

        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .sproutly-link::after,
          .sproutly-card .sproutly-card-image,
          .sproutly-card .sproutly-card-image img,
          .sproutly-card .sproutly-card-image::after,
          .sproutly-card .sproutly-card-title,
          .sproutly-card .sproutly-card-action,
          .sproutly-zoomable,
          .sproutly-scroll-progress,
          .sproutly-hero-parallax,
          .sproutly-stagger > * {
            transition: none !important;
            animation: none !important;
          }
        }

        /* 區段上下空白：editor 的「區段上下空白」slider 透過 --store-section-pad 套到所有區段。
           原本各 section 寫死 py-40 sm:py-56（=10rem/14rem），這個控制其實沒生效（沒人讀 var）。
           這裡用 attribute selector 0,1,1 蓋掉 Tailwind class 的 0,1,0，乘上倍率
           （compact 0.6 / default 1 / spacious 1.4）。
           排除 hero — hero 有自己的 heroHeight 控制（auto / short / tall / full），不該被全站 padding 動。
           stats / partners 原本 base 較小（py-32 sm:py-44），分組保留差異後再乘倍率。 */
        section[data-edit-target]:not([data-edit-target="hero"]):not([data-edit-target="stats"]):not([data-edit-target="partners"]) {
          padding-top: calc(10rem * var(--store-section-pad, 1));
          padding-bottom: calc(10rem * var(--store-section-pad, 1));
        }
        section[data-edit-target="stats"],
        section[data-edit-target="partners"] {
          padding-top: calc(8rem * var(--store-section-pad, 1));
          padding-bottom: calc(8rem * var(--store-section-pad, 1));
        }
        @media (min-width: 640px) {
          section[data-edit-target]:not([data-edit-target="hero"]):not([data-edit-target="stats"]):not([data-edit-target="partners"]) {
            padding-top: calc(14rem * var(--store-section-pad, 1));
            padding-bottom: calc(14rem * var(--store-section-pad, 1));
          }
          section[data-edit-target="stats"],
          section[data-edit-target="partners"] {
            padding-top: calc(11rem * var(--store-section-pad, 1));
            padding-bottom: calc(11rem * var(--store-section-pad, 1));
          }
        }

        /* 區段標題字級：editor 各 section panel「標題大小」三按鈕（小 0.85 / 預設 1 / 大 1.25）
           透過 inline --store-heading-scale CSS variable 套到該 section 的 h2 上。
           用 em 倍率（相對於 Tailwind 已套的 text-3xl 等 base），不寫 inline class 才能保留各 section
           原本的字級層級。排除 hero — hero 主標另有 heroTaglineFontScale 控制（避免雙重縮放）。 */
        section[data-edit-target]:not([data-edit-target="hero"]) h2 {
          font-size: calc(1em * var(--store-heading-scale, 1));
        }

        /* 區段進場動畫：editor 各 section panel「進場動畫」三按鈕（無 / 淡入 / 上滑）
           靠 data-anim attribute + CSS scroll-driven animation（animation-timeline: view()）觸發。
           沒設定 = 無 attr = 不動畫；fade = opacity 0→1；slide-up = opacity + translateY 上滑。
           edit mode（iframe ?edit=1）內由 editor-click-bridge.tsx 強制 disable 避免操作時看不到 section。
           Safari 18+ / Chrome 115+ 支援 scroll-driven，舊瀏覽器 graceful degrade（看不到動畫沒事）。
           prefers-reduced-motion 也 disable。 */
        section[data-edit-target][data-anim="fade"] {
          animation: sproutly-section-anim-fade 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-timeline: view();
          animation-range: entry 0% entry 35%;
        }
        section[data-edit-target][data-anim="slide-up"] {
          animation: sproutly-section-anim-slide 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-timeline: view();
          animation-range: entry 0% entry 35%;
        }
        @keyframes sproutly-section-anim-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sproutly-section-anim-slide {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          section[data-edit-target][data-anim="fade"],
          section[data-edit-target][data-anim="slide-up"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* iframe edit mode bridge（只在 ?edit=1 啟動） */}
      <EditorClickBridge />

      {/* a11y：鍵盤跳過 nav 到主內容 */}
      <a href="#main-content" className="sproutly-skip">
        跳至主要內容
      </a>

      {/* 頂部滾動進度（用 store accent 色） */}
      <div
        className="sproutly-scroll-progress"
        style={{ color: theme.accent }}
      />
      <header
        className="sticky top-0 z-10 backdrop-blur-md border-b sproutly-nav-shrink"
        style={{
          backgroundColor: theme.surface + "DD",
          borderColor: theme.border,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link
            href={`/${slug}`}
            className="flex items-center gap-3 group transition"
          >
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={theme.logoUrl}
                alt={store.name}
                className="h-9 w-9 rounded-md object-contain"
              />
            ) : null}
            <span
              className="font-medium text-lg tracking-tight truncate group-hover:opacity-70 transition"
              style={{ color: theme.text }}
            >
              {store.name}
            </span>
          </Link>
          <nav aria-label="店面主導覽" className="flex items-center gap-1">
            {/* 桌機：文字連結一字排開；手機收進右側漢堡選單 */}
            <div className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <StoreNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  isHome={item.href === `/${slug}`}
                  colorMuted={theme.textMuted}
                  colorActive={theme.text}
                />
              ))}
            </div>
            <Link
              href={accountHref}
              className="ml-2 px-2 py-2 transition hover:opacity-70"
              style={{ color: theme.textMuted }}
              aria-label={isLoggedIn ? "會員中心" : "登入"}
              title={isLoggedIn ? "會員中心" : "登入"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                {isLoggedIn && (
                  <circle cx="18" cy="6" r="2.5" fill={theme.accent} stroke="none" />
                )}
              </svg>
            </Link>
            <FavoritesCounter
              href={`/${slug}/favorites`}
              className="ml-1 px-2 py-2 whitespace-nowrap"
            />
            <div
              className="ml-1 px-2 py-2"
              style={{ color: theme.textMuted }}
            >
              <SearchOverlay slug={slug} />
            </div>
            <div
              className="px-1 py-2"
              style={{ color: theme.textMuted }}
            >
              <CartIcon slug={slug} />
            </div>
            <StoreMobileNav
              className="sm:hidden ml-1"
              slug={slug}
              items={navItems.map((item) => ({
                href: item.href,
                label: item.label,
              }))}
              colorMuted={theme.textMuted}
              colorActive={theme.text}
              surface={theme.surface}
              border={theme.border}
            />
          </nav>
        </div>
      </header>

      {/* 各 page 內部會包自己的 <main>，這裡用 div 避免 nested main。
          tabIndex=-1：讓 skip link 與「回到頂部」能把焦點程式化搬進來，
          但不進一般 Tab 順序；focus 時不畫外框（容器不需視覺 focus ring）。 */}
      <div
        id="main-content"
        className="flex-1 outline-none"
        tabIndex={-1}
      >
        {children}
      </div>

      <footer
        className="border-t mt-16"
        style={{
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16 sm:py-20 text-center space-y-8">
          {theme.tagline && (
            <div className="space-y-3">
              <p
                className="font-medium uppercase"
                style={{
                  color: theme.textMuted,
                  fontSize: "0.6875rem",
                  letterSpacing: "0.4em",
                }}
              >
                {theme.homepage.footerWordsLabel || HOMEPAGE_DEFAULTS.footerWordsLabel}
              </p>
              <p
                className="italic"
                style={{
                  color: theme.accent,
                  fontFamily: "var(--store-font)",
                  fontSize: "0.9375rem",
                  lineHeight: 1.7,
                  letterSpacing: "0.02em",
                }}
              >
                {theme.tagline}
              </p>
            </div>
          )}

          {showStoreInfo && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <span
                  className="h-px w-10"
                  style={{ background: theme.accent, opacity: 0.6 }}
                />
                <span
                  className="font-medium uppercase"
                  style={{
                    color: theme.textMuted,
                    fontSize: "0.6875rem",
                    letterSpacing: "0.4em",
                  }}
                >
                  Visit · 店面資訊
                </span>
                <span
                  className="h-px w-10"
                  style={{ background: theme.accent, opacity: 0.6 }}
                />
              </div>
              <div
                className="space-y-2.5"
                style={{ fontSize: "0.8125rem", lineHeight: 1.75 }}
              >
                {footerAddress && (
                  <p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        footerAddress
                      )}`}
                      target="_blank"
                      rel="noopener"
                      className="sproutly-link"
                      style={{ color: theme.text, letterSpacing: "0.02em" }}
                    >
                      {footerAddress}
                    </a>
                  </p>
                )}
                {footerPhone && (
                  <p>
                    <a
                      href={telHref(footerPhone)}
                      className="sproutly-link"
                      style={{ color: theme.text, letterSpacing: "0.04em" }}
                    >
                      {footerPhone}
                    </a>
                  </p>
                )}
                {footerHours && (
                  <p
                    className="whitespace-pre-line"
                    style={{ color: theme.textMuted, letterSpacing: "0.02em" }}
                  >
                    {footerHours}
                  </p>
                )}
              </div>
            </div>
          )}

          {showSocial && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <span
                  className="font-medium uppercase"
                  style={{
                    color: theme.textMuted,
                    fontSize: "0.6875rem",
                    letterSpacing: "0.4em",
                  }}
                >
                  {theme.homepage.footerFollowLabel || HOMEPAGE_DEFAULTS.footerFollowLabel}
                </span>
                <span
                  className="h-px w-10"
                  style={{ background: theme.accent, opacity: 0.6 }}
                />
              </div>
              <div className="flex justify-center gap-6">
                {theme.social.instagram && (
                  <a
                    href={theme.social.instagram}
                    target="_blank"
                    rel="noopener"
                    className="sproutly-link uppercase"
                    style={{
                      color: theme.textMuted,
                      fontSize: "0.75rem",
                      letterSpacing: "0.3em",
                    }}
                  >
                    Instagram
                  </a>
                )}
                {theme.social.facebook && (
                  <a
                    href={theme.social.facebook}
                    target="_blank"
                    rel="noopener"
                    className="sproutly-link uppercase"
                    style={{
                      color: theme.textMuted,
                      fontSize: "0.75rem",
                      letterSpacing: "0.3em",
                    }}
                  >
                    Facebook
                  </a>
                )}
                {theme.social.line && (
                  <a
                    href={theme.social.line}
                    target="_blank"
                    rel="noopener"
                    className="sproutly-link uppercase"
                    style={{
                      color: theme.textMuted,
                      fontSize: "0.75rem",
                      letterSpacing: "0.3em",
                    }}
                  >
                    LINE
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <span
              className="h-px w-8"
              style={{ background: theme.border }}
            />
            <Link
              href={`/${slug}/track`}
              className="sproutly-link uppercase"
              style={{
                color: theme.textMuted,
                fontSize: "0.75rem",
                letterSpacing: "0.3em",
              }}
            >
              {theme.homepage.footerTrackLabel || HOMEPAGE_DEFAULTS.footerTrackLabel}
            </Link>
            <span
              className="h-px w-8"
              style={{ background: theme.border }}
            />
          </div>

          <p
            className="uppercase"
            style={{
              color: theme.textMuted,
              opacity: 0.7,
              fontSize: "0.6875rem",
              letterSpacing: "0.32em",
            }}
          >
            © {new Date().getFullYear()} {store.name} · Powered by{" "}
            <Link
              href="/"
              className="sproutly-link font-medium"
              style={{ color: theme.textMuted, letterSpacing: "0.32em" }}
            >
              Sproutly
            </Link>
          </p>
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}
