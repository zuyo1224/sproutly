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
import { contrastRatio, NON_TEXT_CONTRAST_MIN } from "@/lib/color-contrast";
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

  // 頁尾配色：商家只挑底色與文字色兩個值，頁尾裡另外四種深淺從它們算出來。
  // 兩個欄位都經過 normalizeHexColor，一定是 #rrggbb，所以次要文字直接接 alpha
  // （B3 ≈ 70%、47 ≈ 28%）——跟公開頁 mutedFromText 同一個數值口徑。
  // 沒挑就整組退回 theme 原本的值，既有店家的頁尾一個像素都不動。
  const fBg = theme.layout.footerBg ?? theme.surface;
  const fText = theme.layout.footerText ?? theme.text;
  const fMuted = theme.layout.footerText
    ? theme.layout.footerText + "B3"
    : theme.textMuted;
  const fBorder = theme.layout.footerText
    ? theme.layout.footerText + "47"
    : theme.border;
  // 點綴色（tagline 那行斜體、店面資訊與社群兩側的短線）是配著全站底色挑的，商家把頁尾
  // 換成深底時它會一起淡進去——不是壞掉，是看不見，而商家不會知道是哪一格造成的。
  // 對比低於非文字元素的下限就換成頁尾的文字色（那個色是配著這塊底色挑的，一定看得見），
  // 跟區段自訂底色那道防呆同一個口徑；夠的店一個像素都不動。
  const fAccent =
    theme.layout.footerBg &&
    (contrastRatio(theme.accent, theme.layout.footerBg) ?? Infinity) <
      NON_TEXT_CONTRAST_MIN
      ? fText
      : theme.accent;

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
        /* 這兩個數字（靜止 0.7、滑過 1）改由變數帶，好讓下面「卡片副文字深淺」那組換掉它們；
           沒設那格的店拿到的還是 fallback 的 0.7 / 1，一個像素都不動。 */
        .sproutly-card .sproutly-card-meta {
          opacity: var(--card-meta-opacity, 0.7);
          transform: translateY(0);
          transition: opacity 0.6s, transform 0.6s;
        }
        .sproutly-card:hover .sproutly-card-meta {
          opacity: var(--card-meta-opacity-hover, 1);
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
          /* 商家在「按鈕圓角」那格挑的形狀，值由 themeToCssVars 算好掛在 root。
             沒設的店家 fallback 回原本的 9999px，算出來一模一樣。 */
          border-radius: var(--store-btn-radius, 9999px);
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
           ——沒設定的店家也吃得到，而 1em 是相對「上一層」的字級，不是 h2 自己的。這個 CSS
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
           假變細，中文筆畫糊掉）。排除 hero — hero 主標的字級 / 顏色 / 對齊自成一組控制。
           除了 font-weight 還一起寫出 --heading-weight：十五個 h2 每一個都在 inline style
           裡寫死字重（多數 400、數字那段 500），inline 一律贏過這裡的規則，所以只寫
           font-weight 這一格是死的——按下去畫面不動。page.tsx 那邊改讀
           var(--heading-weight, 原本的值)，沒設變數時算出來一模一樣。 */
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-weight="light"] h2 {
          font-weight: 400;
          --heading-weight: 400;
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-weight="bold"] h2 {
          font-weight: 700;
          --heading-weight: 700;
        }

        /* 區段大標行距：editor 各 section panel「標題行距」三按鈕（收緊 / 預設 / 拉開）。
           只有大標排到兩行以上才看得出差別，而大標偏偏是最容易換行的那一行——字級全段最大，
           商家打的又常常是一整句中文，手機上一行放不下是常態。各段的行距是 Tailwind 字級
           class 附帶的（text-2xl 那組約 1.33、text-3xl / text-4xl 那組壓到 1.1-1.2），照英文
           標題挑的：中文換到第二行時上下兩行的筆畫幾乎貼在一起。
           底下那條「區段內文行高」刻意跳過 h1-h3（標題行高跟字級綁在一起，跟內文一起拉開
           會散掉），所以標題這邊要自己一條。同樣走 data attribute：沒設就整條規則不存在，
           各段維持自己 class 附帶的那個值。這份 CSS 沒包在 @layer，蓋得過 leading-* class。
           排除 hero — hero 主標自成一組控制，跟標題粗細、底線那幾條同一個範圍。
           收緊給 1.1 不給更小：中文的字在行框裡本來就佔滿，1.0 以下上下兩行會疊到筆畫。
           跟粗細同一個處境：慢讀 / 好評 / 常見問題 / 數字 / 相簿 / 來訪那六段的 h2 在 inline
           style 裡寫死 lineHeight 1.2，inline 贏過這裡，只寫 line-height 這一格對那六段是死的。
           一起寫出 --heading-leading，page.tsx 改讀 var(--heading-leading, 1.2)；選物與精選
           那幾個 h2 的行距在 class 上（這份 CSS 沒包 @layer，蓋得過），本來就吃得到。 */
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-leading="tight"] h2 {
          line-height: 1.1;
          --heading-leading: 1.1;
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-leading="loose"] h2 {
          line-height: 1.5;
          --heading-leading: 1.5;
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
        /* 底線粗細：editor 同一格底下的三按鈕（細 / 預設 / 粗）。跟長度分開兩個 attribute，
           不用把長短 × 粗細四種組合各寫一條規則。只有 1 / 2 / 4px 這種整數值——中間的
           半格瀏覽器畫不出來，會抹成一條灰邊。沒設就沒 attribute，維持上面那條的 2px。 */
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-rule-weight="thin"] h2::after {
          height: 1px;
          --store-rule-weight: 1px;
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-rule-weight="thick"] h2::after {
          height: 4px;
          --store-rule-weight: 4px;
        }
        /* 底線線型：editor 同一格底下的三按鈕（實線 / 虛線 / 點線）。線本來是 ::after 的
           background 填色，background 畫不出虛線——選了虛線點線就把 background 收掉、改畫
           border-top，粗細從上面那兩條規則寫出的 --store-rule-weight 轉餵 border 寬（變數不吃
           規則順序，height 那兩條照舊管實線）。這兩條要排在粗細規則後面：同分量的選擇器誰
           後寫誰贏，height 歸零才蓋得掉。顏色跟實線同一個變數，深淺那格照樣有效。
           點線配粗檔會變一排圓點，那不是 bug 是這個線型本來的樣子（跟分隔線那格同一句話）。
           沒設或選實線就沒 attribute，這兩條整條不存在，既有店家一條線都不會變。 */
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-rule-style] h2::after {
          height: 0;
          background: none;
          border-top-width: var(--store-rule-weight, 2px);
          border-top-color: var(--store-rule-color, currentColor);
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-rule-style="dashed"] h2::after {
          border-top-style: dashed;
        }
        section[data-edit-target]:not([data-edit-target="hero"])[data-heading-rule-style="dotted"] h2::after {
          border-top-style: dotted;
        }

        /* 區段內文行高：editor 各 section panel「行高」三按鈕（緊湊 / 預設 / 舒展）。
           page.tsx 已經在 section 上設 inline line-height，但那是繼承值，而真正的內文
           ——描述、卡片說明、引言、常見問題答案——每一段都掛著 leading-[1.9] / leading-[1.95]
           之類 Tailwind class，元素自己的 class 一律蓋掉繼承值。結果商家把行高調成舒展，
           畫面上會動的只有極少數沒帶 leading class 的字，段落本身紋風不動；這控制點得動、
           存得進去，看起來就是壞的（跟區段字體 693459c、標題大小 5f18af9 同一個毛病）。
           這份 CSS 沒包在 @layer，Tailwind v4 的工具類全在 @layer utilities，沒分層的
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
           class 一律蓋掉繼承來的值，光在容器上換 inline text-align 動不了它們。這份 CSS
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

        /* 區段內文粗細：editor 各 section panel「內文粗細」三按鈕（常規 / 中黑 / 粗）。
           粗細這一格前面補過段落大標、卡片品名、卡片描述、卡片價錢，段落自己的內文是最後
           一個沒得動的——而那幾行是每一段字最多、客人真的會讀完的地方。它們一律 400，又多半
           同時讀 --store-text-muted（文字色的七成），兩個減法疊起來，引言與常見問題的答案在
           淺色底上是一片糊的灰。商家原本只能繞：調濃會跟標題撞成同一層、放大會把整段撐高、
           換黑體是連標題一起換，沒有一個是「只讓這幾行重一點」。
           選擇器跟行高、內文對齊那兩組同一份（段落 / 條列 / 引言 / 圖說），三格管的是同一批
           字。不碰 h1-h3：標題的粗細另有「標題粗細」那一格，兩邊各管一半才做得出「標題常規、
           內文中黑」這種排法。
           卡片裡那幾行不歸這條管：卡片描述與價錢的規則帶 class（.sproutly-card-desc /
           .sproutly-card-price），特異度比這條高，商家兩邊都設時卡片照樣聽卡片那格的。
           只用 400 / 500 / 700 這三個有載進來的字重，不給 300：沒載的字重瀏覽器會拿常規去
           假變細，中文筆畫糊成一團——跟大標與卡片那三格同一個理由。
           除了直接寫 font-weight 也一併寫 --body-weight：自己在 inline style 上寫死粗細的那
           幾行（重點那段的引言）壓得過這條規則，改讀變數才跟得上，沒設就 fallback 回原值。
           沒設（或選「常規」）就沒 attribute、整條規則不存在，既有店家一個字都不會變。 */
        section[data-edit-target][data-body-weight="medium"] :is(p, li, blockquote, figcaption, dd) {
          font-weight: 500;
          --body-weight: 500;
        }
        section[data-edit-target][data-body-weight="bold"] :is(p, li, blockquote, figcaption, dd) {
          font-weight: 700;
          --body-weight: 700;
        }

        /* 區段內文字距：editor 各 section panel「內文字距」三按鈕（收緊 / 預設 / 撐開）。
           字距這一格前面補過段落小標、段落大標、卡片全大寫小字、卡片品名，段落自己的內文
           是最後一個沒得動的——而那幾行是每一段字最多、客人真的會讀完的地方。
           商家原本只有整段那一欄「字距」，它同時寫 section 的 letterSpacing 與 --store-track，
           大標、引言、數字、問句全部一起走。中文的大標與內文要的方向常常相反（大標字級大要
           往外撐、整段內文撐開反而散成一個一個字），調哪一邊另一邊就壞。
           選擇器跟內文粗細、行高、內文對齊那三組同一份（段落 / 條列 / 引言 / 圖說），四格
           管的是同一批字。落在段落上是繼承值，元素自己 inline 寫死字距的那幾行（大標、
           小標）本來就蓋得掉這條，剛好是這格不想動的。
           卡片描述沒有自己的字距那格，會跟著這條走（卡片那邊只做過品名與全大寫小字）。
           收緊 -0.02em / 撐開 0.06em，兩頭都比小標那種 0.4em 保守——內文要的是一整段讀得順。
           除了直接寫 letter-spacing 也一併寫 --body-track：inline 寫死字距的那幾行裡，重點
           那段的引言是「該跟著這條走卻跟不到」的例外（大標、小標則是刻意不跟），它改讀變數。
           沒設（或選「預設」）就沒 attribute、整條規則不存在，既有店家一個字都不會變。 */
        section[data-edit-target][data-body-tracking="tight"] :is(p, li, blockquote, figcaption, dd) {
          letter-spacing: -0.02em;
          --body-track: -0.02em;
        }
        section[data-edit-target][data-body-tracking="wide"] :is(p, li, blockquote, figcaption, dd) {
          letter-spacing: 0.06em;
          --body-track: 0.06em;
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

        /* 內容欄寬：editor 各 section panel「內容欄寬」四按鈕（窄 / 照原本的 / 寬 / 滿版）。
           每一段的小標、大標、說明、底下整片卡片格線都排在同一道看不見的欄裡，那道欄的
           寬度是寫死在 class 上的一個值（多數段落 max-w-5xl 也就是 64rem，照片牆 72rem），
           商家一格都碰不到。欄數那幾格已經開到 4 欄，四張卡擠在 1024px 裡每張只剩兩百多
           px 寬；反過來把照片牆當跨頁大圖用的店，兩側永遠留著一截白，做不出滿版。
           規則落在 .sproutly-section-inner（各段那層容器）上，不落在 section 自己——段落
           那一層是「寬度」（sectionWidth）在管的，那格收的是底色與外框畫到哪，跟這格收的
           不是同一層；而且那格最寬的一檔 1100px 比裡面這道 64rem 的欄還寬，所以商家把段落
           設成 boxed 時真正變窄的只有背景色塊，內容一格沒動——「怎麼調都沒反應」就是這樣來的。
           選擇器帶 section[data-edit-target][data-content-width]，比 class 上那個 max-w-5xl
           精確，蓋得掉。左右內距不動（那是全站共用的那道邊界，動了會跟導覽列與商品對不齊），
           滿版那一檔是把上限拿掉、讓內容排到那道邊界為止。沒設（或選「照原本的」）就沒
           attribute、整條規則不存在，各段維持自己原本的欄寬。 */
        section[data-edit-target][data-content-width="narrow"] .sproutly-section-inner {
          max-width: 48rem;
        }
        section[data-edit-target][data-content-width="wide"] .sproutly-section-inner {
          max-width: 80rem;
        }
        section[data-edit-target][data-content-width="full"] .sproutly-section-inner {
          max-width: none;
        }

        /* 內容欄靠哪邊：editor 各 section panel「內容欄位置」三按鈕（靠左 / 置中 / 靠右）。
           上面那組調的是欄多寬，這組調的是那道欄本身擺在段落的哪一邊——欄的位置寫死
           mx-auto 永遠置中，商家把欄收窄之後，字的左緣停在畫面正中偏左的一個誰也對不到
           的位置，雜誌那種「窄欄貼著左邊界起排」做不出來。做法跟 hero 滿版圖版型那格
           （heroTextAlignX）同一招：靠左 / 靠右各自把另一邊的 margin 留成 auto 讓欄被
           推過去。跟「區段對齊」不衝突：那格動欄裡每行字的 text-align，這格動整道欄。
           選擇器帶兩個 attribute，比 class 上那個 mx-auto 精確，蓋得掉。左右內距（欄自己
           的 px-8）不動，靠左時字的左緣剛好落在導覽列與商品共用的那道全站邊界上。
           沒設（或選「置中」）就沒 attribute、整條規則不存在，各段維持原本的置中。 */
        section[data-edit-target][data-content-align-x="left"] .sproutly-section-inner {
          margin-left: 0;
          margin-right: auto;
        }
        section[data-edit-target][data-content-align-x="right"] .sproutly-section-inner {
          margin-left: auto;
          margin-right: 0;
        }

        /* 內容欄左右內距：editor 各 section panel「內容欄內距」三按鈕（收窄 / 照原本 / 加寬）。
           上面兩組調的是欄多寬、擺哪邊，這組調的是欄自己兩側留的空白——那組值寫死在
           class 上（px-8 sm:px-12，照片牆 px-6 sm:px-10），前兩組刻意不碰它，因為它就是
           導覽列與商品共用的那道全站邊界。可是欄寬選了滿版之後，字與卡片排到哪裡停就只剩
           這道空白在決定，等於整段的邊界交給它、商家卻碰不到：想把照片牆排成幾乎頂到畫面
           邊的跨頁大圖做不到，想讓滿版段落四周留一大片白也做不到。做法跟 hero 雜誌版型那格
           （heroMagazinePadX）同一招，三檔都用 clamp：這道空白本來就是手機一個值、桌機一個
           值，給死一個數手機那端不是太擠就是只剩中間一條字。選擇器帶兩個 attribute，比
           class 上那兩個 px 精確（含 640 以上那條 media query 裡的），蓋得掉。沒設（或選
           「照原本」）就沒 attribute、整條規則不存在，各段維持原本那道邊界、跟導覽列照樣對齊。 */
        section[data-edit-target][data-content-pad-x="tight"] .sproutly-section-inner {
          padding-left: clamp(1rem, 4vw, 1.5rem);
          padding-right: clamp(1rem, 4vw, 1.5rem);
        }
        section[data-edit-target][data-content-pad-x="wide"] .sproutly-section-inner {
          padding-left: clamp(2.5rem, 9vw, 6rem);
          padding-right: clamp(2.5rem, 9vw, 6rem);
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
           object-position，這條規則落得下去。
           上下（data-media-focus）跟左右（data-media-focus-x）是兩格、各管一軸：上下那格
           剛開時只給兩檔，理由是圖框永遠比照片窄邊裁長邊、直式照片被裁的是上下——那是
           圖框比例還寫死的時候；「照片比例」開放之後橫式照片放進正方 / 直式的框，被切的
           變成左右，上下那格按了沒反應，所以補左右那格。兩格要能疊（留上緣 + 留左緣 =
           保留左上角），attribute 選擇器不可能寫遍四種組合，改成各自只設一個 CSS 變數、
           由同一條規則拼成 object-position；沒設的那一軸 fallback 回 50%（＝原本的置中）。
           兩格都沒設（或都選「置中」）就沒 attribute、整條規則不存在，照片維持置中裁。 */
        section[data-edit-target][data-media-focus="top"] {
          --sproutly-media-focus-y: 0%;
        }
        section[data-edit-target][data-media-focus="bottom"] {
          --sproutly-media-focus-y: 100%;
        }
        section[data-edit-target][data-media-focus-x="left"] {
          --sproutly-media-focus-x: 0%;
        }
        section[data-edit-target][data-media-focus-x="right"] {
          --sproutly-media-focus-x: 100%;
        }
        section[data-edit-target][data-media-focus] .sproutly-card-image img,
        section[data-edit-target][data-media-focus-x] .sproutly-card-image img {
          object-position: var(--sproutly-media-focus-x, 50%) var(--sproutly-media-focus-y, 50%);
        }

        /* 照片放不放得下整張：editor 各 section panel「照片完整度」兩按鈕（鋪滿 / 整張）。
           上面那兩欄（照片比例、照片取景）一個換框的形狀、一個選被裁時保留哪一端，但兩欄
           都還在「一定會裁」這個前提裡——框的比例是固定的、每張照片的比例不同，鋪滿就一定
           有一邊被切掉。商家最在意的那幾張（整株盆栽的全貌、水壺連把手的側面、本來就帶留白
           或邊框構圖的商品圖）要的不是裁得準一點，是一點都不要裁，原本沒有一格做得到。
           規則落在圖框裡那張 img（跟照片取景同一個位置）：要蓋掉的是圖自己帶的 object-cover
           class，段落上的 inline style 傳不下去給裡面的圖。框的比例不動——照片比原本的框窄
           或矮時，多出來的地方露出框自己的底（＝這一段的底色），看起來像照片裱在框裡，而不是
           讓卡片高度隨每張照片跳來跳去（同一列的卡片會參差不齊）。
           第二條把滑過時的放大一起關掉：那個放大會把照片撐出框外再被框裁掉，等於剛留住的
           邊又切一次，跟商家按這一格的意思相反。卡片浮起、標題字距那些照舊（那是滑鼠回饋，
           不動到照片），要一起關有「滑過卡片」那一欄。
           沒設（或選「鋪滿」）就沒 attribute、整條規則不存在，照片維持原本的鋪滿裁法。 */
        section[data-edit-target][data-media-fit="contain"] .sproutly-card-image img {
          object-fit: contain;
        }
        section[data-edit-target][data-media-fit="contain"]
          .sproutly-card:hover .sproutly-card-image img {
          transform: none;
        }

        /* 框底色：editor 各 section panel「框底色」三按鈕（跟段落 / 白 / 深），只在上一格
           選了「整張顯示」之後才長出來。整張進框之後照片放不滿的那兩條邊露出來的是圖框
           自己的底，而圖框（.sproutly-card-image）沒有自己的底、透出來的是段落底色——
           多數版型那是米色或淺灰，去背的白底商品圖放進去，照片那塊白跟框露出的米色接成
           兩截，一眼看得出「這張放不滿」；深色段落配深色構圖，邊界又整個糊掉。
           「段落底色」換的是整段連文字的底、「卡片底色」畫的是整張卡的面板，框裡那兩條邊
           都還是透的，商家原本沒有一格動得到。規則落在圖框本身（不是裡面的 img）：兩條邊
           是框露出來的地方，底要給框。慢讀那段的圖框原本掛著一個 inline 的佔位底色
           （page.tsx），商家設了這格時 page.tsx 會把那個 inline 拿掉讓路，不然 inline 會贏。
           沒設（或選「跟段落」）就沒 attribute、整條規則不存在，圖框照舊透出段落底色。 */
        section[data-edit-target][data-media-frame-bg="white"] .sproutly-card-image {
          background: #ffffff;
        }
        section[data-edit-target][data-media-frame-bg="dark"] .sproutly-card-image {
          background: #1c1917;
        }
        /* 自訂色：白 / 深是寫死的純白與暖黑，商品圖的底不一定是那兩種（圖庫圖常見 #f5f5f5
           灰白、商家自拍的淡奶油底），配純白框還是接成兩截。色值每家店不同、規則裡寫不
           出來，page.tsx 把商家的 hex 放進 --store-media-frame-bg，這裡只讀變數。
           editor 讓自訂色跟那三檔互斥，所以 "custom" 出現時三檔一定都沒設。 */
        section[data-edit-target][data-media-frame-bg="custom"] .sproutly-card-image {
          background: var(--store-media-frame-bg);
        }

        /* 合作 logo 大小：editor 合作夥伴 panel「合作 logo 大小」三按鈕（小 / 跟預設 / 大）。
           上面那四欄（照片圓角 / 比例 / 取景 / 完整度）的規則都落在卡片格線裡的圖框
           （.sproutly-card-image）上，合作那段的 logo 不在圖框裡——它是直接排在 flex 容器裡
           的 img，高度寫死 h-8 / sm:h-10 / md:h-12（32 / 40 / 48px）。那組值是照橫式字標挑的
           （寬扁、字少，48px 高就佔掉一大截寬度）；商家實際貼上來的常常是方形商圈標章、上圖
           下字的兩層式 logo、圓形品牌章，同樣 48px 高只有中間一小塊是字，客人認不出是誰。
           反過來只放兩三個大廠 logo 撐場面的店，48px 在一整排空白裡小得像註腳。
           三個寬度各給一個值，跟原本那三個 class 一樣的斷點：只寫一個高度的話，手機上會直接
           吃到桌機那個值，一排 logo 把窄螢幕擠到自動換行。這份 CSS 沒包在 @layer，選擇器
           又比 class 精確，蓋得過 h-8 那組。沒設就沒 attribute、整條規則不存在。 */
        section[data-edit-target][data-partner-logo-scale="small"] .sproutly-partner-logo {
          height: 1.5rem;
        }
        section[data-edit-target][data-partner-logo-scale="large"] .sproutly-partner-logo {
          height: 3rem;
        }
        @media (min-width: 640px) {
          section[data-edit-target][data-partner-logo-scale="small"] .sproutly-partner-logo {
            height: 1.75rem;
          }
          section[data-edit-target][data-partner-logo-scale="large"] .sproutly-partner-logo {
            height: 4rem;
          }
        }
        @media (min-width: 768px) {
          section[data-edit-target][data-partner-logo-scale="small"] .sproutly-partner-logo {
            height: 2rem;
          }
          section[data-edit-target][data-partner-logo-scale="large"] .sproutly-partner-logo {
            height: 5rem;
          }
        }

        /* 合作 logo 濃淡：editor 合作夥伴 panel「合作 logo 濃淡」三按鈕（更淡 / 跟預設 / 清楚）。
           那排 logo 一律印在 opacity 0.5 上（class 上的 opacity-50），跟一律轉黑白是同一組
           設計決定：讓它們安靜地排一列，不跟主畫面搶顏色。可是商家把媒體報導、合作品牌放上
           首頁就是要客人認出那是誰——淺灰底上再乘 0.5 的細字標，在手機上幾乎只剩一團形狀，
           而「滑鼠移上去變清楚」這件事手機根本沒有。段落層的「淡化」透明的是整段（連小標一起
           淡）、「濾鏡」換的是黑白 / 復古，都不是這一層。
           第二條 hover 一定要補：img 上帶著 hover:opacity-100，這格的規則比它精確，不補的話
           會連「滑過去變清楚」一起蓋掉——選了更淡的商家最需要那個動作還在。
           更淡給 0.3 不給更低：再低就看不出是誰的 logo，那等於把整段藏起來（要藏有「顯示 /
           隱藏」與「在哪台裝置不顯示」兩欄）。沒設就沒 attribute、整條規則不存在。 */
        section[data-edit-target][data-partner-logo-opacity="faint"] .sproutly-partner-logo {
          opacity: 0.3;
        }
        section[data-edit-target][data-partner-logo-opacity="solid"] .sproutly-partner-logo {
          opacity: 1;
        }
        section[data-edit-target][data-partner-logo-opacity="faint"] .sproutly-partner-logo:hover {
          opacity: 1;
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

        /* 卡片文字位置：editor 各 section panel「卡片文字」四按鈕（跟著整段 / 左 / 中 / 右）。
           卡片下面那幾行（品名、價錢、副標、摘要、日期）自己沒有帶對齊，一律繼承整段容器
           的 text-align——站上預設是置中，所以每張卡的字都置中；而商品列表最常見的排法是
           「段落大標置中、卡片文字靠左」（文字左緣對齊照片左緣，一整列掃下來每張卡的字才
           從同一個位置開始），商家原本沒有一格做得到：唯一動得到的「標題對齊」設的是整段
           容器，改了大標跟著跑掉。
           順帶收掉一個更難解釋的狀態：上面「內文對齊」那組規則落在段落上，卡片裡的價錢、
           副標、摘要剛好都是段落，會被一起拉走，而品名是 h3、不在那份選擇器裡，留在原地
           ——同一張卡上下兩行各自對齊。這一欄的規則把卡片裡的標題與段落一起指定，設了就
           兩行一起走。
           要直接命中卡片裡的每個文字元素，不能只在 .sproutly-card 上設一次 text-align：
           那是繼承值，而「內文對齊」那條是直接落在段落上的規則，繼承一律輸給直接命中的
           規則，只設外層的話價錢那行還是會被拉走。外層那條仍然留著，接住沒被列進來的
           元素（卡片下面那顆按鈕是 inline-flex，靠外層的 text-align 決定站哪）。
           範圍限在 .sproutly-card 裡：同一段的大標、引言不歸這一欄管（那是「標題對齊」與
           「內文對齊」的事），三個控制各管一塊才組得出上面那個排法。
           沒設（或選「跟著整段」）就沒 attribute、整條規則不存在，既有店家的卡片一個字都
           不會動。 */
        section[data-edit-target][data-card-text="left"] .sproutly-card,
        section[data-edit-target][data-card-text="left"]
          .sproutly-card :is(h3, h4, p, span, time, div) {
          text-align: left;
        }
        section[data-edit-target][data-card-text="center"] .sproutly-card,
        section[data-edit-target][data-card-text="center"]
          .sproutly-card :is(h3, h4, p, span, time, div) {
          text-align: center;
        }
        section[data-edit-target][data-card-text="right"] .sproutly-card,
        section[data-edit-target][data-card-text="right"]
          .sproutly-card :is(h3, h4, p, span, time, div) {
          text-align: right;
        }

        /* 客人的話那段的引言卡：底、框、陰影、內距、圓角原本是寫死在 page.tsx 那個
           <figure> 的 inline style 上（background: theme.bg / 1px solid theme.border /
           elev-2 / p-8 / rounded-sm）。inline 壓得過任何規則，所以「卡片外觀」那組七格
           對這一段是完全沒反應的——編輯器裡四排按鈕按得動，畫面一動也不動，商家會以為
           功能壞了。五個值原樣搬進這一條，--store-bg 與 --store-border 就是 theme.bg 與
           theme.border（見 _theme.ts 那份變數表），商家沒設外觀時算出來逐像素一樣。
           這段跟數字段、合作段不一樣的地方是它本來就長得像一張卡，所以多需要下面那條
           歸零：商家按「淡底色」時要的是那一檔的底，而不是原本那圈框跟陰影再加一層底。 */
        .sproutly-quote-card {
          padding: 2rem;
          border-radius: 2px;
          background: var(--store-bg, #ffffff);
          border: 1px solid var(--store-border, rgba(0,0,0,0.12));
          box-shadow: var(--sproutly-elev-2);
        }
        /* 商家一設外觀就把原本那身打扮收掉，剩下的交給底下那一整組（底 / 框 / 內距 /
           圓角 / 陰影 / 框線三格 / 底色深淺）——不收的話「一圈細框」會變成兩圈框（原本的
           實色框加上新的淡色框）、「淡底色」會變成底＋框＋陰影，而選「陰影：無」的商家
           拿掉的也不是他看到的那層。這一條的分量跟底下那組一樣重（都是
           section[data-edit-target][data-card-surface] 加一個 class），靠排在它們前面
           讓每一格各自蓋回自己那個屬性，沒被蓋到的就維持歸零後的樣子。
           內距與圓角跟著回到那組的 14px：引言卡原本的 32px 是照這一段自己挑的，商家要
           寬一點按「卡片內距：放寬」（22px）。 */
        section[data-edit-target][data-card-surface] .sproutly-quote-card {
          background: transparent;
          border: none;
          box-shadow: none;
        }

        /* Promise 那段中間那張引言卡：跟上面客人的話那段同一個毛病，底、框、陰影、內距、
           圓角五個值原本寫死在 page.tsx 那個 <figure> 上（background: theme.surface /
           1px solid theme.border / elev-3 / px-8 py-16 sm:px-16 sm:py-24 / rounded-sm），
           所以「卡片外觀」那組七格對這一段完全沒反應。五個值原樣搬進這兩條，
           --store-surface 與 --store-border 就是 theme.surface 與 theme.border（見
           _theme.ts 那份變數表），商家沒設外觀時算出來逐像素一樣。
           內距不留在 class 上是因為 Tailwind 的 px-8 那組跟這一條一樣重（都是一個 class），
           誰贏要看兩份樣式表誰排在後面——搬進來才確定得下來。 */
        .sproutly-promise-card {
          padding: 4rem 2rem;
          border-radius: 2px;
          background: var(--store-surface, #ffffff);
          border: 1px solid var(--store-border, rgba(0,0,0,0.12));
          box-shadow: var(--sproutly-elev-3);
        }
        @media (min-width: 640px) {
          .sproutly-promise-card {
            padding: 6rem 4rem;
          }
        }
        /* 商家一設外觀就把原本那身打扮收掉，理由跟引言卡那條一樣：不收的話「一圈細框」
           會變兩圈框、「淡底色」會變底＋框＋陰影，選「陰影：無」拿掉的也不是他看到的
           那一層。內距不在這裡收——那組給的 8 / 14 / 22px 是照一列三四張的小卡挑的，
           套在這張佔滿一整段、中間一句大字的卡上會變成字貼著框；另外拿一組尺寸接，
           寫在那組後面（見底下「引言卡的內距」）。 */
        section[data-edit-target][data-card-surface] .sproutly-promise-card {
          background: transparent;
          border: none;
          box-shadow: none;
        }

        /* 常見問題那段的每一題：原本是一條一條的橫線把題目隔開（每題上面一條、最後一題
           下面再補一條），線的顏色寫在 page.tsx 每個 li 的 inline style 上。跟引言卡同一
           個毛病——inline 壓得過任何規則，商家按「一圈細框」時框的顏色會被那個 inline 的
           顏色蓋掉；線的粗細又是 Tailwind 的 border-t 給的，收不乾淨就會變成「一張卡的
           上面還橫著一條線」。所以線原樣搬進這一條，--store-border 就是 theme.border
           （見 _theme.ts 那份變數表），商家沒設外觀時算出來逐像素一樣。 */
        .sproutly-faq-item {
          border-top: 1px solid var(--store-border, rgba(0,0,0,0.12));
        }
        .sproutly-faq-item:last-child {
          border-bottom: 1px solid var(--store-border, rgba(0,0,0,0.12));
        }
        /* 商家一設外觀就把那幾條線收掉，剩下的交給底下那一整組。這條的分量壓得過上面
           那兩條，也排在底下那組前面，所以每一格照樣各自蓋回自己那個屬性。 */
        section[data-edit-target][data-card-surface] .sproutly-faq-item {
          border: none;
        }
        /* 一題一張卡之後題跟題之間要留一截：原本是靠共用一條線接在一起的清單，卡片黏在
           一起會變成一整塊分不出幾題。10px 是「看得出是分開的兩張、又還讀得出是同一組」
           的距離，比段落自己的「卡片間距」小一號——那格調的是左右分欄的卡片，這段是直
           著疊的。 */
        section[data-edit-target][data-card-surface] .sproutly-faq-item + .sproutly-faq-item {
          margin-top: 10px;
        }
        /* 題目那行原本上下各留 24px，是給客人點的範圍（整行都可以點開）。套上卡片之後
           卡片自己那圈內距（14 / 8 / 22px）加在外面，兩個疊起來一題會胖到 76px 以上，
           一整段拉得老長。收成 10px，加上卡片內距仍有 24px 以上可以點，手指按得到。
           答案那段底下的留白同理跟著收，右邊那 32px 是原本讓字不要頂到加號的，卡片內距
           已經接手，收成 8px。 */
        section[data-edit-target][data-card-surface] .sproutly-faq-item .sproutly-faq-q {
          padding-top: 10px;
          padding-bottom: 10px;
        }
        section[data-edit-target][data-card-surface] .sproutly-faq-item .sproutly-faq-a {
          padding-bottom: 10px;
          padding-right: 8px;
        }

        /* 卡片外觀：editor 各 section panel「卡片外觀」三按鈕（原樣 / 面板 / 外框）。
           站上的卡片一律是「照片 + 底下裸著的幾行字」直接浮在段落底色上，卡片自己沒有
           邊界——那是雜誌感的排法，商品少、留白多的時候好看；但欄數調到 3、4 欄之後，
           或每張卡的品名長短不一，一整列看起來就是一堆散字，客人分不出哪行字屬於哪張
           照片（網購站的商品卡幾乎都有底或有框就是為了這個）。商家原本沒有一格做得到：
           段落自己的「底色 / 外框 / 圓角 / 陰影」畫的是整段的外圍，一段一個框，分不到
           每張卡身上；「卡片間距」調的是卡片之間的距離，卡片本身還是裸的。
           底與框的顏色走 currentColor 的淡色（跟底紋 texture、底色明暗 bgGradient 同一個
           口徑）：深底淺字的段落自動變成淺色面板與淺色框，商家不用再挑一次顏色。
           照片自己那圈陰影一起收掉（連 hover 那一段）——卡片已經有邊界，照片再浮一次
           會變成框裡還有框；浮起改由整張卡做，不然照片會浮出卡片的內距、看起來像要
           掉出來。商家已經把「滑過卡片」設成不動的那一檔不補這個浮起（那正是他按掉的
           東西），設成輕微的沿用它那 2px。
           沒設（或選「原樣」）就沒 attribute、整組規則不存在，既有店家的卡片一動不動。

           底下每一條的 :is(.sproutly-card, .sproutly-card-box) 是為了數字段與合作 logo 段：
           那兩段一格一格的東西不是商品卡（沒有圖框、沒有品名價錢那疊字），所以本來就沒帶
           .sproutly-card，這一整組七格對它們是完全沒反應的——編輯器裡按得動，畫面上什麼
           都不會變。不直接把 .sproutly-card 補到那兩段身上是因為那個 class 還帶著一組跟
           卡片外觀無關、而且沒有 attribute 擋著的規則（上面那批：滑過時品名字距撐開、
           副文字變濃、按鈕浮現、圖框浮起），補了等於那兩段沒設任何東西也先變了樣。
           .sproutly-card-box 只是「這一格是一個可以套底或套框的方塊」，不帶那些動作；
           兩個名字寫進同一個 :is()，分量取自最重的那個＝跟原本的單一 class 一樣重，
           排在後面的規則照樣壓得過前面的，既有四段一個像素都沒動。 */
        section[data-edit-target][data-card-surface] :is(.sproutly-card,.sproutly-card-box) {
          padding: 14px;
          border-radius: 14px;
          transition: box-shadow 0.7s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
        }
        section[data-edit-target][data-card-surface="panel"] :is(.sproutly-card,.sproutly-card-box) {
          background: color-mix(in srgb, currentColor 6%, transparent);
        }
        section[data-edit-target][data-card-surface="outline"] :is(.sproutly-card,.sproutly-card-box) {
          border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        }
        /* 底＋框那一檔：上面兩條各給一半，這檔兩個一起。底不重複用 6%——底跟線都從
           currentColor 算，6% 的底配 16% 的線兩層差得太近，遠看是一塊邊緣糊掉的板子；
           底收成 4%、線加到 22%，卡片才是「一塊淺板子被一條看得見的線收住邊」。
           要另外的深淺照樣用底下那兩組（框線粗細 / 深淺 / 樣式、底色深淺），這檔全部可調。 */
        section[data-edit-target][data-card-surface="both"] :is(.sproutly-card,.sproutly-card-box) {
          background: color-mix(in srgb, currentColor 4%, transparent);
          border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        }

        /* 卡片內距：editor 各 section panel「卡片內距」三按鈕（收緊 / 跟預設 / 放寬），
           設了上面那個底或框之後才長出來。卡片裡的東西跟框之間留多少，上面那條寫死 14px
           ——那個值配站上預設那種一列三張、品名兩三個字的卡剛好，換成商家自己的東西常常
           不對：一列一張、照片在左的清單模式，14px 貼著照片邊緣像沒留白；一列四張的小卡
           只有品名跟價錢兩行，同樣 14px 佔的比例大得多，照片被框擠小。
           商家原本沒有一格動得到——「卡片間距」調的是卡片彼此之間、「區段空白」與
           「上下外距」調的是段落外圍，卡片裡面那圈一動也不動。
           圓角跟著等比走（8 / 14 / 22px）：內距收緊還留 14px 的圓角，框的四角會比裡面的
           照片圓得多，變成兩個對不上的形狀。
           沒設（或選「跟預設」）就沒 attribute，維持上面那組 14px。 */
        section[data-edit-target][data-card-surface][data-card-padding="tight"] :is(.sproutly-card,.sproutly-card-box) {
          padding: 8px;
          border-radius: 8px;
        }
        section[data-edit-target][data-card-surface][data-card-padding="loose"] :is(.sproutly-card,.sproutly-card-box) {
          padding: 22px;
          border-radius: 22px;
        }

        /* 引言卡的內距：Promise 那段只有一張卡，佔滿整段的寬、中間一句大字，上面那組的
           8 / 14 / 22px 是照一列三四張的小卡挑的，套上去會變成一句大字四邊各貼著框 14px，
           而且那兩個大引號是釘在卡片左上、右下各 2rem 的位置，內距一收就直接壓到字上。
           所以這一段另外接一組尺寸，三檔對應同樣那三顆按鈕（收緊 / 跟預設 / 放寬），
           手機與 640px 以上各一份（原本那張卡就是 2rem→4rem 這樣長的）。
           三檔都寫是因為分量算法：上面那組的收緊 / 放寬帶了兩個屬性選擇器，比這裡只帶
           一個的基準重，只寫基準的話商家一按收緊還是會掉回 8px。同樣重的就靠排在後面贏。
           圓角照上面那組走，不另外接——一整塊大板子的四個角本來就該跟其他段的卡片同口徑。 */
        section[data-edit-target][data-card-surface] .sproutly-promise-card {
          padding: 4rem 2rem;
        }
        section[data-edit-target][data-card-surface][data-card-padding="tight"] .sproutly-promise-card {
          padding: 2.5rem 1.5rem;
        }
        section[data-edit-target][data-card-surface][data-card-padding="loose"] .sproutly-promise-card {
          padding: 5.5rem 3rem;
        }
        @media (min-width: 640px) {
          section[data-edit-target][data-card-surface] .sproutly-promise-card {
            padding: 6rem 4rem;
          }
          section[data-edit-target][data-card-surface][data-card-padding="tight"] .sproutly-promise-card {
            padding: 3.5rem 2.5rem;
          }
          section[data-edit-target][data-card-surface][data-card-padding="loose"] .sproutly-promise-card {
            padding: 8rem 5.5rem;
          }
        }

        /* 來坐坐那段的內距：跟引言卡同一個處境——整段就一塊資訊（地址、營業時間、電話
           email、地圖疊成一直排），共用那組 8 / 14 / 22px 是照一列三四張的小卡挑的，套上去
           會變成一整欄字四邊各貼著框 14px。所以這一段也另外接一組，三檔對應同樣那三顆
           按鈕（收緊 / 跟預設 / 放寬），手機與 640px 以上各一份。
           比引言卡收一點（那張卡中間只有一句大字，四周需要很多空；這塊是一疊要讀的資訊，
           留太多會把地圖推到很下面）。三檔都寫的理由跟引言卡一樣：共用那組的收緊 / 放寬
           多帶一個屬性選擇器、分量比較重，只寫基準會被壓回 8px。圓角照共用那組走。 */
        section[data-edit-target][data-card-surface] .sproutly-visit-card {
          padding: 2.5rem 1.75rem;
        }
        section[data-edit-target][data-card-surface][data-card-padding="tight"] .sproutly-visit-card {
          padding: 1.5rem 1.25rem;
        }
        section[data-edit-target][data-card-surface][data-card-padding="loose"] .sproutly-visit-card {
          padding: 4rem 2.75rem;
        }
        @media (min-width: 640px) {
          section[data-edit-target][data-card-surface] .sproutly-visit-card {
            padding: 3.5rem 3rem;
          }
          section[data-edit-target][data-card-surface][data-card-padding="tight"] .sproutly-visit-card {
            padding: 2.25rem 2rem;
          }
          section[data-edit-target][data-card-surface][data-card-padding="loose"] .sproutly-visit-card {
            padding: 5rem 4rem;
          }
        }


        /* 卡片圓角：editor 各 section panel「卡片圓角」三按鈕（直角 / 跟內距走 / 更圓），
           跟內距一樣設了底或框之後才長出來。上面那兩組把圓角綁在內距上，商家想單獨動
           四個角時只能靠改內距換——走硬邊排版的店要的是完全直角（收到最緊還是 8px 的圓），
           想要更圓的卡又得把內距一起放寬、卡片跟著變胖。這兩條只改 border-radius，內距
           那格照原樣。選擇器的分量跟上面那兩組一樣重，靠排在後面壓過它們算出來的圓角。
           沒設（或選「跟內距走」）就沒 attribute，維持原本 8 / 14 / 22px 那組。 */
        section[data-edit-target][data-card-surface][data-card-radius="square"] :is(.sproutly-card,.sproutly-card-box) {
          border-radius: 0;
        }
        section[data-edit-target][data-card-surface][data-card-radius="round"] :is(.sproutly-card,.sproutly-card-box) {
          border-radius: 26px;
        }
        section[data-edit-target][data-card-surface] :is(.sproutly-card,.sproutly-card-box) .sproutly-card-image,
        section[data-edit-target][data-card-surface] :is(.sproutly-card,.sproutly-card-box):hover .sproutly-card-image {
          box-shadow: none;
        }
        section[data-edit-target][data-card-surface]:not([data-card-hover="none"])
          :is(.sproutly-card,.sproutly-card-box):hover .sproutly-card-image {
          transform: none;
        }
        /* 下面兩條的 :not(.sproutly-card-static) 是給「點不下去的那幾塊」開的例外。
           設了卡片外觀之後，滑鼠移到卡片上整張會往上浮一段、底下多一層陰影——那是
           商品卡的動作，浮起來等於在說「這張可以點進去」。但掛 card-box 的方塊裡有
           一半根本點不動：店家那句話、客人的話、數字、沒填連結的合作 logo、來坐坐那塊
           店家資訊，滑上去浮一下、移開又掉回去，客人會以為是自己沒點到。
           會動的那些照舊：常見問題每一題是點開收合的、合作 logo 有填連結那顆是連結，
           商品卡（.sproutly-card）本來就整張可點，三種都不掛 static、動作一格不變。
           分不掛 static 的方式是在 page.tsx 那邊標，不是在這裡列名單——同一個 class
           在不同段落有時可點有時不可點（合作 logo 那格就是），CSS 這層看不出來。
           「滑過卡片」那三顆按鈕商家還是照按，只是對點不下去的方塊按了不會有事；
           沒設卡片外觀就沒 attribute、整組規則不存在，既有店家逐像素不變。 */
        section[data-edit-target][data-card-surface]:not([data-card-hover="none"])
          :is(.sproutly-card,.sproutly-card-box):not(.sproutly-card-static):hover {
          transform: translateY(-6px);
          box-shadow: var(--sproutly-elev-3);
        }
        section[data-edit-target][data-card-surface][data-card-hover="calm"]
          :is(.sproutly-card,.sproutly-card-box):not(.sproutly-card-static):hover {
          transform: translateY(-2px);
          box-shadow: none;
        }

        /* 卡片陰影：editor 各 section panel「卡片陰影」三按鈕（無 / 輕 / 明顯），跟圓角、
           內距一樣設了底或框之後才長出來。上面那組只在滑過時給卡片一層陰影，靜止時是完全
           平貼在段落底色上的方塊——「面板」那檔的底是 currentColor 的 6%，淺底的店看不出
           卡片跟背景的界線；手機根本沒有滑過這件事，那層陰影客人一輩子看不到。
           要動的是卡片自己靜止的那層 box-shadow，段落上的 inline style 到不了卡片那層，
           跟內距、圓角同一個處境同一個解法。
           輕用 elev-2（照片原本那圈陰影的值，設了卡片外觀之後照片那圈被收掉，等於搬到
           卡片外框上）、明顯用 elev-3（滑過時浮起的那一層）。
           下面兩條是給「滑過卡片＝輕微」那檔補的：它原本把滑過的陰影收成 none（為平的卡片
           寫的），設了這格之後要把靜止那層留著，不然滑上去反而變平。分量比它重一個屬性，
           排在後面也壓得過。
           沒設（或選「無」）就沒 attribute、整組規則不存在，卡片維持原本靜止時沒有陰影。 */
        section[data-edit-target][data-card-surface][data-card-shadow="soft"] :is(.sproutly-card,.sproutly-card-box) {
          box-shadow: var(--sproutly-elev-2);
        }
        section[data-edit-target][data-card-surface][data-card-shadow="strong"] :is(.sproutly-card,.sproutly-card-box) {
          box-shadow: var(--sproutly-elev-3);
        }
        section[data-edit-target][data-card-surface][data-card-hover="calm"][data-card-shadow="soft"]
          :is(.sproutly-card,.sproutly-card-box):not(.sproutly-card-static):hover {
          box-shadow: var(--sproutly-elev-2);
        }
        section[data-edit-target][data-card-surface][data-card-hover="calm"][data-card-shadow="strong"]
          :is(.sproutly-card,.sproutly-card-box):not(.sproutly-card-static):hover {
          box-shadow: var(--sproutly-elev-3);
        }

        /* 卡片框線粗細與深淺：editor 各 section panel 的「框線粗細」（照原本 / 中 / 粗）與
           「框線深淺」（照原本 / 淡 / 明顯），只有畫面上真的有那條線的兩檔（一圈細框 / 底＋框）才長出來
           （面板那檔畫的是底色，沒有線可以加粗或加深）。
           上面那條 outline 把線寫死成 1px 加 currentColor 的 16%——又細又淡，配站上預設那種
           留白多的排法剛好，但商家按下「外框」多半就是嫌卡片沒有邊界：3、4 欄的小卡排滿
           一整片時那條線在遠一點的距離上等於不存在，設了外觀看到的還是一堆散字。反方向是
           走報紙、型錄那種硬邊排版的店，框是版面的主角、要看得見的實線。
           粗細與深淺分兩格是因為兩件事會互相拖：3px 配 16% 是一條糊掉的灰帶不是框（粗線
           更需要色夠實才收得住邊），想要一條看得見但不搶戲的細框又不該連重量一起加。
           兩格各自只改 border 的一段（width 或 color），另一段照原樣；兩格都設就疊起來。
           選擇器多帶一個 :is(outline, both)，分量跟上面那兩條一樣重，靠排在後面壓過。沒設就沒 attribute，線維持原本的 1px 加 16%。 */
        section[data-edit-target]:is([data-card-surface="outline"],[data-card-surface="both"])[data-card-border-weight="medium"]
          :is(.sproutly-card,.sproutly-card-box) {
          border-width: 2px;
        }
        section[data-edit-target]:is([data-card-surface="outline"],[data-card-surface="both"])[data-card-border-weight="thick"]
          :is(.sproutly-card,.sproutly-card-box) {
          border-width: 3px;
        }
        section[data-edit-target]:is([data-card-surface="outline"],[data-card-surface="both"])[data-card-border-tone="soft"]
          :is(.sproutly-card,.sproutly-card-box) {
          border-color: color-mix(in srgb, currentColor 8%, transparent);
        }
        section[data-edit-target]:is([data-card-surface="outline"],[data-card-surface="both"])[data-card-border-tone="strong"]
          :is(.sproutly-card,.sproutly-card-box) {
          border-color: color-mix(in srgb, currentColor 34%, transparent);
        }

        /* 卡片框線樣式：editor 各 section panel 的「框線樣式」（實線 / 虛線 / 點線），跟
           上面兩格同一個條件——一圈細框與底＋框那兩檔才長出來。
           上面那條 outline 把 border-style 寫死成 solid，粗細與深淺再怎麼配，畫出來永遠是
           一圈規規矩矩的實線；那條線在版面上講的是「這是一張已經定案的卡」。虛線與點線
           講的是相反的話——預告、缺貨、還沒上架的佔位卡，站上目前只能靠文字寫「即將推出」，
           框看起來跟正在賣的商品一模一樣；點線則是拼貼、手作那類店的排版語言。
           段落自己的「外框樣式」畫的是整段外圍那個大框、「分隔線樣式」動的是段落上下那條
           橫線，兩個都到不了每張卡身上。
           跟上面兩格一樣只改 border 的一段（style），寬度與顏色照原樣，三格疊得起來——
           1px 的虛線遠看斷斷續續讀不出是虛的，配 2px 以上才成立。
           選擇器同樣多帶一個 :is(outline, both)，靠排在後面壓過上面那兩條。
           沒設就沒 attribute，線維持原本的實線。 */
        section[data-edit-target]:is([data-card-surface="outline"],[data-card-surface="both"])[data-card-border-style="dashed"]
          :is(.sproutly-card,.sproutly-card-box) {
          border-style: dashed;
        }
        section[data-edit-target]:is([data-card-surface="outline"],[data-card-surface="both"])[data-card-border-style="dotted"]
          :is(.sproutly-card,.sproutly-card-box) {
          border-style: dotted;
        }

        /* 卡片底色深淺：editor 各 section panel 的「底色深淺」（照原本 / 淡 / 明顯），
           條件跟上面那三格相反——有底的那兩檔（一塊底色面板 / 底＋框）才長出來（只有
           一圈細框那檔畫的是線，沒有底可以調深淺）。
           上面那條 panel 把底寫死成 currentColor 的 6%。那個值是照站上預設那種奶油白底、
           深色字的段落挑的，換成商家自己的配色就常常不對：整段底色本來就是淺灰、米色那類
           的店，卡片那層 6% 疊上去幾乎跟背景同一色，商家按了面板卻看不出卡片在哪；反方向
           是深底淺字的段落，同樣的 6% 變成淺色疊在深底上，對比比淺底那邊強得多、一片卡片
           牆亮得比照片還搶。
           淡那檔是「隱約分得出這是一張卡」（照片很滿的商品卡、照片牆，底重一點就跟照片
           打架）；明顯那檔是「卡片是一塊實實在在的板子」（字多照片少的段落，底夠實才撐得
           住整段文字）。
           跟框線那三格一樣只改一個屬性（background），其他照原樣；選擇器多帶一個 :is(panel, both)，
           靠排在後面壓過上面那兩條。
           沒設就沒 attribute，底維持原本的 6%。 */
        section[data-edit-target]:is([data-card-surface="panel"],[data-card-surface="both"])[data-card-panel-tone="soft"]
          :is(.sproutly-card,.sproutly-card-box) {
          background: color-mix(in srgb, currentColor 3%, transparent);
        }
        section[data-edit-target]:is([data-card-surface="panel"],[data-card-surface="both"])[data-card-panel-tone="strong"]
          :is(.sproutly-card,.sproutly-card-box) {
          background: color-mix(in srgb, currentColor 12%, transparent);
        }

        /* 卡片排法：editor 各 section panel「卡片排法」兩按鈕（照片在上 / 照片在左）。
           站上每一段的卡片都是同一種排法——照片在上，品名、價錢、摘要在下面疊成一落。
           那是格子牆的排法，客人一眼掃過整片照片；但同一批商品換成「一列一張、照片在左、
           字在右」（一般網購站的清單模式）之後，同一個螢幕高度看得到的品項多得多、品名
           與描述也有寬度寫得完整，慢讀區那種一段文字配一張圖的卡片更是本來就該橫著排。
           商家原本沒有一格做得到：「卡片外觀」給的是邊界、「卡片文字」給的是字站哪、
           「欄數」調的是一列幾張，三個都不會把照片從上面搬到左邊。
           卡片裡是平的一疊（圖框、品名、價錢各自是卡片的直接子元素，中間沒有包一層文字
           容器），所以不能只把卡片改成兩欄——那樣每個元素會各占一格。改成格線之後把圖框
           釘在左欄、跨滿右邊那疊文字的高度（span 12 是留寬一點的上限，用不到的列是 0 高，
           列距設 0 才不會多出空隙），其餘子元素一律指到右欄，順著原本的順序往下排。
           圖框設 align-self: start 讓它照自己的比例決定高度（不然會被拉成跟文字一樣高，
           「照片比例」那一欄就失效了）；右欄第一行的上留白清掉——那是照片在上時用來跟
           照片隔開的距離，橫著排之後變成把字整片往下推。
           手機自動收成一列一張：半個螢幕寬的卡片再切成左圖右字，照片只剩一小格，那不是
           商家按這一格想要的東西。收的是卡片格線的欄數，要壓過格線上 Tailwind 那個
           grid-cols-2（屬性選擇器的權重高過單一 class，蓋得掉）。
           沒設（或選「照片在上」）就沒 attribute、整組規則不存在，卡片維持原本的排法。
           照片在右（side-reverse）走同一組規則，只換左右兩欄的寬度與各自放誰——選擇器用
           開頭比對（^="side"）一次接住兩檔，下面再單獨蓋照片在右那檔要換的三行。 */
        section[data-edit-target][data-card-layout^="side"] .sproutly-card {
          display: grid;
          grid-template-columns: minmax(0, 38%) minmax(0, 1fr);
          column-gap: clamp(12px, 2vw, 24px);
          row-gap: 0;
        }
        section[data-edit-target][data-card-layout^="side"]
          .sproutly-card > .sproutly-card-image {
          grid-column: 1;
          grid-row: 1 / span 12;
          align-self: start;
        }
        section[data-edit-target][data-card-layout^="side"]
          .sproutly-card > *:not(.sproutly-card-image) {
          grid-column: 2;
          min-width: 0;
        }
        section[data-edit-target][data-card-layout^="side"]
          .sproutly-card > .sproutly-card-image + * {
          margin-top: 0;
        }
        /* 照片在右：寬的那欄換到左邊、圖框指到右欄、其餘子元素指到左欄。不用 direction 或
           order 反轉——圖框是跨 12 列的那格，靠明確指定欄位最不會跟其他規則打架。 */
        section[data-edit-target][data-card-layout="side-reverse"] .sproutly-card {
          grid-template-columns: minmax(0, 1fr) minmax(0, 38%);
        }
        section[data-edit-target][data-card-layout="side-reverse"]
          .sproutly-card > .sproutly-card-image {
          grid-column: 2;
        }
        section[data-edit-target][data-card-layout="side-reverse"]
          .sproutly-card > *:not(.sproutly-card-image) {
          grid-column: 1;
        }
        /* 照片佔寬：editor 各 section panel「照片佔寬」三按鈕（跟預設 / 小張 / 大張）。
           上面那組橫排規則把左右兩欄寫死成 38% 對 1fr，那個比例是照站上目前的內容挑的：
           慢讀那種一段文字配一張圖的段落嫌照片太小（配橫幅生活照時只剩縮圖大），只列品名
           跟價錢的商品清單又嫌字那欄太寬（右邊空一大片）。商家原本沒有一格動得到——欄數
           調的是一列排幾張、卡片間距調的是卡片之間的距離、照片比例調的是照片自己是方是長。
           要兩個 attribute 一起命中才成立（沒設成橫排的段落按了不會亂動版面），照片在右
           那檔左右兩欄的寬度是對調的，所以兩檔各寫一條。
           手機不用管：640 以下卡片已經被下面那條收成上下排，沒有左右兩欄可分。 */
        section[data-edit-target][data-card-layout="side"][data-card-media-width="narrow"]
          .sproutly-card {
          grid-template-columns: minmax(0, 25%) minmax(0, 1fr);
        }
        section[data-edit-target][data-card-layout="side"][data-card-media-width="wide"]
          .sproutly-card {
          grid-template-columns: minmax(0, 50%) minmax(0, 1fr);
        }
        section[data-edit-target][data-card-layout="side-reverse"][data-card-media-width="narrow"]
          .sproutly-card {
          grid-template-columns: minmax(0, 1fr) minmax(0, 25%);
        }
        section[data-edit-target][data-card-layout="side-reverse"][data-card-media-width="wide"]
          .sproutly-card {
          grid-template-columns: minmax(0, 1fr) minmax(0, 50%);
        }
        @media (max-width: 639px) {
          section[data-edit-target][data-card-layout^="side"] .sproutly-card-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        /* 手機一列幾張：editor 各 section panel「手機一列幾張」三按鈕（跟預設 / 一張 / 兩張）。
           每一段在手機上一列幾張是寫死在該段格線 class 裡的：選物、精選、照片牆、數字一律
           兩張，慢讀、客人的話一律一張。那組值是照站上目前的預設內容挑的，換成商家自己的
           東西就不一定對——賣小盆栽、配件的店，一列兩張在手機上每張只剩半個螢幕寬，商品照
           小到看不出差別；反過來照片牆放的是橫幅生活照、精選只有兩三樣主打商品時，一列一張
           才看得清楚。商家原本沒有一格動得到：「一列幾張」那幾個欄位調的是 md 以上那組，
           手機那組不跟著動；「卡片間距」只縮距離，張數一樣。
           規則只落在 .sproutly-card-grid（跟卡片間距同一個掛點），所以合作 logo 那段的
           flex-wrap 排法不受影響——那一段本來就是一排排到滿自動換行，沒有欄數這回事。
           要壓過格線上 Tailwind 的 grid-cols-1 / grid-cols-2，屬性選擇器的權重夠高蓋得掉。
           放在上面那條「卡片排法」的手機規則後面是刻意的：兩條選擇器權重一樣，後面的贏，
           也就是商家自己按的張數蓋過照片在左時自動收成一列一張那個預設。
           沒設（或選「跟預設」）就沒 attribute、整組規則不存在。 */
        @media (max-width: 639px) {
          section[data-edit-target][data-mobile-cols="one"] .sproutly-card-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          section[data-edit-target][data-mobile-cols="two"] .sproutly-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        /* 卡片標題行數：editor 各 section panel「卡片標題行數」四按鈕（跟預設 / 一行 / 兩行 / 完整）。
           精選商品那段的品名寫死只顯示一行（Tailwind 的 line-clamp-1，超過就切掉接刪節號，
           逛街頁、收藏頁同一套），品名帶規格的店在首頁只看得到前半段，客人分不出同系列的
           兩樣商品差在哪；反過來選物、慢讀那兩段的標題完全不截，商家自己打了長標題就把那張
           卡撐高、同一列其他卡片下面空一截。兩邊都是寫死的，商家原本沒有一格動得到：
           「卡片文字」設的是那幾行站哪、「卡片外觀」給的是邊界，都不管一行字寫不寫得完。
           要蓋掉的是品名自己帶的 class，段落上的 inline style 傳不下去——跟卡片文字、卡片
           外觀同一個處境同一個解法，attribute 讓這裡補一組更精確的規則壓過去。
           截斷要四個屬性一起才成立（-webkit-box + 直向排列 + 行數 + 藏掉溢出），少一個就完全
           沒反應；完整那一檔則要把四個逐一還原，只清行數的話 display 還是 -webkit-box、
           溢出照樣被藏。line-clamp 標準版與 -webkit- 前綴版都寫，前者是規格、後者是目前
           瀏覽器實際吃的那個。
           正在改字的那行（雙擊進入 inline 編輯、帶 contenteditable）暫時解開截斷：商家打
           到第二行以後看不到自己在打什麼，那時候讓他看得完整比預覽準確重要，放開手就收回。 */
        section[data-edit-target]:is([data-card-title-lines="one"], [data-card-title-lines="two"])
          .sproutly-card-title {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        section[data-edit-target][data-card-title-lines="one"] .sproutly-card-title {
          -webkit-line-clamp: 1;
          line-clamp: 1;
        }
        section[data-edit-target][data-card-title-lines="two"] .sproutly-card-title {
          -webkit-line-clamp: 2;
          line-clamp: 2;
        }
        section[data-edit-target][data-card-title-lines="full"] .sproutly-card-title {
          display: block;
          overflow: visible;
          -webkit-line-clamp: unset;
          line-clamp: unset;
        }
        section[data-edit-target][data-card-title-lines]
          .sproutly-card-title[contenteditable="true"] {
          display: block;
          overflow: visible;
          -webkit-line-clamp: unset;
          line-clamp: unset;
        }

        /* 卡片描述行數：editor 各 section panel「卡片描述行數」五按鈕（跟預設 / 一行 / 兩行 /
           三行 / 完整）。品名底下那段描述完全不截，商家自己打多長就佔多高——選物那段的副標、
           慢讀那段的摘要，一張卡兩行、隔壁五行的話同一列卡片下緣參差不齊，卡片外觀設成面板
           或框的時候尤其明顯（一個框矮一個框高）。上一格「卡片標題行數」只管品名那行，管不到
           這裡。要蓋的是描述那行自己帶的 class，段落上的 inline style 傳不下去，一樣靠
           attribute 補一組更精確的規則。
           規則落在 .sproutly-card-desc，只掛在真的是描述的那些行（選物副標、慢讀摘要、
           相簿照片下那行、客人的話那則留言）：精選那段同一個位置放的是價錢，截價錢對客人
           沒有意義；常見問題那行是答案，截掉等於把內容藏起來又沒地方展開，兩段都不掛。
           截斷同樣要四個屬性一起才成立（-webkit-box + 直向排列 + 行數 + 藏掉溢出），完整那
           一檔要逐一還原；正在改字那行（contenteditable）暫時解開，理由同標題那組。 */
        section[data-edit-target]:is(
            [data-card-desc-lines="one"],
            [data-card-desc-lines="two"],
            [data-card-desc-lines="three"]
          )
          .sproutly-card-desc {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        section[data-edit-target][data-card-desc-lines="one"] .sproutly-card-desc {
          -webkit-line-clamp: 1;
          line-clamp: 1;
        }
        section[data-edit-target][data-card-desc-lines="two"] .sproutly-card-desc {
          -webkit-line-clamp: 2;
          line-clamp: 2;
        }
        section[data-edit-target][data-card-desc-lines="three"] .sproutly-card-desc {
          -webkit-line-clamp: 3;
          line-clamp: 3;
        }
        section[data-edit-target][data-card-desc-lines="full"] .sproutly-card-desc {
          display: block;
          overflow: visible;
          -webkit-line-clamp: unset;
          line-clamp: unset;
        }
        section[data-edit-target][data-card-desc-lines]
          .sproutly-card-desc[contenteditable="true"] {
          display: block;
          overflow: visible;
          -webkit-line-clamp: unset;
          line-clamp: unset;
        }

        /* 卡片標題字級：editor 各 section panel「卡片標題字級」三按鈕（小 / 跟預設 / 大）。
           上面兩組管的是品名佔幾行、被不被截，這組管的是那行字本身多大。各段是寫死的：
           選物與慢讀 18px（桌機 20px）、精選商品 16px，照站上預設那種一列三張、品名兩三個
           字的卡挑的。商家把欄數調成 2、或卡片排法設成照片在左的清單模式之後，卡片寬了一倍，
           16px 的品名在那麼大一張卡上小得像圖說，客人一眼掃過去先看到價錢不是商品；反過來
           一列四張的小卡配長品名，18px 佔掉卡片下半兩行、把照片擠小。慢讀那種文章卡想讓
           標題像標題（現在跟商品品名同一級）也一樣沒得調。
           要蓋掉的是品名那行自己帶的 text-base / text-lg class：段落上調字級的那幾欄，
           「標題大小」動的是大標、「全網站字體大小」動的是內文那一層、「小標字級」動的是
           eyebrow，都到不了卡片裡的 h3——跟小標字級那組同一個處境同一個解法，attribute 讓
           這裡補一條更精確的規則（這份 CSS 沒包在 @layer，贏在 @layer utilities 的
           Tailwind 工具類）。
           用 zoom 不用 font-size：三段的 16 / 18 / 20px 是各段自己挑的差別，寫死一個
           font-size 會把三種拉成同一級（跟小標字級那組同一個理由）。zoom 連著行高與底下
           那截 margin 一起縮放，字放大了跟價錢的距離也跟著長，不會出現字變大、間距停在
           原位的擠感；上面兩組的行數截斷也照樣成立（line-clamp 數的是行，不是絕對高度）。 */
        section[data-edit-target][data-card-title-scale="small"] .sproutly-card-title {
          zoom: 0.9;
        }
        section[data-edit-target][data-card-title-scale="large"] .sproutly-card-title {
          zoom: 1.25;
        }

        /* 卡片標題粗細：editor 各 section panel「卡片標題粗細」三按鈕（常規 / 中黑 / 粗）。
           上一組管的是品名那行多大，這組管的是它多粗。三段的品名都寫死 400 常規，跟底下
           那行描述、價錢只差在字級與顏色淡一點——商家把欄數調成一列四張、或把描述字級
           調大之後那點差別就不夠了，客人一眼掃過去分不出哪行是商品名；反過來慢讀那種
           一整段摘要的寬卡，400 的標題撐不住底下那段文字的份量。原本沒有一格動得到：
           「標題粗細」動的是段落大標（h2），「卡片標題字級」只換大小，「卡片副文字深淺」
           動的是描述那層的透明度。
           這一格跟上面那批 attribute 規則不同，走的是 CSS variable：粗細寫在 h3 自己的
           inline style 上（跟顏色、字體同一包），stylesheet 的規則權重再高也蓋不過 inline
           ——所以 page.tsx 那行改成 var(--card-title-weight, 400)，這裡只負責依 attribute
           把變數換掉。沒設這格的段落沒有 attribute、變數沒人設，h3 拿到 fallback 400，
           跟原本一模一樣。
           400 / 500 / 700 都是這支 layout 已經載進來的字重（思源黑體與宋體都有），不給
           300 那種細的——沒載的字重瀏覽器會拿常規去假變細，中文筆畫糊掉，跟段落大標那格
           同一個理由。滑過卡片時標題撐開字距那段動的是 letter-spacing，兩者不打架。 */
        section[data-edit-target][data-card-title-weight="medium"] {
          --card-title-weight: 500;
        }
        section[data-edit-target][data-card-title-weight="bold"] {
          --card-title-weight: 700;
        }

        /* 卡片標題行距：editor 各 section panel「卡片標題行距」三按鈕（收緊 / 跟預設 / 拉開）。
           上面兩組管的是品名那行多大、多粗，這組管的是它自己換行之後上下兩行隔多遠——只有
           那行排到兩行以上才看得出差別，而「卡片標題行數」那格（讓品名顯示到兩行或完整）
           正是把換行變成常態的那一格：精選商品原本寫死只顯示一行，商家為了讓帶規格的品名
           看得完整選了完整之後，才第一次看到自己的品名換行長什麼樣。
           各段的行距是跟著字級 class 附帶的（選物 text-lg 1.56 / sm:text-xl 1.4、精選
           text-base 1.5、慢讀寫死 leading-[1.4]），照一行字的狀況挑的：中文換到第二行時
           上下筆畫幾乎黏在一起；反過來把品名字級調大之後，同一個比例撐出來的間隙又大得
           像兩行沒關係的字。
           商家原本沒有一格動得到——「行高」那組的規則只落在 p / li / blockquote /
           figcaption / dd 上（見上面那段），卡片裡的品名是 h3、整組跳過；「卡片行距」動的
           是卡片裡不同行之間那截 margin（照片到品名、品名到價錢），同一行字自己換行不歸它
           管；「卡片標題字級」換的是字多大，行距是跟著字級走的比例。
           規則落在 .sproutly-card-title，這份 CSS 沒包在 @layer、贏得過 Tailwind 的
           leading-[1.4] 與字級 class 自帶的行高，一條規則就蓋得過去。
           寫死一個值不等比：行距本來就是 unitless 的比例，三段之間 1.4 與 1.56 的差是字級
           class 附帶的、不是誰刻意設計的層次——跟卡片行距那格（同一張卡上幾截距離有主次，
           要等比保留）不是同一種東西。
           沒設就沒 attribute、整條規則不存在，既有店家一個像素都不會動。 */
        section[data-edit-target][data-card-title-leading="tight"] .sproutly-card-title {
          line-height: 1.15;
        }
        section[data-edit-target][data-card-title-leading="loose"] .sproutly-card-title {
          line-height: 1.75;
        }

        /* 卡片品名字距：editor 各 section panel「卡片品名字距」三按鈕（收緊 / 跟預設 / 撐開）。
           上一組管的是品名換行之後上下兩行隔多遠，這組管的是同一行裡字與字之間隔多遠。
           字距這一格前面補過三個位置：段落最上面那行小標（data-eyebrow-track）、段落大標
           （--store-heading-track）、卡片上那幾行全大寫小字（data-card-micro-tracking）。
           卡片上字級最大、客人在一排卡片裡拿來認商品的那一行反而一直沒有。
           三段各寫各的：選物與精選的品名沒設字距（跟著整段的 --store-track 走），慢讀那張
           寫死 -0.005em。往內收是照英文品名挑的——英文單字之間的空格還在，收一點是緊實；
           中文品名每個字本來就佔滿方框，筆畫多的詞再往內收，字級一大就跟隔壁黏在一起。
           反過來只有兩三個字的品名，撐開一點才有選物店那種留白感。
           兩條規則（跟卡片小字字距同一個作法）：一條落在 .sproutly-card-title 蓋掉繼承來的
           字距，一條給 --card-title-track 讓慢讀那行寫在 inline style 裡的字距也跟著走
           ——inline 的優先度連 CSS 規則都壓不過，只能繞變數。
           收緊給 -0.04em 不給更小：品名沒有段落大標那麼大，再收下去中文筆畫會疊到隔壁。
           撐開給 0.14em 不給小字那種 0.55em：品名是一個詞要一眼認得出來，撐到那個程度會散
           成幾個各自站著的字，窄卡上還會被撐到多換一行。
           沒設就沒 attribute、整條規則不存在，既有店家一個字都不會動。 */
        section[data-edit-target][data-card-title-tracking="tight"] {
          --card-title-track: -0.04em;
        }
        section[data-edit-target][data-card-title-tracking="tight"] .sproutly-card-title {
          letter-spacing: -0.04em;
        }
        section[data-edit-target][data-card-title-tracking="wide"] {
          --card-title-track: 0.14em;
        }
        section[data-edit-target][data-card-title-tracking="wide"] .sproutly-card-title {
          letter-spacing: 0.14em;
        }

        /* 卡片描述字級：editor 各 section panel「卡片描述字級」三按鈕（小 / 跟預設 / 大）。
           上一組管的是品名那行多大，這組管的是品名底下那段描述——選物的副標、慢讀的摘要，
           兩段都寫死 14px，照站上預設那種一句話的副標挑的。慢讀那種一整段摘要的卡片，14px
           在寬卡上讀起來像圖說；反過來一列四張的小卡把品名調大之後，14px 的描述跟品名擠在
           一起分不出主次，想把描述收小讓品名站出來也沒得調。
           規則落在 .sproutly-card-desc，跟卡片描述行數那組同一個範圍：精選那段同一個位置放
           的是價錢，不掛這個 class，所以不受影響。
           用 zoom 不用 font-size：選物那行還同時掛著 sproutly-card-meta（字級與顏色另有一層
           在管），寫死 font-size 等於跟那層搶；zoom 連著上面那截 mt-1 / mt-3 一起縮放，字
           放大了跟品名的距離也跟著長，行數截斷也照樣成立（line-clamp 數的是行，不是高度）。
           放大只到兩成、比品名那組的兩成半少一階：描述比品名大就主次顛倒了。 */
        section[data-edit-target][data-card-desc-scale="small"] .sproutly-card-desc {
          zoom: 0.9;
        }
        section[data-edit-target][data-card-desc-scale="large"] .sproutly-card-desc {
          zoom: 1.2;
        }

        /* 卡片描述行距：editor 各 section panel「卡片描述行距」三按鈕（收緊 / 跟預設 / 拉開）。
           上一組管的是那段描述多大，這組管的是它排到第二行以後，上下兩行之間隔多遠。
           品名那行已經有一組（data-card-title-leading），描述才是卡片上一定會換行的那段：
           品名多半一行結束，描述是整句甚至整段，窄卡上兩三行起跳。而兩段描述的行距各寫各的
           ——選物的副標只跟著 text-sm 走（約 1.43，英文短句的密度），慢讀的摘要寫死 1.85，
           商家在選物那邊看到兩行中文黏成一塊，在慢讀那邊反而鬆到散開，方向剛好相反。
           規則落在 .sproutly-card-desc，跟字級、行數那兩組同一個範圍：精選那段同一個位置放
           的是價錢，不掛這個 class，不受影響。
           寫死不等比（跟品名那組同一個理由）：1.43 與 1.85 的差是兩段各自的 class 附帶的，
           不是刻意設計的層次，這格要的就是兩段一起落到同一個密度。leading-[1.85] 是 Tailwind
           class，這份 CSS 沒包在 @layer，蓋得過去。 */
        section[data-edit-target][data-card-desc-leading="tight"] .sproutly-card-desc {
          line-height: 1.4;
        }
        section[data-edit-target][data-card-desc-leading="loose"] .sproutly-card-desc {
          line-height: 1.95;
        }

        /* 卡片描述粗細：editor 各 section panel「卡片描述粗細」三按鈕（常規 / 中黑 / 粗）。
           上面兩組管的是那段描述多大、行與行隔多遠，這組管的是它多粗。粗細前面只做過品名
           與價錢，描述那段一直寫死 400——而它同時還被「卡片副文字深淺」淡到 0.7（選物那行
           掛著 sproutly-card-meta），字級又比品名小，三個減法疊起來，那段話在卡片上淡到像
           圖說。慢讀那種一整篇文章的摘要卡，摘要才是客人真的要讀的東西，卻是卡片上最輕的
           一行；商家把品名調粗之後落差更大。反過來一列四張的小卡上描述只是一句副標，想讓
           它再退一點也只能整段調深淺，沒辦法只動粗細。
           規則落在 .sproutly-card-desc，跟字級、行距、行數那幾組同一個範圍：精選那段同一個
           位置放的是價錢，不掛這個 class，而且價錢自己有一格粗細，不受影響。
           選物與慢讀那兩段的 inline style 只有顏色，粗細是 class 那層的預設，這份 CSS
           沒包在 @layer，直接蓋得過去；顧客評語那段的引言把 400 寫在自己的 inline style 上
           （inline 壓得過任何 CSS 規則），所以跟品名那組一樣多給一條 --card-desc-weight，
           讓寫在 inline 的那行也跟著這格走。沒設就沒變數，那行照樣讀 fallback 的 400。
           400 / 500 / 700 都是這支 layout 已經載進來的字重，不給 300 那種細的：沒載的字重
           瀏覽器會拿常規去假變細，中文筆畫糊掉，跟品名、段落大標那兩格同一個理由。 */
        section[data-edit-target][data-card-desc-weight="medium"] {
          --card-desc-weight: 500;
        }
        section[data-edit-target][data-card-desc-weight="medium"] .sproutly-card-desc {
          font-weight: 500;
        }
        section[data-edit-target][data-card-desc-weight="bold"] {
          --card-desc-weight: 700;
        }
        section[data-edit-target][data-card-desc-weight="bold"] .sproutly-card-desc {
          font-weight: 700;
        }

        /* 卡片描述字距：editor 各 section panel「卡片描述字距」三按鈕（收緊 / 跟預設 / 撐開）。
           上面幾組管的是那段描述多大、行與行隔多遠、多粗，這組管的是同一行裡字與字之間隔
           多遠。兩段描述都沒設自己的字距、跟著整段繼承走：「內文字距」那條規則落在 p / li
           那批元素上碰得到它們，但一調整段的引言、常見問題答案全部跟著動；商家把品名字距
           撐開之後，品名底下那句副標還是原本的密度，一鬆一緊疊在同一張卡上沒得救。
           規則落在 .sproutly-card-desc，跟字級、行距、粗細那幾組同一個範圍：精選那段同一個
           位置放的是價錢，不掛這個 class，不受影響。選物與慢讀那兩段的 inline style 只有
           顏色，字距是繼承來的，帶 class 的規則直接蓋得過去；顧客評語那段的引言不一樣，
           它的字距寫在 inline style 裡（跟著 --store-track 走），inline 的優先度連 CSS
           規則都壓不過——所以跟品名、小字那兩組一樣多給一條 --card-desc-track，讓寫在
           inline 的那行也跟著這格走。沒設就沒變數，那行照樣讀 fallback 的原值。
           帶 class 的這條比「內文字距」那條（attribute + 元素）精確，商家兩邊都設時卡片
           照樣聽這格的——跟描述粗細對 bodyWeight 的關係同一個安排。
           檔位跟內文那組同一對值不跟品名那組：描述是 14px 的整句話，品名的 -0.04em 會讓
           中文筆畫黏在一起、0.14em 會把一句話撐散成單字，那對值是照「一個詞」挑的。
           沒設就沒 attribute、整條規則不存在，既有店家一個字都不會動。 */
        section[data-edit-target][data-card-desc-tracking="tight"] {
          --card-desc-track: -0.02em;
        }
        section[data-edit-target][data-card-desc-tracking="tight"] .sproutly-card-desc {
          letter-spacing: -0.02em;
        }
        section[data-edit-target][data-card-desc-tracking="wide"] {
          --card-desc-track: 0.06em;
        }
        section[data-edit-target][data-card-desc-tracking="wide"] .sproutly-card-desc {
          letter-spacing: 0.06em;
        }

        /* 卡片小字字級：editor 各 section panel「卡片小字字級」三按鈕（小 / 跟預設 / 大）。
           上面兩組管的是卡片裡的品名與描述，這組管的是卡片上剩下那幾行——全大寫、字距撐
           很開的小字：選物卡片底下的「看更多」、慢讀卡片上面的分類、慢讀卡片底下的標籤，
           三行都寫死 10px。那個值是照英文那種 VIEW ALL / JOURNAL 挑的，全大寫又筆畫少，
           10px 還讀得出來；中文不行——「看更多」「盆栽照顧」在 10px 裡筆畫糊成一團灰，
           客人看到的是一條裝飾線不是一行字，而那行常常正是卡片上唯一告訴客人「這裡可以
           點」的東西。
           商家原本沒有一格動得到：「小標字級」那組的規則落在段落自己的 eyebrow 上（大標
           上面那行），到不了卡片裡；卡片標題 / 卡片描述那兩組各自只管品名與描述。
           規則落在 .sproutly-card-micro，掛在真的是這種小字的那幾行。精選那段價錢底下的
           「剩 N」庫存提示原本因為「那是狀態不是導覽文字」沒掛，現在補上：糊掉的原因跟
           那三行一模一樣（11px、字距 0.3em、中文），而且那行不是裝飾，是客人決定要不要
           現在下單看的最後一句話；不掛的結果是精選那段整格「卡片小字字級」按了沒反應。
           用 zoom 不用 font-size：這幾行的字距是 0.3em / 0.4em 這種跟著字級走的相對值，
           寫死 font-size 會讓字變大、字距跟著散開成一排各自站著的字；zoom 連著字距與上面
           那截 margin 一起縮放，比例維持原樣。
           放大放到四成（10px → 14px）比上面兩組都大：起點只有 10px，兩成才 12px，中文在
           12px 還是糊的，這格要能真的把那行救成讀得出來的字才有意義。 */
        section[data-edit-target][data-card-micro-scale="small"] .sproutly-card-micro {
          zoom: 0.9;
        }
        section[data-edit-target][data-card-micro-scale="large"] .sproutly-card-micro {
          zoom: 1.4;
        }

        /* 卡片小字字距：editor 各 section panel「卡片小字字距」三按鈕（收緊 / 跟預設 / 撐開）。
           上一組管的是那幾行小字多大，這組管的是字與字之間空多少——選物的「看更多」、慢讀
           的分類與標籤、精選的「剩 N」，寫死 0.3em / 0.4em。那組值跟段落小標那行的 0.4em
           同一個出發點：照英文全大寫短詞挑的（VIEW ALL、JOURNAL 那種，字母間本來就有空隙，
           撐開才有雜誌感）。中文放進去是另一回事——「看更多」三個字每個之間硬塞進 0.3 個
           字寬，看起來不是一個詞是三個各自站著的字；上一組選了「大」之後更明顯，zoom 連
           字距一起放大，那行在手機上直接被撐到換行黏在品名底下。
           段落最上面那行小標早就有這一格（data-eyebrow-track），那條規則落在段落自己的
           eyebrow 上，到不了卡片裡；「字距」那欄設的是整段，這幾行自己帶著 0.3em / 0.4em
           動都不動。
           兩條規則：一條蓋 class 上的字距（這份 CSS 沒包在 @layer，贏得過 Tailwind 的
           tracking-[0.3em]），一條給 --card-micro-track 讓精選那行寫在 inline style 裡的
           「剩 N」也跟著走（inline 蓋不過，只能繞變數，跟卡片標題粗細那組同一個作法）。
           收緊給 0.12em 不給 0：這種小字的樣式標誌就是那個比內文寬的字距，收到 0 會變成
           一行普通小字，看起來像漏排版不是刻意的。 */
        section[data-edit-target][data-card-micro-tracking="tight"] {
          --card-micro-track: 0.12em;
        }
        section[data-edit-target][data-card-micro-tracking="tight"] .sproutly-card-micro {
          letter-spacing: 0.12em;
        }
        section[data-edit-target][data-card-micro-tracking="wide"] {
          --card-micro-track: 0.55em;
        }
        section[data-edit-target][data-card-micro-tracking="wide"] .sproutly-card-micro {
          letter-spacing: 0.55em;
        }

        /* 卡片小字行距：editor 各 section panel「卡片小字行距」三按鈕（收緊 / 跟預設 / 拉開）。
           上兩組管的是那幾行小字多大、字與字之間空多少，這組管的是它們排到第二行之後上下
           隔多遠。這幾行換行的機率跟段落小標一樣高——自己帶著 0.3-0.4em 的字距、字級那格
           按到大之後 zoom 連字距一起放大，長一點的分類或標籤在手機的窄卡上一行放不下是常態。
           跟小標行距那組同一個處境：慢讀那兩行是 <p>、沒帶 leading class，行距整條繼承段落
           那層的內文行高（預設 1.7、商家按到舒展就是 2），那個值套在 10px 的標籤上，兩行
           之間空得比字還高；「行高」那條規則落在 :is(p, li, ...) 上，收這幾行的同時整段的
           描述、引言、答案全部一起被收緊。這條帶 class（attribute 數也多一個），無論商家
           有沒有同時設行高都壓得過去。
           收緊給 1.15 不給更小，跟小標那組同一個理由：中文的字在行框裡本來就佔滿，1.0 以下
           上下兩行會疊到筆畫。沒設就沒 attribute、整條規則不存在，既有店家一行字都不會動。 */
        section[data-edit-target][data-card-micro-leading="tight"] .sproutly-card-micro {
          line-height: 1.15;
        }
        section[data-edit-target][data-card-micro-leading="loose"] .sproutly-card-micro {
          line-height: 2.2;
        }

        /* 卡片小字粗細：editor 各 section panel「卡片小字粗細」四按鈕（常規 / 跟預設 /
           中黑 / 粗）。上面兩組管的是那幾行小字多大、字與字之間空多少，這組管的是它們
           多粗——選物卡片底下的「看更多」、慢讀卡片上面的分類與底下的標籤、精選卡片上的
           「剩 N」。
           那幾行的粗細各寫各的，而且分成兩種：選物與慢讀那三行沒設、繼承下來就是 400，
           10px 的中文再加 0.3em 的字距，在淺色底上細成一條灰線，客人看到的不像一行字
           ——而「看更多」常常是那張卡上唯一告訴客人「這裡可以點」的東西；精選那行反過來
           是 class 上的 font-medium（500），又用琥珀色印，在一張只有品名與價錢的小卡上
           搶得比價錢還前面，商家想讓它退成一句提示原本沒辦法。
           商家原本沒有一格動得到：「小標粗細」那組落在段落自己的 eyebrow 上（大標上面那
           行），到不了卡片裡；卡片標題 / 描述 / 價錢那三組的規則各帶自己的 class，全跳過
           這幾行；「卡片小字字級」放大的是字（筆畫等比變粗，在淺底上一樣淡）。
           給四個值不是三個，跟小標粗細那組同一個理由：精選那行本來就是 500，只給「跟預設
           / 中黑 / 粗」的話它沒有一顆按鈕退得回 400，對最需要這格的那一段等於是壞的。
           不必繞 CSS variable：這幾行的粗細寫在 class 上（inline style 只有顏色與字距），
           這份 CSS 沒包在 @layer，一條規則就蓋得過去——跟卡片描述、卡片價錢那兩組同一
           個處境，不像品名那組得靠變數傳。
           400 / 500 / 700 都是這支 layout 已經載進來的字重，不給 300 那種細的：沒載的字重
           瀏覽器會拿常規去假變細，10px 的中文筆畫直接糊成一團，比原本更看不清楚。 */
        section[data-edit-target][data-card-micro-weight="light"] .sproutly-card-micro {
          font-weight: 400;
        }
        section[data-edit-target][data-card-micro-weight="medium"] .sproutly-card-micro {
          font-weight: 500;
        }
        section[data-edit-target][data-card-micro-weight="bold"] .sproutly-card-micro {
          font-weight: 700;
        }

        /* 卡片小字大小寫：editor 各 section panel「卡片小字大小寫」三按鈕（全大寫 / 字首大寫 /
           照原樣）。上面四組管的是那幾行小字多大、字與字之間空多少、換行後隔多遠、多粗，這組
           管的是那幾行字被轉成什麼字形。那幾行一律 uppercase，跟 10px 與 0.3-0.4em 的字距是
           同一個設計決定的三個面向（全大寫的英文短詞撐開字距，是雜誌上小標的標準寫法）。
           中文沒有大小寫之分，這條對只打中文的卡片按了不會動；問題在英文與混排，而卡片上這
           幾行打英文的機率比段落小標更高——選物那行常是「Shop all」「View more」（被拉成
           SHOP ALL），慢讀的分類是商家自己訂的標籤（混排的「Care 照顧」只有前半被改，看起來
           像沒對齊的兩截），好評的頭銜是客人的職稱或 IG 帳號（帳號的大小寫是它自己的一部分）。
           而且商家改字沒用——轉換發生在畫面上不在資料裡，輸入框看到的還是自己打的小寫。
           要蓋掉的是那幾行自己帶的 uppercase class（段落那層沒有一欄傳得下去），跟卡片小字
           字級、字距、行距、粗細同一個處境同一個解法：attribute 讓這裡補一條更精確的規則壓
           過去（這份 CSS 沒包在 @layer，贏在 @layer utilities 的 Tailwind 工具類）。
           三檔裡留「全大寫」是因為那幾行本來就是 uppercase，少了這一檔按過 capitalize 之後
           沒有一顆按鈕退得回原本的樣子（跟卡片小字粗細留「跟預設」同一個理由）。它是「照原本
           的」那一檔，按下去等於把這一欄清掉，所以這裡只有另外兩檔有規則。
           沒設就沒 attribute、整條規則不存在，既有店家的卡片小字一個字都不會變。 */
        section[data-edit-target][data-card-micro-case="capitalize"] .sproutly-card-micro {
          text-transform: capitalize;
        }
        section[data-edit-target][data-card-micro-case="none"] .sproutly-card-micro {
          text-transform: none;
        }

        /* 雜誌版型「大字離上下橫線多遠」：editor Hero panel 那格三檔（貼著 / 中等 / 跟預設）
           加手機自己的一格（跟桌機一樣 / 貼著 / 中等 / 整屏）。這一段是 min-h-screen +
           justify-between，線離字多遠等於段有多高，所以動的全是 min-height。
           原本桌機那格是公開頁 inline 的 minHeight，但 inline 一寫手機桌機一起蓋，手機那格
           插不進去；改成兩個 attribute 各管各的。第一組不分斷點（等於以前的 inline），第二組
           只管 767px 以下、寫在後面，同一個 section 兩組都命中時後者贏——手機那格選了什麼
           就是什麼。跟預設 / 跟桌機一樣都不掛 attribute，整條規則不存在，既有店家（含已經
           選了貼著 / 中等的）算出來一模一樣。 */
        section[data-edit-target="hero"][data-hero-magazine-gap="tight"] {
          min-height: 0;
        }
        section[data-edit-target="hero"][data-hero-magazine-gap="medium"] {
          min-height: 70vh;
        }
        @media (max-width: 767px) {
          section[data-edit-target="hero"][data-hero-magazine-gap-mobile="tight"] {
            min-height: 0;
          }
          section[data-edit-target="hero"][data-hero-magazine-gap-mobile="medium"] {
            min-height: 70vh;
          }
          section[data-edit-target="hero"][data-hero-magazine-gap-mobile="normal"] {
            min-height: 100vh;
          }
        }

        /* 滿版版型「Hero 高度」的手機那一格（heroHeightMobile）。桌機那格是 class 上的
           min-h-[60vh] / min-h-[80vh] / min-h-screen，手機桌機同一個值——同一張照片手機
           滿寬顯示比桌機高得多、字又小一半，桌機剛好的高度到手機常常不是被硬撐一大截
           空色塊、就是想撐反而不夠。跟雜誌那組同一招：只管 767px 以下、贏在這份 CSS
           沒包 @layer。auto 那檔把桌機的 min-height 清回 0，手機照內容長（桌機的 flex /
           grow 還掛著，但沒有多出來的高度可分，算出來跟自適應一樣）。三個高度檔要自己補
           flex 直排 + 文字段 grow——桌機選自適應時 page.tsx 不掛那兩個 class，沒補的話
           多出來的高度會掉在文字段底下露一條全站底色（9478b31 修過的那個病）；桌機也有
           高度時這兩條是重複宣告，算出來一樣。跟桌機一樣 = 不掛 attribute，整組規則
           不存在，既有店家一個 px 都不動。 */
        @media (max-width: 767px) {
          section[data-edit-target="hero"][data-hero-full-height-mobile="auto"] {
            min-height: 0;
          }
          section[data-edit-target="hero"][data-hero-full-height-mobile="short"] {
            min-height: 60vh;
          }
          section[data-edit-target="hero"][data-hero-full-height-mobile="tall"] {
            min-height: 80vh;
          }
          section[data-edit-target="hero"][data-hero-full-height-mobile="full"] {
            min-height: 100vh;
          }
          section[data-edit-target="hero"][data-hero-full-height-mobile="short"],
          section[data-edit-target="hero"][data-hero-full-height-mobile="tall"],
          section[data-edit-target="hero"][data-hero-full-height-mobile="full"] {
            display: flex;
            flex-direction: column;
          }
          section[data-hero-full-height-mobile="short"] [data-edit-target="hero-text-area"],
          section[data-hero-full-height-mobile="tall"] [data-edit-target="hero-text-area"],
          section[data-hero-full-height-mobile="full"] [data-edit-target="hero-text-area"] {
            flex-grow: 1;
          }
        }

        /* minimal 版型「上下留白」的手機那一格（heroMinimalPaddingMobile）。桌機那格是
           公開頁 section 上的 inline paddingTop / paddingBottom，一寫手機桌機一起蓋，
           手機那格插不進去；改成掛 attribute、在這裡蓋回來。帶 !important 是因為要贏的
           是同一個 section 的 inline padding——這份 CSS 沒包 @layer，不帶只贏得過
           class（沒挑桌機那格時的 py-40 sm:py-56）。
           斷點用 639px 不是別處那組的 767px：原本的 py-40 sm:py-56 就是在 640px 換檔，
           跟著 sm 走，「跟桌機一樣」那檔（不掛 attribute）在 640-767px 才不會被這組
           偷偷改掉。三個值就是桌機那三檔的 clamp 在手機寬度算出來的數，同一把尺。
           跟上面那格一樣 = 不掛 attribute，整組規則不存在，既有店家一個 px 都不動。 */
        @media (max-width: 639px) {
          section[data-edit-target="hero"][data-hero-minimal-padding-mobile="compact"] {
            padding-top: 4rem !important;
            padding-bottom: 4rem !important;
          }
          section[data-edit-target="hero"][data-hero-minimal-padding-mobile="normal"] {
            padding-top: 10rem !important;
            padding-bottom: 10rem !important;
          }
          section[data-edit-target="hero"][data-hero-minimal-padding-mobile="spacious"] {
            padding-top: 14rem !important;
            padding-bottom: 14rem !important;
          }
        }

        /* minimal 版型「這段字離螢幕邊多遠」的手機那一格（heroMinimalPadXMobile）。桌機
           那格是公開頁裡層那個 div 的 inline paddingLeft / paddingRight，一寫手機桌機
           一起蓋，手機那格插不進去；attribute 掛在外面的 section（inline style 在裡層，
           掛不上去），這裡再用後代選擇器指回那個 div。帶 !important 是因為要贏的就是它
           自己的 inline padding。
           斷點用 767px：跟上下留白那格不同，這格原本是寫死的 px-6、沒有 sm 換檔，
           不必跟 640 對齊，跟別處那幾組手機格（主標字級、雜誌版型間距）同一條線就好。
           三個值是桌機那三檔的 clamp 在手機寬度算出來的數，同一把尺。
           跟上面那格一樣 = 不掛 attribute，整組規則不存在，既有店家一個 px 都不動。 */
        @media (max-width: 767px) {
          section[data-hero-minimal-pad-x-mobile="narrow"] [data-hero-minimal-inner] {
            padding-left: 0.6rem !important;
            padding-right: 0.6rem !important;
          }
          section[data-hero-minimal-pad-x-mobile="normal"] [data-hero-minimal-inner] {
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
          }
          section[data-hero-minimal-pad-x-mobile="wide"] [data-hero-minimal-inner] {
            padding-left: 2.5rem !important;
            padding-right: 2.5rem !important;
          }
        }

        /* 主標字級的手機那一格（heroTaglineFontScaleMobile）。桌機那格動過 slider 時是
           h1 上的 inline fontSize，media query 插不進 inline，所以手機的值由公開頁算好
           clamp、塞進同一顆 h1 的 --hero-tagline-fs-m，這裡只負責在 767px 以下拿出來套。
           帶 !important 是因為要贏的是同一顆 h1 的 inline fontSize——這份 CSS 沒包
           @layer 只贏得過 class（桌機 slider 沒動過時的 text-3xl sm:text-4xl 那組），
           贏不過 inline。跟桌機一樣 = 不掛 attribute，這條規則匹配不到，兩端照舊。 */
        @media (max-width: 767px) {
          section[data-edit-target="hero"] [data-hero-tagline-size-mobile] {
            font-size: var(--hero-tagline-fs-m) !important;
          }
        }

        /* split 版型圖文比例：editor Hero panel「圖文比例」三按鈕（圖窄 / 跟預設 / 圖寬）。
           欄寬字串由公開頁算好（已把「圖在右」的 order 反轉考慮進去）從 inline style 的
           --store-hero-split 進來，這裡只負責讓它蓋過 Tailwind 的 md:grid-cols-2——同樣
           贏在這份 CSS 沒包 @layer。
           只在 md 以上寫規則：手機的 split 是圖上文下的單欄堆疊（grid-cols-1），欄寬對它
           沒有意義，硬套會把圖擠成一條。
           跟預設那一檔不輸出 attribute 也不輸出變數，整條規則不存在，既有店家的 50:50
           原樣留著。 */
        @media (min-width: 768px) {
          section[data-edit-target="hero"][data-hero-split] {
            grid-template-columns: var(--store-hero-split);
          }
        }

        /* split 版型手機圖片形狀：editor Hero panel「手機上圖片的形狀」四按鈕
           （直式 / 跟預設 / 橫式 / 跟照片）。比例字串由公開頁算好從 inline style 的
           --store-hero-split-img 進來，這裡負責蓋掉圖框 class 上寫死的 aspect-square。
           只寫在 767px 以下：平板以上圖框是整欄的高度（md:aspect-auto md:h-full），
           比例對它沒有意義，套上去會把整欄高那個行為弄掉。
           跟預設那一檔不輸出 attribute 也不輸出變數，整條規則不存在，既有店家的手機版
           那個正方形原樣留著。 */
        @media (max-width: 767px) {
          section[data-edit-target="hero"] [data-hero-split-img] {
            aspect-ratio: var(--store-hero-split-img);
          }
        }

        /* split 版型平板以上圖欄比例：只在「圖文比例 = 跟照片」配「這一段有多高 = 跟著內容」
           時公開頁才掛 data-hero-split-img-md 跟 --store-hero-split-img-md。那一檔段高
           不是寫死的、算不出欄寬，就反過來讓圖撐出段高：欄寬維持一半，圖那欄掛照片自己的
           比例，段高 = 欄寬 ÷ 比例。三件事缺一不可（探針量過）：
           - height: auto 蓋掉 class 上的 md:h-full，不然高度先被鎖成 100% 撐不出東西；
           - align-self: stretch——grid 對有 aspect-ratio 的 item 預設不拉伸，文字比照片
             高的時候圖欄會停在照片高度、底下露一截；
           - width: 100%——被拉高的時候比例會反過來從高度算寬，圖欄變成 1500px 撐破整段，
             把寬寫定它才知道要放棄比例。
           只寫在 md 以上，手機那個正方形 / 手機那格的比例歸上面那條管。 */
        @media (min-width: 768px) {
          section[data-edit-target="hero"] [data-hero-split-img-md] {
            aspect-ratio: var(--store-hero-split-img-md);
            height: auto;
            width: 100%;
            align-self: stretch;
          }
        }

        /* split 版型文字欄左右內距：editor Hero panel「文字欄左右留白」三按鈕
           （窄 / 跟預設 / 寬）。值由公開頁算好從 inline style 的 --store-hero-split-pad
           進來，這裡負責蓋掉那欄 class 上的 md:px-16 lg:px-24——同樣贏在這份 CSS
           沒包 @layer。
           只寫在 md 以上：手機的 split 是單欄堆疊，那時候的 px-8 是全站左右邊界（跟
           導覽列與後面每一段對齊），改掉這一段就會變成整頁唯一沒對齊的一段。
           上下的 py-20 md:py-0 不動（那個方向歸「文字靠哪」那格管）。
           跟預設那一檔不輸出 attribute 也不輸出變數，整條規則不存在。 */
        @media (min-width: 768px) {
          section[data-edit-target="hero"] [data-hero-split-pad] {
            padding-left: var(--store-hero-split-pad);
            padding-right: var(--store-hero-split-pad);
          }
        }

        /* split 版型文字欄手機上下留白：editor Hero panel「手機上文字段上下留白」三按鈕
           （窄 / 跟預設 / 寬）。值由公開頁算好從 inline style 的 --store-hero-split-pady
           進來，這裡負責蓋掉那欄 class 上的 py-20——同樣贏在這份 CSS 沒包 @layer。
           只寫在 767px 以下：平板以上 class 上是 md:py-0，那個 0 是刻意的（那時候字在
           欄裡的高度歸「文字靠哪」那格用 justify-content 分），套上內距會讓靠上 / 靠下
           對不到照片的上下緣。左右那格剛好相反（只寫在 md 以上），兩格管的是不同方向、
           不同斷點，不會互相蓋。
           跟預設那一檔不輸出 attribute 也不輸出變數，整條規則不存在。 */
        @media (max-width: 767px) {
          section[data-edit-target="hero"] [data-hero-split-pady] {
            padding-top: var(--store-hero-split-pady);
            padding-bottom: var(--store-hero-split-pady);
          }
        }

        /* split 版型手機圖文順序：editor Hero panel「手機上誰排在上面」兩按鈕
           （跟預設 / 文字在上）。手機是單欄堆疊，順序照 DOM 走、圖永遠先，而「圖片靠左 /
           靠右」那格用的是 md:order-1 / md:order-2，只在 768px 以上生效，碰不到手機。
           只寫在 767px 以下，就不會跟那組 md:order-* 在同一個斷點上打架。
           跟預設那一檔不輸出 attribute，整條規則不存在，既有店家的手機版原樣留著。 */
        @media (max-width: 767px) {
          section[data-edit-target="hero"][data-hero-split-mobile="text-first"] [data-hero-split-text] {
            order: 1;
          }
          section[data-edit-target="hero"][data-hero-split-mobile="text-first"] [data-hero-split-media] {
            order: 2;
          }
          /* split 版型手機的列高。section class 上是 min-h-[80vh]，手機圖上文下整段是兩塊
             加起來：照片正方形時光照片就一個螢幕寬、加上文字段一定超過 80vh，那條碰不到；
             可是「手機上照片的比例」選了 3:2 / 跟照片（最扁到 3:1）、字又只有店名加一句
             的店，兩塊加起來不到 80vh，grid 就把多出來的高度平分給兩列——圖欄掛著
             aspect-ratio，在 grid 裡預設不拉伸、只靠上，照片下面跟文字之間就空出一條底色
             （390×844 配 3:2 量到 66px）。把列高寫成 auto / minmax(0, 1fr)：照片那列照自己
             的比例、多出來的全給文字那列，字在裡面照「文字靠哪」擺。文字在上那檔兩列反過來。
             掛在常駐的 data-hero-split-section 上，所有 split 店家都吃得到——照片正方形的
             店兩塊本來就超過 80vh，1fr 沒有多的空間可分，版面一個 px 都不動。 */
          section[data-edit-target="hero"][data-hero-split-section] {
            grid-template-rows: auto minmax(0, 1fr);
          }
          section[data-edit-target="hero"][data-hero-split-section][data-hero-split-mobile="text-first"] {
            grid-template-rows: minmax(0, 1fr) auto;
          }
          /* split 版型「這一段有多高」的手機那份。下面 min-width: 768px 那組只管平板以上，
             手機一直是 class 上寫死的 80vh，面板選了跟著內容手機還是會被撐到八成螢幕、
             照片扁一點的店文字那列就多一大截空。手機也照同一把尺：跟著內容清成 0（整段
             剛好兩塊加起來）、七成螢幕 70vh、跟預設不掛 attribute、維持 80vh。 */
          section[data-edit-target="hero"][data-hero-split-height="content"] {
            min-height: 0;
          }
          section[data-edit-target="hero"][data-hero-split-height="compact"] {
            min-height: 70vh;
          }
        }

        /* split 版型圖文相接處的分隔線：editor Hero panel「圖文之間的線」兩組按鈕
           （粗細 / 深淺）。粗細與顏色由公開頁算好放在 section 的
           --store-hero-split-divider-w / -c，這裡只管畫在照片那個 div 的哪一邊：
           手機圖上文下畫下緣、「文字在上」那檔畫上緣；平板以上照片在左畫右緣、
           在右（data-hero-split-image-side="right"）畫左緣。分兩個斷點各自寫、每條都
           先把另一邊歸零，換斷點時不會兩邊同時有線。
           沒開這格不輸出 attribute，整組規則不存在，既有店家一模一樣。 */
        @media (max-width: 767px) {
          section[data-edit-target="hero"][data-hero-split-divider] [data-hero-split-media] {
            border-bottom: var(--store-hero-split-divider-w) solid var(--store-hero-split-divider-c);
          }
          section[data-edit-target="hero"][data-hero-split-divider][data-hero-split-mobile="text-first"] [data-hero-split-media] {
            border-bottom: 0;
            border-top: var(--store-hero-split-divider-w) solid var(--store-hero-split-divider-c);
          }
        }
        @media (min-width: 768px) {
          section[data-edit-target="hero"][data-hero-split-divider] [data-hero-split-media] {
            border-right: var(--store-hero-split-divider-w) solid var(--store-hero-split-divider-c);
          }
          section[data-edit-target="hero"][data-hero-split-divider][data-hero-split-image-side="right"] [data-hero-split-media] {
            border-right: 0;
            border-left: var(--store-hero-split-divider-w) solid var(--store-hero-split-divider-c);
          }
        }

        /* split 版型區段高度：editor Hero panel「這一段有多高」三按鈕
           （跟著內容 / 七成螢幕 / 跟預設）。要蓋掉的是 section class 上的 md:min-h-screen。
           寫成 CSS 而不是 inline 的 minHeight，是因為 inline 會連手機那個 min-h-[80vh]
           一起蓋掉，得再補一條把它還原，不如讓斷點自己管。
           選 element + attribute 兩層，贏得過 Tailwind 那個單一 class（同樣贏在這份
           CSS 沒包 @layer）。
           這一組只管 md 以上；手機那份（跟著內容 0 / 七成螢幕 70vh）寫在上面
           max-width: 767px 那組裡，跟列高的規則放一起。
           跟預設那一檔不輸出 attribute，整條規則不存在，既有店家的整屏原樣留著。 */
        @media (min-width: 768px) {
          section[data-edit-target="hero"][data-hero-split-height="content"] {
            min-height: 0;
          }
          section[data-edit-target="hero"][data-hero-split-height="compact"] {
            min-height: 70vh;
          }
          /* 跟著內容那檔的圖欄保底。這一檔把段的 min-height 清成 0 之後，段高就只剩文字
             那欄撐出來的——圖那欄 class 上是 md:h-full，跟著 grid 那一列走，自己沒有高度
             （裡面那張 fill 的圖也撐不出東西）。店名一行加一句話的店，平板以上整段只剩
             一百多 px，照片被壓成一條橫幅，面板上寫的「整段收成照片那欄的高度」根本沒發生。
             給圖欄一個 50vh 的地板：文字比這矮就照 50vh、比這高就跟文字走（grid 那一列
             會照兩欄裡高的那個算，圖欄 align-self 預設 stretch 跟著拉滿），探針頁量過。
             50vh 刻意比七成螢幕的 70vh 再低一階，三檔還是照「跟著內容 < 七成螢幕 < 跟預設」排。
             :not([data-hero-split-img-md]) 排掉「圖文比例 = 跟照片」那個組合——那一檔圖欄
             掛的是照片自己的比例、高度由比例算出來，地板一疊上去比例就被撐歪。
             只寫在 md 以上：手機圖框是正方形 / 手機那格的比例，跟這條無關。 */
          section[data-edit-target="hero"][data-hero-split-height="content"]
            [data-hero-split-media]:not([data-hero-split-img-md]) {
            min-height: 50vh;
          }
          /* 跟著內容那檔的文字欄上下留白。文字欄 class 上是 py-20 md:py-0，那個 0 在整屏
             跟七成螢幕兩檔是對的：段高由 min-height 撐、字在欄裡的位置歸「文字靠哪」用
             justify-content 分，靠上 / 靠下要剛好對到照片上下緣。可是跟著內容這檔段高
             就是文字撐出來的——字一比上面 50vh 的地板高，段高 = 文字高，第一行貼著段的
             上緣、最後一行貼著下一段，中間一點呼吸的空間都沒有；比地板矮時靠上 / 靠下
             也會直接黏在段的邊上。給它一截 clamp(2.5rem, 6vh, 4rem) 的上下內距：字少
             時仍在 50vh 裡置中（內距只是縮小可用範圍）、字多時段高多出這兩截。寫在
             這條 md 規則裡，跟「手機上文字段上下留白」那格（只寫在 767px 以下）不同斷點，
             不會互相蓋。其他兩檔不掛這個 attribute，md:py-0 原樣。 */
          section[data-edit-target="hero"][data-hero-split-height="content"]
            [data-hero-split-text] {
            padding-top: clamp(2.5rem, 6vh, 4rem);
            padding-bottom: clamp(2.5rem, 6vh, 4rem);
          }
        }

        /* 卡片價錢字級：editor 精選商品 panel「卡片價錢字級」三按鈕（小 / 跟預設 / 大）。
           上面三組把卡片裡的品名、描述、全大寫小字都補起來之後，價錢是這一組最後一行沒得
           動的——它寫死 14px，比品名的 16px 還小一級。那個安排是照「先看商品再看價錢」的
           順序挑的，可是不是每家店都這樣：一株盆栽賣多少，常常正是客人在首頁掃過去唯一在
           找的東西，14px 的淡灰字壓在照片底下幾乎讀不到；反過來把品名調大之後，價錢還停在
           14px，同一張卡上兩行字的重量差太多，價錢看起來像附註。
           規則落在 .sproutly-card-price，只有精選那段的卡片有這一行（選物那段同一個位置放
           的是副標、慢讀放的是摘要，都歸卡片描述字級那組管）。
           用 zoom 不用 font-size：這行還同時掛著 sproutly-card-meta（字級與顏色另有一層在
           管），寫死 font-size 等於跟那層搶；zoom 連著上面那截 mt-1 一起縮放，字放大了跟
           品名的距離也跟著長。
           放大放到三成（14px → 18px）比品名那組的兩成半多一階：這格存在的意義就是讓商家
           能把價錢放到比品名重，卡在跟品名同一級等於沒得選。 */
        section[data-edit-target][data-card-price-scale="small"] .sproutly-card-price {
          zoom: 0.9;
        }
        section[data-edit-target][data-card-price-scale="large"] .sproutly-card-price {
          zoom: 1.3;
        }

        /* 卡片價錢粗細：editor 精選商品 panel「卡片價錢粗細」三按鈕（常規 / 中黑 / 粗）。
           上一組管的是那行價錢多大，這組管的是它多粗。價錢這行到現在被補過兩次——字級與
           副文字深淺——都是為了同一件事：讓客人在首頁掃過去找得到它。剩下沒補的是粗細，
           而那是三個裡最有效也最省的一個：放大會把卡片下半撐開、調深會跟品名撞成同一層，
           粗細不佔空間也不換顏色（網購站的價錢幾乎都是粗的）。反過來，賣得貴、想讓首頁
           先講故事的店把品名設成粗之後，價錢留在 400 才對，這格讓兩種店各自調得到。
           原本沒有一格動得到：「卡片標題粗細」動的是品名那行（h3）、「標題粗細」動的是
           段落大標、「卡片價錢字級」只換大小、「卡片副文字深淺」動的是那層透明度。
           跟卡片標題粗細那組不同，這行沒有 inline 的 font-weight（品名那行有，所以那組得
           繞 --card-title-weight 變數），這份 CSS 沒包在 @layer、贏得過 Tailwind 的
           工具類，一條規則就蓋得過去，不用再多一個變數。
           400 / 500 / 700 都是這支 layout 已經載進來的字重，不給 300 那種細的——沒載的
           字重瀏覽器會拿常規去假變細，中文筆畫糊掉，跟卡片標題粗細那組同一個理由。
           沒設就沒 attribute、整條規則不存在，既有店家一個像素都不會動。 */
        section[data-edit-target][data-card-price-weight="medium"] .sproutly-card-price {
          font-weight: 500;
        }
        section[data-edit-target][data-card-price-weight="bold"] .sproutly-card-price {
          font-weight: 700;
        }

        /* 卡片價錢字距：editor 精選商品 panel「卡片價錢字距」三按鈕（收緊 / 跟預設 / 撐開）。
           上面兩組管的是那行價錢多大、多粗，這組管的是同一行裡字與字之間隔多遠。字距這條
           線在卡片上已經補完品名、描述、小字三組，價錢是最後一行沒得動的：品名字距撐開做
           留白感之後，貼在底下的價錢還是原本的密度，一鬆一緊疊在同一張卡上；「內文字距」
           那條規則落在 p / li 那批元素，價錢這行是 div，也碰不到。
           規則落在 .sproutly-card-price，跟字級、粗細那兩組同一個範圍：只有精選那段的卡片
           有這一行（選物同一個位置放的是副標、慢讀放的是摘要，歸卡片描述字距那組管）。
           這行的 inline style 只有顏色，字距是繼承來的，這條規則直接蓋得過去——跟價錢粗細
           那組同一個處境，不用繞 CSS variable。
           檔位不照抄別組：這行是「NT$ 1,200」那種一小串數字。收緊還是 -0.02em（再緊千分位
           逗點會黏進數字裡）；撐開給 0.08em，比描述那組的 0.06em 多一階（實體標價牌那種
           數字隔開的印法），但不到品名那組的 0.14em——那個值會把逗點孤立成懸在半空的點。
           沒設就沒 attribute、整條規則不存在，既有店家一個字都不會動。 */
        section[data-edit-target][data-card-price-tracking="tight"] .sproutly-card-price {
          letter-spacing: -0.02em;
        }
        section[data-edit-target][data-card-price-tracking="wide"] .sproutly-card-price {
          letter-spacing: 0.08em;
        }

        /* 卡片行距：editor 各 section panel「卡片行距」三按鈕（收緊 / 跟預設 / 放寬）。
           上面四組把卡片裡每一行的大小都補完了，行與行之間隔多遠還是寫死的一組 mt-*：
           選物的品名離照片 24px、描述貼著品名 4px、「看更多」再隔 12px；精選 20px / 4px；
           慢讀 24px / 12px / 12px / 20px。那組值是照站上預設那種一列三張、品名兩三個字的
           卡挑的，卡片一換樣就不對——欄數調成 2 或卡片排法設成照片在左之後，卡片寬了一倍，
           同一組距離看起來像四行字散在一大片空白裡；反過來一列四張的小卡，或商家把品名與
           描述都調大之後，四行字黏成一團，客人分不出哪行是品名哪行是說明。
           商家原本沒有一格動得到：「卡片間距」調的是卡片與卡片之間、「卡片內距」調的是卡片
           邊界到內容、「標題與內容」調的是段落大標跟底下那排卡片，三個都不進卡片裡面。
           作法是等比縮放不是寫死一個值：同一張卡上那幾個距離本來就有主次（描述貼著品名
           4px 是「這兩行是一組」，品名離照片 24px 是「照片結束、文字開始」），全部拉成同一
           個數字等於把那層主次抹平——跟卡片各字級那幾組不能寫死 font-size 是同一個理由。
           所以先把各段各行原本的那個距離宣告成 --card-row-gap-base，再用一條規則乘上去。
           下面那份 base 表對應的是 page.tsx 卡片裡的 mt-* class，改那邊要記得改這邊；沒對到
           的元素退回 0.75rem（一個中間值），至少不會整行的上留白掉成 0。
           橫排（照片在左 / 在右）那組規則把右欄第一行的 margin-top 清成 0，權重比這組高，
           所以橫排時第一行照樣貼齊照片頂端，不會被這格推下來。 */
        section[data-edit-target="collections"] .sproutly-card-title {
          --card-row-gap-base: 1.5rem;
        }
        section[data-edit-target="collections"] .sproutly-card-desc {
          --card-row-gap-base: 0.25rem;
        }
        section[data-edit-target="collections"] .sproutly-card-action {
          --card-row-gap-base: 0.75rem;
        }
        section[data-edit-target="featured"] .sproutly-card-title {
          --card-row-gap-base: 1.25rem;
        }
        section[data-edit-target="featured"] .sproutly-card-price {
          --card-row-gap-base: 0.25rem;
        }
        /* 精選卡片價錢底下那行「剩 N」，跟價錢一樣貼著上一行 4px */
        section[data-edit-target="featured"] .sproutly-card-micro {
          --card-row-gap-base: 0.25rem;
        }
        section[data-edit-target="journal"] .sproutly-card-micro {
          --card-row-gap-base: 1.5rem;
        }
        section[data-edit-target="journal"] .sproutly-card-title,
        section[data-edit-target="journal"] .sproutly-card-desc {
          --card-row-gap-base: 0.75rem;
        }
        /* 慢讀卡片底下那行標籤（摘要後面那個）原本比上面那行分類窄一點，單獨接住 */
        section[data-edit-target="journal"] .sproutly-card-desc + .sproutly-card-micro {
          --card-row-gap-base: 1.25rem;
        }
        section[data-edit-target][data-card-row-gap="tight"] .sproutly-card-title,
        section[data-edit-target][data-card-row-gap="tight"] .sproutly-card-desc,
        section[data-edit-target][data-card-row-gap="tight"] .sproutly-card-price,
        section[data-edit-target][data-card-row-gap="tight"] .sproutly-card-micro,
        section[data-edit-target][data-card-row-gap="tight"] .sproutly-card-action {
          margin-top: calc(var(--card-row-gap-base, 0.75rem) * 0.5);
        }
        section[data-edit-target][data-card-row-gap="loose"] .sproutly-card-title,
        section[data-edit-target][data-card-row-gap="loose"] .sproutly-card-desc,
        section[data-edit-target][data-card-row-gap="loose"] .sproutly-card-price,
        section[data-edit-target][data-card-row-gap="loose"] .sproutly-card-micro,
        section[data-edit-target][data-card-row-gap="loose"] .sproutly-card-action {
          margin-top: calc(var(--card-row-gap-base, 0.75rem) * 1.8);
        }

        /* 卡片副文字深淺：editor 各 section panel「卡片副文字深淺」三按鈕（更淡 / 跟預設 / 加深）。
           指的是卡片上品名底下那行次要文字有多濃——選物卡片的副標、精選商品卡片的價錢，就是
           上面那條 .sproutly-card-meta。那行現在被淡了兩次：顏色本身是 --store-text-muted（文字
           色的七成），外面又套一層全站寫死的 opacity 0.7，乘起來只剩不到五成。上一格才把價錢的
           字級補成可調，可是價錢淡的主因不是小是淡——字放大了還是一行淺灰，在淺底或照片旁邊
           幾乎讀不到；而一株盆栽賣多少常常正是客人在首頁掃過去唯一在找的東西。
           商家原本沒有一格動得到這一層：「內文濃淡」改的是 --store-text-muted，卡片外面這層 0.7
           照樣乘上去（選「濃」也只到七成，永遠追不上品名）；「淡化」透明的是整段連照片一起；
           「文字顏色」換的是整段的色。
           動的是 opacity 這一層不是顏色：那行的顏色寫在 inline style 上（規則蓋不過 inline），而且
           顏色歸「內文濃淡」管、這格只管卡片上這層額外的淡化，兩格各自獨立、疊起來也講得通。
           滑過卡片會亮起來那段（0.7 → 1）三檔都保留相對幅度：更淡 0.45 → 0.65、加深本來就是 1
           所以滑過去不動。不然商家選了更淡，滑鼠一過去那行就跳成全黑，比沒設還突兀。
           規則寫在 .sproutly-card 上（不是 section）讓變數就近落在卡片裡，跟上面那兩條讀變數的
           規則同一個範圍；沒設就沒 attribute，整組規則不存在。 */
        section[data-edit-target][data-card-meta-tone="muted"] .sproutly-card {
          --card-meta-opacity: 0.45;
          --card-meta-opacity-hover: 0.65;
        }
        section[data-edit-target][data-card-meta-tone="strong"] .sproutly-card {
          --card-meta-opacity: 1;
          --card-meta-opacity-hover: 1;
        }

        /* 標題與內容的距離：editor 各 section panel「標題與內容」三按鈕（收緊 / 跟預設 / 放寬）。
           段落最上面那塊（小標 + 大標 + 引言）跟底下卡片、照片、問答之間空多少，是每一段
           寫死的一個值，而且各段差很多——選物 128px、精選與慢讀 112px、常見問題 64px、
           合作 48px。那組值照站上預設內容挑的，換成商家自己的東西常常不對：標題只有兩個字
           的段落中間空一大片，看起來像兩段沒關係的東西；標題底下還有兩三行引言時距離太近，
           引言又跟卡片黏在一起。商家原本沒有一格動得到——「區段空白」「上下外距」調的是
           段落外圍的上下，段落裡面一動也不動。
           要蓋掉的是那塊自己帶的 mb-* class，段落上的 inline style 傳不下去——跟卡片那幾組
           同一個處境同一個解法，attribute 讓這裡補一條更精確的規則壓過去。
           兩檔都用 clamp 而不是寫死一個值：原本那些 mb-* 全是手機一個值、桌機一個值的，
           寫死會讓手機上收緊過頭或放寬到要滑半天。
           標題被拖成自由定位的段落不掛這個 class（那塊是絕對定位的，本來就沒有外距），
           規則自然不會命中。 */
        section[data-edit-target][data-heading-gap="tight"] .sproutly-section-head {
          margin-bottom: clamp(1.75rem, 4vw, 2.5rem);
        }
        section[data-edit-target][data-heading-gap="loose"] .sproutly-section-head {
          margin-bottom: clamp(4.5rem, 10vw, 9rem);
        }

        /* 標題塊裡面的距離：editor 各 section panel「標題塊裡面」三按鈕（收緊 / 跟預設 / 放寬）。
           上面那條調的是整塊標題對外、跟底下卡片之間那一段；這條調的是那塊裡面——小標跟大標
           之間（小標自己帶的 mb-4 / mb-5，16-20px）、大標跟底下那行之間（引言或那截短線自己
           帶的 mt-6，24px）。兩個值同樣是照站上預設那種一行小標配一行大標挑的：商家換成長字
           串小標、兩行大標之後三行黏成一團，分不出誰是標題；反過來只有兩三個字的短標題，中間
           空著會讓小標飄在上面像跟這段沒關係。
           要蓋掉的是那兩行自己帶的 mb-* / mt-* class，段落上的 inline style 傳不下去，改容器
           也動不了它們——跟卡片那幾組同一個處境同一個解法。這份 CSS 沒包在 @layer，
           Tailwind v4 的工具類全在 @layer utilities，沒分層的贏有分層的，所以蓋得過。
           一樣用 clamp 不寫死：原本那些 mb/mt 在手機上就已經偏擠，收緊寫死會黏成一塊。
           規則只落在小標與大標底下那行，大標自己不動（它的位置由上下兩段距離決定）。 */
        section[data-edit-target][data-heading-inner="tight"] .sproutly-section-eyebrow {
          margin-bottom: clamp(0.25rem, 1vw, 0.5rem);
        }
        section[data-edit-target][data-heading-inner="tight"] .sproutly-section-sub {
          margin-top: clamp(0.5rem, 1.6vw, 0.875rem);
        }
        section[data-edit-target][data-heading-inner="loose"] .sproutly-section-eyebrow {
          margin-bottom: clamp(1.25rem, 3.2vw, 2rem);
        }
        section[data-edit-target][data-heading-inner="loose"] .sproutly-section-sub {
          margin-top: clamp(1.75rem, 4.5vw, 2.75rem);
        }

        /* 小標字距：editor 各 section panel「小標字距」三按鈕（收緊 / 跟預設 / 撐開）。
           段落最上面那行小標一律撐開 0.4em，那是照英文全大寫短詞挑的（字母之間本來就有
           空隙，撐開才有雜誌感）。商家打的是中文：「本月選物」四個字每個之間硬塞進 0.4 個
           字寬，看起來不是一個詞是四個各自站著的字；小標長一點的在手機上直接被撐到換行，
           一行變兩行跟大標黏成一團。
           要蓋掉的是那行自己帶的 tracking-[0.4em] class——段落上的「字距」那欄設的是整段的
           inline letter-spacing，元素自己的 class 一律蓋掉繼承來的值，所以整段調字距時小標
           是唯一動都不動的那行。跟標題塊裡面那組同一個處境同一個解法，attribute 讓這裡補
           一條更精確的規則壓過去（這份 CSS 沒包在 @layer，贏在 @layer utilities 的
           Tailwind 工具類）。
           收緊給 0.12em 不給 0：小標的樣式標誌就是那個比內文寬的字距，收到 0 會像漏排版。
           不用 clamp：字距的單位是 em，本來就跟著字級走，手機上字小、撐開的絕對值自然跟著
           小，不像 margin 那樣需要按螢幕寬另外算一組。 */
        section[data-edit-target][data-eyebrow-tracking="tight"] .sproutly-section-eyebrow {
          letter-spacing: 0.12em;
        }
        section[data-edit-target][data-eyebrow-tracking="wide"] .sproutly-section-eyebrow {
          letter-spacing: 0.6em;
        }

        /* 小標字級：editor 各 section panel「小標字級」三按鈕（小 / 跟預設 / 大）。
           上面那組調的是那行字彼此之間空多少，這組調的是那行字本身多大。那行一律 10px
           （選物與精選那兩段是 11px），跟 0.4em 的字距一樣是照英文全大寫短詞挑的——大寫
           字母沒有下伸部、整排等高，10px 還讀得出 NEW ARRIVALS；中文在 10px 是另一回事，
           「本月選物」那種筆畫多的字擠在 10px 裡糊成一團灰塊，而那行偏偏是商家用來標段落
           名字的。反過來把小標當這段主標用的段落（大標只有兩個字、真正在說明的是小標），
           10px 也撐不起來。
           要蓋掉的是那行自己帶的 text-[10px] class：段落上調字級的那幾欄，「標題大小」動的
           是大標、「全網站字體大小」動的是內文那一層，都到不了它——跟上面那組同一個處境
           同一個解法，attribute 讓這裡補一條更精確的規則（這份 CSS 沒包在 @layer，
           贏在 @layer utilities 的 Tailwind 工具類）。
           用 zoom 不用 font-size：10px 與 11px 是各段自己挑的差別，寫死一個 font-size 會把
           兩種拉成同一級（跟內文字級那組同一個理由）。zoom 連著底下那截 margin 一起縮放，
           字放大了跟大標的距離也跟著長，不會出現字變大、間距停在原位的擠感。 */
        section[data-edit-target][data-eyebrow-scale="small"] .sproutly-section-eyebrow {
          zoom: 0.9;
        }
        section[data-edit-target][data-eyebrow-scale="large"] .sproutly-section-eyebrow {
          zoom: 1.3;
        }

        /* 小標粗細：editor 各 section panel「小標粗細」四按鈕（跟預設 / 常規 / 中黑 / 粗）。
           上兩組管的是那行小標的字距與大小，這組管的是那行字本身多重。各段的粗細是寫死的，
           而且分兩種：選物與精選那兩段寫在 inline style 上的 500，其餘八段沒設、繼承下來的
           400。400 那批在 10px 加 0.4em 字距之下筆畫細到在淺底上幾乎看不見；500 那批又是用
           全站主色印的，在大標旁邊搶得比大標前面，退不回配角。
           要蓋的東西兩段不一樣，所以兩條規則一組：一條落在 .sproutly-section-eyebrow 上蓋掉
           繼承來的 400（這份 CSS 沒包在 @layer，贏得過 Tailwind 工具類），一條在 section
           上設 --eyebrow-weight，讓那兩行寫在 inline style 裡的 500 跟著走——inline 的優先度
           連 CSS 規則都壓不過，只能繞變數（跟卡片品名字距同一招）。那兩行的 fontWeight 改讀
           var(--eyebrow-weight, 500)，沒設時變數不存在、fallback 就是原本的 500。
           走 attribute 不走「一個變數配 fallback」：font-weight 的 var() fallback 只能填一個
           固定值，等於沒設定的段落也被那個值一律蓋掉，兩種原本的粗細就被拉平了（跟標題粗細
           同一個理由）。
           給四個值：那兩段本來就是 500，少了「常規」它們沒有一顆按鈕退得回 400。
           只用 400 / 500 / 700 這三個載進來的字重，不給 300——沒載的字重瀏覽器拿常規假變細，
           10px 的中文會直接糊掉，比原本更看不清楚。 */
        section[data-edit-target][data-eyebrow-weight="light"] {
          --eyebrow-weight: 400;
        }
        section[data-edit-target][data-eyebrow-weight="light"] .sproutly-section-eyebrow {
          font-weight: 400;
        }
        section[data-edit-target][data-eyebrow-weight="medium"] {
          --eyebrow-weight: 500;
        }
        section[data-edit-target][data-eyebrow-weight="medium"] .sproutly-section-eyebrow {
          font-weight: 500;
        }
        section[data-edit-target][data-eyebrow-weight="bold"] {
          --eyebrow-weight: 700;
        }
        section[data-edit-target][data-eyebrow-weight="bold"] .sproutly-section-eyebrow {
          font-weight: 700;
        }

        /* 小標行距：editor 各 section panel「小標行距」三按鈕（收緊 / 跟預設 / 拉開）。
           上兩組管的是那行字的橫向（字距）與大小，這組管的是它排到第二行之後上下隔多遠。
           那行很容易換行——自己帶著 0.4em 的字距，四個中文字佔的寬度接近六個字，小標打長
           一點、或「小標字級」按到大之後，手機上一行放不下是常態。
           跟上兩組不同的是這裡要蓋的不是它自己的 class（那行沒帶 leading-*），是從段落那層
           繼承下來的內文行高：站上預設 1.7 上下、商家把「行高」按到舒展就是 2，那個值是給
           一整段要讀的字挑的，套在 10px 的標籤上兩行之間空得比字還高，看起來像上下兩個沒
           關係的小標。唯一動得到它的是「行高」那一欄，但那條規則落在 :is(p, li, blockquote,
           figcaption, dd) 上，收緊小標的同時整段的描述、引言、答案全部一起被收緊。
           所以這兩條寫成 attribute + class：屬性數比行高那條多一個（那條是 section + 2 個
           attribute + 元素），無論商家有沒有同時設行高都壓得過去。
           收緊給 1.15 不給更小：中文的字在行框裡本來就佔滿，1.0 以下上下兩行會疊到筆畫。
           沒設就沒 attribute、整條規則不存在，既有店家的小標一行字都不會動。 */
        section[data-edit-target][data-eyebrow-leading="tight"] .sproutly-section-eyebrow {
          line-height: 1.15;
        }
        section[data-edit-target][data-eyebrow-leading="loose"] .sproutly-section-eyebrow {
          line-height: 2.2;
        }

        /* 小標大小寫：editor 各 section panel「小標大小寫」三按鈕（全大寫 / 字首大寫 / 照原樣）。
           上面幾組管的是那行小標的字距、大小、粗細、行距，這組管的是那行字被轉成什麼字形。
           那行一律 uppercase，跟 10px 與 0.4em 是同一個設計決定的三個面向（全大寫的英文短詞
           撐開字距，是雜誌上 eyebrow 的標準寫法）。中文沒有大小寫之分，這條對只打中文的段落
           按了不會動；問題在英文與混排：商家把小標打成自己的英文店名（Plantae Market）會被拉成
           PLANTAE MARKET，而店名的大小寫通常是 logo 的一部分，打「Est. 2019」變 EST. 2019，
           「Journal 慢讀」只有前半被改。而且商家改字沒用——轉換發生在畫面上不在資料裡，輸入框
           看到的還是自己打的小寫。
           要蓋掉的是那行自己帶的 uppercase class（段落那層沒有一欄傳得下去），跟小標字距、字級
           同一個處境同一個解法：attribute 讓這裡補一條更精確的規則壓過去（這份 CSS 沒包在
           @layer，贏在 @layer utilities 的 Tailwind 工具類）。
           三檔裡留「全大寫」是因為那十六行本來就是 uppercase，少了這一檔按過 capitalize 之後
           沒有一顆按鈕退得回原本的樣子（跟小標粗細留「常規」同一個理由）。它是「照原本的」那一
           檔，按下去等於把這一欄清掉，所以這裡只有另外兩檔有規則（跟小標粗細沒有 normal 那條
           同一個道理）。
           沒設就沒 attribute、整條規則不存在，既有店家的小標一個字都不會變。 */
        section[data-edit-target][data-eyebrow-case="capitalize"] .sproutly-section-eyebrow {
          text-transform: capitalize;
        }
        section[data-edit-target][data-eyebrow-case="none"] .sproutly-section-eyebrow {
          text-transform: none;
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

      {/* 頁尾的顏色：底色與文字色是商家可挑的兩個值（見 _theme layout.footerBg /
          footerText），其餘四種深淺全部從那兩個算出來——次要文字是文字色的七成（跟各段落
          自訂文字色那套同一個口徑）、上下那幾條短線 28%、點綴色壓在自訂底色上看不見時
          換成文字色（跟 mergeSectionStyle 的 sectionAccent 同一道防呆）。
          兩個都沒設就整組退回 theme 原本的值，既有店家的頁尾一個像素都不動。 */}
      <footer
        className="border-t mt-16"
        style={{
          borderColor: fBorder,
          backgroundColor: fBg,
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
                  color: fMuted,
                  fontSize: "0.6875rem",
                  letterSpacing: "0.4em",
                }}
              >
                {theme.homepage.footerWordsLabel || HOMEPAGE_DEFAULTS.footerWordsLabel}
              </p>
              <p
                className="italic"
                style={{
                  color: fAccent,
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
                  style={{ background: fAccent, opacity: 0.6 }}
                />
                <span
                  data-edit-text
                  data-edit-field="footerVisitLabel"
                  className="font-medium uppercase"
                  style={{
                    color: fMuted,
                    fontSize: "0.6875rem",
                    letterSpacing: "0.4em",
                  }}
                >
                  {theme.homepage.footerVisitLabel || HOMEPAGE_DEFAULTS.footerVisitLabel}
                </span>
                <span
                  className="h-px w-10"
                  style={{ background: fAccent, opacity: 0.6 }}
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
                      style={{ color: fText, letterSpacing: "0.02em" }}
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
                      style={{ color: fText, letterSpacing: "0.04em" }}
                    >
                      {footerPhone}
                    </a>
                  </p>
                )}
                {footerHours && (
                  <p
                    className="whitespace-pre-line"
                    style={{ color: fMuted, letterSpacing: "0.02em" }}
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
                    color: fMuted,
                    fontSize: "0.6875rem",
                    letterSpacing: "0.4em",
                  }}
                >
                  {theme.homepage.footerFollowLabel || HOMEPAGE_DEFAULTS.footerFollowLabel}
                </span>
                <span
                  className="h-px w-10"
                  style={{ background: fAccent, opacity: 0.6 }}
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
                      color: fMuted,
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
                      color: fMuted,
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
                      color: fMuted,
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
              style={{ background: fBorder }}
            />
            <Link
              href={`/${slug}/track`}
              className="sproutly-link uppercase"
              style={{
                color: fMuted,
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
              style={{ background: fBorder }}
            />
          </div>

          <p
            className="uppercase"
            style={{
              color: fMuted,
              opacity: 0.7,
              fontSize: "0.6875rem",
              letterSpacing: "0.32em",
            }}
          >
            © {new Date().getFullYear()} {store.name} · Powered by{" "}
            <Link
              href="/"
              className="sproutly-link font-medium"
              style={{ color: fMuted, letterSpacing: "0.32em" }}
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
