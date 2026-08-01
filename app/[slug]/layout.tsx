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
import { telHref, socialUrl, mapsHref } from "@/lib/contact-href";
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
  // address / contact_phone 先 trim 再判斷：商家只打了空白時，原始字串是 truthy，
  // 頁尾會冒出「店面資訊」區塊，裡面是一個連到「Google Maps 搜尋一串空白」的隱形
  // 連結、和一個只剩 tel: 的壞電話連結。trim 後只剩空字串就當沒填、整塊不顯示，
  // 跟旁邊 businessHoursText 同一條防呆線。
  const footerAddress =
    theme.sections.contact && store.address ? store.address.trim() : "";
  const footerMapsHref = mapsHref(footerAddress);
  const footerPhone =
    theme.sections.contact && store.contact_phone
      ? store.contact_phone.trim()
      : "";
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

  // 頁尾社群連結先清成乾淨的絕對網址再用，商家填了「@帳號」、純帳號名或只剩空白
  // 都不會冒出一個點了跑到站內 404 的壞連結（沒清乾淨的那項就不顯示那個社群）。
  const socialLinks = {
    instagram: socialUrl(theme.social.instagram),
    facebook: socialUrl(theme.social.facebook),
    line: socialUrl(theme.social.line),
  };
  const showSocial =
    theme.sections.social &&
    Boolean(socialLinks.instagram || socialLinks.facebook || socialLinks.line);

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

        /* 區段標題字級：editor 各 section panel「標題大小」三按鈕（小 0.85 / 預設 1 / 大 1.25）。
           這條規則以前是「所有 section h2 一律 font-size: calc(1em * var(--store-heading-scale, 1))」
           ——沒設定的店家也吃得到，而 1em 是相對「上一層」的字級，不是 h2 自己的。這個 <style>
           沒有包在 @layer 裡，Tailwind v4 的工具類全在 @layer utilities，沒分層的一律贏有分層的，
           所以 h2 上的 text-3xl / text-4xl 全被蓋掉：每間店的區段標題都縮成內文大小（實測該是
           30px 的標題渲染出來 16px），標題跟內文分不出來；設了「大」也只是內文的 1.25 倍。
           改成跟標題粗細、標題底線同一招 data attribute：沒設就整條規則不存在，Tailwind 的字級
           原封不動；有設才用下面這份基準字級乘上去，倍率乘的才是標題本身。
           基準字級跟 page.tsx 各 h2 的 text-* class 對齊（三種：選物提案／本月選物 text-xl
           sm:text-2xl、慢讀區 text-3xl sm:text-4xl lg:text-[2.5rem]、其餘 text-2xl sm:text-3xl
           md:text-4xl）——那邊改字級這裡要跟著改，只有商家真的用了「標題大小」才看得出差別。
           排除 hero — hero 主標另有 heroTaglineFontScale 控制（避免雙重縮放）。 */
        section[data-edit-target] {
          --store-h2-base: 1.5rem;
        }
        section[data-edit-target="collections"],
        section[data-edit-target="featured"] {
          --store-h2-base: 1.25rem;
        }
        section[data-edit-target="journal"] {
          --store-h2-base: 1.875rem;
        }
        @media (min-width: 640px) {
          section[data-edit-target] {
            --store-h2-base: 1.875rem;
          }
          section[data-edit-target="collections"],
          section[data-edit-target="featured"] {
            --store-h2-base: 1.5rem;
          }
          section[data-edit-target="journal"] {
            --store-h2-base: 2.25rem;
          }
        }
        @media (min-width: 768px) {
          section[data-edit-target]:not([data-edit-target="collections"]):not([data-edit-target="featured"]):not([data-edit-target="journal"]) {
            --store-h2-base: 2.25rem;
          }
        }
        @media (min-width: 1024px) {
          section[data-edit-target="journal"] {
            --store-h2-base: 2.5rem;
          }
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-scale="small"] h2 {
          font-size: calc(var(--store-h2-base, 1.5rem) * 0.85);
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-scale="large"] h2 {
          font-size: calc(var(--store-h2-base, 1.5rem) * 1.25);
        }

        /* 區段標題粗細：editor 各 section panel「標題粗細」三按鈕（細 / 預設 / 粗）。
           走 data-heading-weight attribute 不走 CSS variable —— font-weight 的 var()
           fallback 只能填另一個值，等於沒設定的 section 也會被那個值一律蓋掉，各 section
           原本 Tailwind class 的粗細層級就沒了。attribute selector 才有「沒設就不存在」。
           400 / 700 是 layout 這支已經載進來的字重，不用 300 之類沒載的（瀏覽器會拿常規
           假變細，中文筆畫糊掉）。排除 hero — hero 主標的字級 / 顏色 / 對齊自成一組控制。 */
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-weight="light"] h2 {
          font-weight: 400;
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-weight="bold"] h2 {
          font-weight: 700;
        }

        /* 區段標題底線：editor 各 section panel「標題底線」三按鈕（無 / 短線 / 整條）。
           畫成 h2::after 而不是 h2 的 border-bottom —— h2 是 block、寬度撐滿整欄，border
           畫出來一律是整條，做不出雜誌感的那截短線。走 data attribute 同樣是為了「沒設就
           整條規則不存在」。顏色與左右外距由 page.tsx 用 inline CSS variable 餵進來：顏色
           跟外框／分隔線共用同一個口徑（有自訂文字色就從它算，沒有就全站 border 色），
           外距是因為 ::after 是 block，父層的 text-align 管不到它，對齊靠右時線會留在左邊。
           排除 hero — hero 主標自成一組控制。 */
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-rule] h2::after {
          content: "";
          display: block;
          height: 2px;
          margin-top: 0.7em;
          margin-left: var(--store-rule-ml, auto);
          margin-right: var(--store-rule-mr, auto);
          background: var(--store-rule-color, currentColor);
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-rule="short"] h2::after {
          width: 56px;
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-rule="full"] h2::after {
          width: 100%;
        }

        /* 區段內文行高：editor 各 section panel「行高」三按鈕（緊湊 / 預設 / 舒展）。
           page.tsx 已經在 section 上設 inline line-height，但那是繼承值，而真正的內文
           ——描述、卡片說明、引言、常見問題答案——每一段都掛著 leading-[1.9] / leading-[1.95]
           之類 Tailwind class，元素自己的 class 一律蓋掉繼承值。結果商家把行高調成舒展，
           畫面上會動的只有極少數沒帶 leading class 的字，段落本身紋風不動；這控制點得動、
           存得進去，看起來就是壞的（跟區段字體 693459c、標題大小 5f18af9 同一個毛病）。
           這份 <style> 沒包在 @layer，Tailwind v4 的工具類全在 @layer utilities，沒分層的
           一律贏有分層的，所以這幾條規則蓋得過 leading-* class。
           只套內文元素（段落 / 條列 / 引言 / 圖說），不碰 h1-h3 —— 標題的行高是設計上跟
           字級綁在一起的（大標 1.05、卡片標題 1.4），跟著內文一起拉開會散掉；商家要調
           標題另有字級 / 粗細 / 底線那一組控制。數值跟 page.tsx 的 lineHeightToVal 對齊。
           沒設就沒 attribute、整條規則不存在，既有店家一行字都不會變。 */
        section[data-edit-target][data-line-height="tight"] :is(p, li, blockquote, figcaption, dd) {
          line-height: 1.4;
        }
        section[data-edit-target][data-line-height="relaxed"] :is(p, li, blockquote, figcaption, dd) {
          line-height: 2;
        }

        /* 區段內文對齊：editor 各 section panel「內文對齊」四按鈕（跟標題一致 / 左 / 中 / 右）。
           「標題對齊」設的是整段容器的 text-align，段落是繼承來的，所以標題與內文一直只能
           同進退：商家想做報紙與雜誌最常見的「標題置中、內文靠左」（長段落靠左才好讀，
           置中的長文每行起點都在跳），只能整段改對齊、標題跟著跑掉，等於做不到。
           改不了的原因跟行高那組一樣：段落自己帶 text-center / text-left class，元素自己的
           class 一律蓋掉繼承來的值，光在容器上換 inline text-align 動不了它們。這份 <style>
           沒包在 @layer，Tailwind v4 的工具類全在 @layer utilities，沒分層的贏有分層的，所以
           這幾條規則蓋得過 text-* class。
           只套內文元素（段落 / 條列 / 引言 / 圖說），跟行高那組同一份選擇器：標題留給
           「標題對齊」管，兩個控制各管一半才做得出上面那個排法。
           沒設（或選「跟標題一致」）就沒 attribute、整條規則不存在，既有店家一個字都不會動。 */
        section[data-edit-target][data-body-align="left"] :is(p, li, blockquote, figcaption, dd) {
          text-align: left;
        }
        section[data-edit-target][data-body-align="center"] :is(p, li, blockquote, figcaption, dd) {
          text-align: center;
        }
        section[data-edit-target][data-body-align="right"] :is(p, li, blockquote, figcaption, dd) {
          text-align: right;
        }

        /* 區段內文一行字數：editor 各 section panel「一行字數」三按鈕（不限制 / 約 34 字 / 約 24 字）。
           滿版區段的長段落，一行會拉到整個螢幕寬——眼睛掃到行尾再回來時找不到下一行的行首，
           讀起來一直在跳行。報紙與雜誌都是把內文收成窄欄解這件事，Sproutly 原本沒有這個控制：
           「區段寬度」收的是整段（標題、卡片、照片一起變窄），做不出「標題滿版、內文窄欄」
           這個最常見的排法；商家想讓長描述好讀，只能整段縮掉。
           寬度用 em 不用 ch：ch 是「0」這個字的寬度，中文字大約是它的兩倍，用 ch 算出來的
           欄寬會比商家看到的字數少一半。em 等於元素自己的字級，也就是一個中文字的寬度，
           所以 34em 約等於一行 34 個中文字，小字級的段落也會按自己的大小收窄。
           只套段落（含引言、定義），不套 li 與圖說：li 常在 flex / grid 裡排成一列，下面那兩條
           auto 外距在 flex 裡的意思是「把自己推到中間」，會改到版面；圖說本來就短，收窄沒意義。
           左右外距靠 page.tsx 餵變數，不寫死 auto——窄欄的外距要跟著這一段的內文對齊走
           （置中就兩邊 auto、靠左就左邊 0），CSS 這裡讀不到那個值（對齊是 inline text-align，
           選擇器選不到），跟標題底線那條 ::after 同一個處境、同一個解法。
           沒設（或選「不限制」）就沒 attribute、整條規則不存在，既有店家的段落寬度一律不動。 */
        section[data-edit-target][data-body-measure] :is(p, blockquote, dd) {
          max-width: var(--store-measure-max);
          margin-left: var(--store-measure-ml, auto);
          margin-right: var(--store-measure-mr, auto);
        }

        /* 區段內文字級：editor 各 section panel「內文大小」三按鈕（小 / 預設 / 大）。
           標題早就能各段獨立調大小（「標題大小」那組），內文一直只能跟著全網站的字體設定走
           ——長描述在手機上偏小、想把某一段的短文當引言放大，商家唯一的辦法是改整段的字體
           設定、標題跟著一起變，等於做不到。
           不用 font-size：CSS 沒有「拿這個元素自己現在的字級再乘一個倍數」的寫法，em 是對
           父層算的。同一段裡的內文本來大小不同（描述 1rem、圖說 0.75rem、引言 1.25rem 是設計
           上的層級），寫 font-size: 1.12em 會讓它們全部變成父層的 1.12 倍，也就是三種字一起
           被壓成同一級——那不是放大內文，是把這一段的層級抹平。
           zoom 縮放的是元素自己算出來的大小，所以三種字各自按原本的比例變大變小，層級原封
           不動；連帶段落的外距也等比縮放（放大的字距離也該跟著開），比只動字級自然。
           不套 li：站上唯一的 li 是常見問題那一排（帶上下框線的整列），縮放整列會連問題與
           那條線一起動；答案本身是 p，已經被這條規則收進來了。
           跟一行字數同一個處境：em 的最大寬度是對元素自己的字級算，所以窄欄會跟著字一起縮
           放，兩個控制同時開也還是商家看到的那個字數。
           沒設（或選「預設」）就沒 attribute、整條規則不存在，既有店家一個字都不會變。 */
        section[data-edit-target][data-body-scale="small"] :is(p, blockquote, dd, figcaption) {
          zoom: 0.9;
        }
        section[data-edit-target][data-body-scale="large"] :is(p, blockquote, dd, figcaption) {
          zoom: 1.12;
        }

        /* 區段內容垂直位置：editor 各 section panel「內容垂直位置」三按鈕（靠上 / 置中 / 靠下）。
           只有這一段比內容高的時候才看得出差別，也就是設了「最小高度」（高 80vh / 滿屏 100vh）
           之後——而那正是這個控制要補的洞：撐出來的空高一律留在內容下面，商家選了滿屏想要一
           整螢幕的段落，拿到的是一小塊內容黏在上緣、下面一大片空白。要把內容推下來，原本唯一
           的辦法是把「區段上下空白」一路調到寬鬆去硬塞，那同時也把左右與其他段落的節奏一起改了，
           而且高度是 vh、空白是 rem，換一台裝置就對不上。內建的「戲劇感」快速風格（滿屏＋大標
           ＋深陰影）就是這樣，套完看起來像沒排完。
           用 align-content 而不是把 section 改成 flex：那是這裡唯一「只動剩餘空高怎麼分」的
           寫法。改 display: flex 會讓每個直接子層變成 flex item，這些段落的子層帶著 mx-auto、
           max-w-*、absolute（自由定位的元素）與各自的上下外距，換一套排版模型就是把整段的版面
           重算一次，為了推一段空白不值得。align-content 在一般區塊容器上是 2024 年才全面支援
           （Chrome 123 / Safari 17.6 / Firefox 125）；認不得的舊瀏覽器整條當沒看到，內容照舊
           留在上緣，也就是這個控制沒設的樣子——跟進場動畫那組一樣，看不到效果但畫面不會壞。
           沒設（或選「靠上」）就沒 attribute、整條規則不存在，既有店家的版面一律不動。 */
        section[data-edit-target][data-content-align="middle"] {
          align-content: center;
        }
        section[data-edit-target][data-content-align="bottom"] {
          align-content: end;
        }

        /* 區段裝置顯示：editor 各 section panel「在這台裝置隱藏」三按鈕（都顯示 / 手機 / 桌機）。
           同一段內容在兩台裝置上不會一樣好看：合作 logo 那排、照片牆這種橫著排的段落到手機上
           會擠成一長條，商家原本只能整段關掉——那個開關是全站的，桌機也跟著沒了；反過來手機
           專用的「直接打電話」那類段落，在桌機上是多餘的。這一欄補的是「只在某一台不顯示」。
           手機 = 640 以下、桌機 = 1024 以上，中間那段（平板）兩邊都不碰：只有一欄可選，切在
           中間最好跟商家解釋，也對得上編輯器上面那三個預覽寬度（375 / 768 / 1280）。
           用 media query 而不是在伺服器上判斷裝置：公開頁同一份 HTML 會被 CDN 快取給所有人，
           伺服器那層根本不知道下一個客人拿什麼在看；而且編輯器的預覽就是同一份頁面塞進不同
           寬度的 iframe，靠 CSS 判斷寬度，商家切到手機預覽才看得到「這段真的消失了」。
           display: none 而不是 visibility / opacity：藏起來的段落不能還佔著那塊高度，不然
           手機上換成一大片空白，比原本擠在一起更難看。
           編輯模式（?edit=1）內另有一條把它還原成半透明虛線框（見 editor-click-bridge）——
           不然商家一設「手機隱藏」，段落在畫布上整個消失，連要點回去改都找不到。
           沒設（或選「都顯示」）就沒 attribute、整條規則不存在，既有店家一段都不會消失。 */
        @media (max-width: 639.98px) {
          section[data-edit-target][data-hide-on="mobile"] {
            display: none;
          }
        }
        @media (min-width: 1024px) {
          section[data-edit-target][data-hide-on="desktop"] {
            display: none;
          }
        }

        /* 區段濾鏡：editor 各 section panel「濾鏡」三按鈕（無 / 黑白 / 復古）。
           只套這一段裡的照片。原本是 page.tsx 直接在 section 上設 filter，整個子樹一起被洗
           ——這一段的自訂底色、文字色、用主色畫的小標與短線全部跟著變灰或染成褐調，等於把
           商家在同一個面板裡剛挑好的顏色作廢；而 filter 是先把子樹畫成一張圖再處理，子元素
           寫 filter: none 也救不回來，沒有辦法只讓照片變黑白而留住配色。兩個控制湊在一起
           互相毀掉（同類：淡化×進場動畫 a2428d8、主色×自訂底色 29140d6）。
           值由 page.tsx 餵 --store-media-filter，這裡只負責畫；attribute 是開關，沒設就整條
           規則不存在（CSS 判斷不了變數有沒有設，靠 var() fallback 會讓這條規則落在每一段的
           每張照片上，蓋掉圖片自己的 filter）。合作 logo 那張自己 inline 讀同一個變數。 */
        section[data-edit-target][data-section-filter] :is(img, video) {
          filter: var(--store-media-filter, none);
        }

        /* 區段照片圓角：editor 各 section panel「照片圓角」三按鈕（直角 / 微圓 / 圓潤）。
           站上的照片一律接近直角——商品卡的圖框寫死 4px（見上面 .sproutly-card-image），
           其餘的圖連圓角都沒有。這是全站一個值，商家動不了：把某一段做成圓角卡片
           （底色 + 圓角 + 陰影那三件套）之後，段落四角圓了、裡面的照片還是方的，兩種圓角
           對不起來反而更像沒做完；而「圓角」那欄動的是段落自己的外框，傳不下去給裡面的圖。
           圓角要畫在圖框（.sproutly-card-image）上，不是只畫在 img 上：那個框是
           overflow: hidden + 自己的陰影，只圓 img 的話圖被框裁成直角、圓角看不出來，
           而框的陰影仍是直角的四個邊。同一段裡沒有圖框的照片（合作 logo、慢讀區那張、
           照片牆）才直接圓在 img 身上，所以第二條把圖框裡的圖排除掉，避免同一張圖被圓
           兩次（圖自己縮了一圈，框的邊角會露出一線底色）。
           不套 iframe：站上唯一的 iframe 是門市那張地圖，它自己已經有一組圓角與外框。
           沒設（或選「直角」）就沒 attribute、整條規則不存在，既有店家的照片一律不動。 */
        section[data-edit-target][data-media-radius] .sproutly-card-image {
          border-radius: var(--store-media-radius);
        }
        /* 這一條跟上一條分開寫（不併成一份逗號清單）：:not() 裡放後代選擇器是比較新的寫法，
           萬一有瀏覽器認不得，整份清單會一起被丟掉、連圖框那條也失效。分開就最多只少這一條。 */
        section[data-edit-target][data-media-radius] :is(img, video):not(.sproutly-card-image *) {
          border-radius: var(--store-media-radius);
          overflow: hidden;
        }
        section[data-edit-target][data-media-radius="soft"] {
          --store-media-radius: 14px;
        }
        section[data-edit-target][data-media-radius="round"] {
          --store-media-radius: 28px;
        }

        /* 照片比例：editor 各 section panel「照片比例」四按鈕（各段預設 / 正方 / 直式 / 橫式）。
           每段的圖框比例是寫死的一個值（選物 3:4、精選商品 1:1、慢讀 5:3、照片牆 1:1），
           照片放進框一律鋪滿再裁（object-cover）——賣水壺、高盆栽這類直式商品的店，商品照
           在正方形的框裡被裁頭去尾，商家沒有一格動得到；反過來拍橫幅生活照的店想讓照片牆
           寬一點也一樣。換的是框的比例（換裁法），不是把圖壓扁。
           規則只落在 .sproutly-card-image（卡片格線裡的圖框）——慢讀區沒放圖時那個框裡是
           純底色，比例一樣生效，不會變成有圖的卡高、沒圖的卡塌掉。attribute 只掛在有這種
           圖框的四段上，門市那張地圖、hero 的大圖都不吃這條（hero 的比例是版型的一部分，
           split 左右分欄靠它撐高度）。直式用 3:4 跟選物的預設同一個口徑；橫式 3:2 比慢讀的
           5:3 略高，商品照橫著裁太扁會只剩瓶身中段。沒設（或選「各段預設」）就沒 attribute、
           整條規則不存在，各段維持自己原本的比例。 */
        section[data-edit-target][data-media-aspect="square"] .sproutly-card-image {
          aspect-ratio: 1 / 1;
        }
        section[data-edit-target][data-media-aspect="portrait"] .sproutly-card-image {
          aspect-ratio: 3 / 4;
        }
        section[data-edit-target][data-media-aspect="landscape"] .sproutly-card-image {
          aspect-ratio: 3 / 2;
        }

        /* 照片取景：editor 各 section panel「照片取景」三按鈕（置中 / 靠上 / 靠下）。
           照片鋪滿框再裁（object-cover）的時候一律從正中間取，這是 object-position 的
           預設值——直式商品照放進正方或橫式的框，被裁的是上下兩頭，而盆栽的葉冠、水壺的
           瓶口偏偏都在上面，裁掉的剛好是重點。上面那條「照片比例」換的是框的形狀，
           救不了「同一個框裡該留哪一端」。規則落在 .sproutly-card-image 裡的 img——
           四段的卡片圖都是鋪滿圖框的 img（next/image fill），沒有一張帶 inline 的
           object-position，這條規則落得下去。只有上下兩檔：卡片圖框永遠比照片窄邊裁
           長邊，直式照片被裁的是上下；沒設（或選「置中」）就沒 attribute、整條規則
           不存在，照片維持置中裁。 */
        section[data-edit-target][data-media-focus="top"] .sproutly-card-image img {
          object-position: 50% 0%;
        }
        section[data-edit-target][data-media-focus="bottom"] .sproutly-card-image img {
          object-position: 50% 100%;
        }

        /* 卡片間距：editor 各 section panel「卡片間距」三按鈕（緊湊 / 預設 / 寬鬆）。
           商品卡、照片牆、合作 logo 彼此的距離是每段寫死的一組值，商家動得到間距的只有
           「區段空白」跟「上下外距」——那兩欄調的是段落外圍，卡片之間一動也不動：欄數
           調成 4 卡片就黏在一起、想做緊貼的照片拼貼或鬆一點的畫廊感都沒有格子可按。
           規則只落在 .sproutly-card-grid（各段的卡片格線容器都掛了這個 class），不能寫
           落在所有 .grid 上——hero 的左右分欄、切版用的 grid 也是 grid，蓋到會拆版型。
           直的（列距）與橫的（欄距）分開給：卡片下面帶著品名價錢，列距本來就該比欄距大，
           一個值兩邊通用會把文字跟下一張卡黏在一起。寬鬆用 clamp 跟著螢幕寬縮——手機上
           兩欄格線塞 64px 的欄距，卡片自己就沒剩多少寬度。合作 logo 那排是 flex，gap
           一樣吃這兩個值。沒設（或選「預設」）就沒 attribute、整條規則不存在，各段維持
           自己原本那組間距。 */
        section[data-edit-target][data-grid-gap="tight"] .sproutly-card-grid {
          column-gap: 12px;
          row-gap: 28px;
        }
        section[data-edit-target][data-grid-gap="loose"] .sproutly-card-grid {
          column-gap: clamp(24px, 4.5vw, 64px);
          row-gap: clamp(56px, 8vw, 112px);
        }

        /* 滑過卡片的動作：editor 各 section panel「滑過卡片」三按鈕（預設 / 輕微 / 不動）。
           滑鼠移到商品卡上，站上一律做四件事（見上面 .sproutly-card:hover 那組）：卡片浮起
           6px、照片放大一成、照片上壓一層暗、標題字距撐開——那是全站寫死的一組動作，每一段
           都吃同一份。密集排的照片牆滑過去整片在動、慢讀區的文章卡被當商品卡放大、構圖抓好
           的商品照被放大裁掉邊，商家原本沒有一格關得掉（「進場動畫」是整段進場時做一次的
           事，跟滑過卡片無關）。
           要蓋掉的是 hover 狀態與卡片裡面那幾層，段落上的 inline style 兩者都碰不到——跟
           卡片間距、照片取景同一個處境同一個解法：attribute 讓這裡補一組更精確的規則壓過去。
           輕微＝只留浮起（縮到 2px），照片不放大、不壓暗、標題字距不動；不動＝四件全關。
           兩檔都把卡片下面那顆原本要滑過才浮現的按鈕改成一直看得見——關掉滑過的動作之後
           它永遠不會出現，等於把「看更多」這個入口一起關掉了，那不是商家按這一格的意思。
           沒設（或選「預設」）就沒 attribute、整條規則不存在，卡片維持原本那組動作。 */
        section[data-edit-target][data-card-hover="calm"] .sproutly-card:hover .sproutly-card-image {
          transform: translateY(-2px);
        }
        section[data-edit-target][data-card-hover="none"] .sproutly-card:hover .sproutly-card-image {
          transform: none;
          box-shadow: var(--sproutly-elev-2);
        }
        section[data-edit-target]:is([data-card-hover="calm"], [data-card-hover="none"])
          .sproutly-card:hover .sproutly-card-image img {
          transform: none;
        }
        section[data-edit-target]:is([data-card-hover="calm"], [data-card-hover="none"])
          .sproutly-card:hover .sproutly-card-image::after {
          background: rgba(0, 0, 0, 0);
        }
        section[data-edit-target]:is([data-card-hover="calm"], [data-card-hover="none"])
          .sproutly-card:hover .sproutly-card-title {
          letter-spacing: inherit;
        }
        section[data-edit-target]:is([data-card-hover="calm"], [data-card-hover="none"])
          .sproutly-card .sproutly-card-action {
          opacity: 1;
          transform: none;
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
        /* 收尾的 opacity 讀 --store-section-opacity（區段「淡化」控制設的，見 page.tsx
           mergeSectionStyle）：動畫宣告在階層上壓過 inline style，寫死 1 會讓「淡化」跟
           「進場動畫」兩個控制湊在一起時前者完全沒作用。沒設變數就是 1，原本行為不變。 */
        @keyframes sproutly-section-anim-fade {
          from { opacity: 0; }
          to { opacity: var(--store-section-opacity, 1); }
        }
        @keyframes sproutly-section-anim-slide {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: var(--store-section-opacity, 1); transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          section[data-edit-target][data-anim="fade"],
          section[data-edit-target][data-anim="slide-up"] {
            animation: none !important;
            /* 同上：這裡的 !important 連 inline opacity 都壓得過，寫死 1 等於在「不要動畫」
               的偏好下把淡化一起關掉。 */
            opacity: var(--store-section-opacity, 1) !important;
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
              slug={slug}
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
                data-edit-text
                data-edit-field="footerWordsLabel"
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
                {footerAddress && footerMapsHref && (
                  <p>
                    <a
                      href={footerMapsHref}
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
                  data-edit-text
                  data-edit-field="footerFollowLabel"
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
                {socialLinks.instagram && (
                  <a
                    href={socialLinks.instagram}
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
                {socialLinks.facebook && (
                  <a
                    href={socialLinks.facebook}
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
                {socialLinks.line && (
                  <a
                    href={socialLinks.line}
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
              {/* 標在 span 不標在 Link 本體：照 magazine 版 heroCta 同款，編輯範圍只有文字 */}
              <span data-edit-text data-edit-field="footerTrackLabel">
                {theme.homepage.footerTrackLabel || HOMEPAGE_DEFAULTS.footerTrackLabel}
              </span>
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
