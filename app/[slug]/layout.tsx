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
import { resolveTheme, themeToCssVars } from "./_theme";
import { FavoritesCounter } from "@/app/_components/favorite-button";
import { CartIcon } from "@/app/_components/cart-icon";
import { SearchOverlay } from "@/app/_components/search-overlay";
import { EditorClickBridge } from "@/app/_components/editor-click-bridge";

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
  const description =
    store.description ?? `${store.name} · 在 Sproutly 上的線上店面`;
  const ogImage = theme.heroUrl || theme.logoUrl || null;
  const iconUrl = theme.logoUrl;

  return {
    title: {
      default: store.name,
      template: `%s · ${store.name}`,
    },
    description,
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
    .select("name, slug, theme, is_published")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);
  const cssVars = themeToCssVars(theme);

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

        /* Hero 圖視差：滾動時圖往上推、放大 */
        .sproutly-hero-parallax {
          animation: sproutly-hero-parallax linear;
          animation-timeline: scroll(root);
          animation-range: 0vh 100vh;
        }
        @keyframes sproutly-hero-parallax {
          from { transform: scale(1.0) translate3d(0, 0, 0); }
          to { transform: scale(1.15) translate3d(0, -80px, 0); }
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

        /* Layered elevation tokens（給卡片 / hero / button 共用） */
        :root {
          --sproutly-elev-1:
            0 1px 2px rgba(0, 0, 0, 0.04),
            0 2px 8px -2px rgba(0, 0, 0, 0.04);
          --sproutly-elev-2:
            0 1px 2px rgba(0, 0, 0, 0.04),
            0 4px 14px -4px rgba(0, 0, 0, 0.06),
            0 16px 32px -16px rgba(0, 0, 0, 0.06);
          --sproutly-elev-3:
            0 2px 4px rgba(0, 0, 0, 0.05),
            0 12px 28px -8px rgba(0, 0, 0, 0.08),
            0 32px 56px -24px rgba(0, 0, 0, 0.12);
          --sproutly-elev-4:
            0 4px 8px rgba(0, 0, 0, 0.06),
            0 24px 40px -12px rgba(0, 0, 0, 0.12),
            0 48px 80px -32px rgba(0, 0, 0, 0.18);
        }

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
      `}</style>

      {/* iframe edit mode bridge（只在 ?edit=1 啟動） */}
      <EditorClickBridge />

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
              className="font-semibold text-lg tracking-tight truncate group-hover:opacity-70 transition"
              style={{ color: theme.text }}
            >
              {store.name}
            </span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 sm:px-4 py-2 text-sm transition whitespace-nowrap hover:opacity-100"
                style={{ color: theme.textMuted }}
              >
                {item.label}
              </Link>
            ))}
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
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer
        className="border-t mt-16"
        style={{
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-10 text-center space-y-4">
          {theme.tagline && (
            <p
              className="text-sm italic"
              style={{ color: theme.accent, fontFamily: "var(--store-font)" }}
            >
              {theme.tagline}
            </p>
          )}

          <Link
            href={`/${slug}/track`}
            className="text-xs hover:opacity-100 transition inline-block underline-offset-4 hover:underline"
            style={{ color: theme.textMuted }}
          >
            訂單追蹤
          </Link>

          {showSocial && (
            <div className="flex justify-center gap-4">
              {theme.social.instagram && (
                <a
                  href={theme.social.instagram}
                  target="_blank"
                  rel="noopener"
                  className="text-sm hover:opacity-100 transition"
                  style={{ color: theme.textMuted }}
                >
                  Instagram
                </a>
              )}
              {theme.social.facebook && (
                <a
                  href={theme.social.facebook}
                  target="_blank"
                  rel="noopener"
                  className="text-sm hover:opacity-100 transition"
                  style={{ color: theme.textMuted }}
                >
                  Facebook
                </a>
              )}
              {theme.social.line && (
                <a
                  href={theme.social.line}
                  target="_blank"
                  rel="noopener"
                  className="text-sm hover:opacity-100 transition"
                  style={{ color: theme.textMuted }}
                >
                  LINE
                </a>
              )}
            </div>
          )}

          <p className="text-xs" style={{ color: theme.textMuted, opacity: 0.7 }}>
            © {new Date().getFullYear()} {store.name} · Powered by{" "}
            <Link
              href="/"
              className="hover:opacity-100 transition font-medium"
              style={{ color: theme.textMuted }}
            >
              Sproutly
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
