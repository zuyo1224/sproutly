import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme, HOMEPAGE_DEFAULTS, HOMEPAGE_DEFAULT_COLLECTIONS } from "./_theme";
import HeroAdaptiveBanner from "./HeroAdaptiveBanner";

type Params = Promise<{ slug: string }>;

function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "TWD") return `NT$ ${amount.toLocaleString("zh-TW")}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export default async function StoreHomePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  const { data: featuredProducts } = await supabase
    .from("sproutly_products")
    .select("id, name, price_cents, currency, image_urls")
    .eq("merchant_id", store.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(theme.layout.featuredCount);

  const businessHoursText =
    typeof store.business_hours === "object" && store.business_hours !== null
      ? ((store.business_hours as { text?: string }).text ?? "")
      : "";

  // ===== 首頁文案：商家自訂優先，沒設用 default =====
  const heroTagline =
    theme.tagline || "為你的角落，找一株剛剛好的植物。";
  const collectionsIntro =
    theme.homepage.collectionsIntro || HOMEPAGE_DEFAULTS.collectionsIntro;
  const promiseText = theme.homepage.promise || HOMEPAGE_DEFAULTS.promise;
  const promiseEyebrow =
    theme.homepage.promiseEyebrow || HOMEPAGE_DEFAULTS.promiseEyebrow;
  const featuredTitle =
    theme.homepage.featuredTitle || HOMEPAGE_DEFAULTS.featuredTitle;
  const featuredEyebrow =
    theme.homepage.featuredEyebrow ?? HOMEPAGE_DEFAULTS.featuredEyebrow;
  const featuredCta =
    theme.homepage.featuredCta || HOMEPAGE_DEFAULTS.featuredCta;
  const visitTitle =
    theme.homepage.visitTitle || HOMEPAGE_DEFAULTS.visitTitle;
  const visitEyebrow =
    theme.homepage.visitEyebrow ?? HOMEPAGE_DEFAULTS.visitEyebrow;
  const collectionsConfig =
    theme.homepage.collectionItems.length > 0
      ? theme.homepage.collectionItems
      : HOMEPAGE_DEFAULT_COLLECTIONS;

  // 篩出有情境照的提案
  const visibleCollections = collectionsConfig
    .map((c) => ({ ...c, image: theme.collections[c.key] }))
    .filter((c) => c.image);

  // 中文按全形標點自然分行
  const splitByPunc = (s: string) =>
    s
      .split(/(?<=[，、。！？])/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  const taglineLines = splitByPunc(heroTagline);
  const introLines = splitByPunc(collectionsIntro);
  const promiseLines = promiseText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const animClass = theme.homepage.enableAnimation ? "sproutly-subtle-fade" : "";

  // 各 section 樣式 helper：背景色 + 標題對齊 + 上下空白覆寫（北極星：超越 Wix 元素級控制覆蓋率）
  // padOverride 用 CSS variable 覆寫該 section 的 --store-section-pad，
  // 沒設定 = 跟著全網站 sectionPaddingScale（透過 layout.tsx 的 attribute selector 套用）
  const padScaleToVar = (s: "compact" | "default" | "spacious" | undefined) =>
    s === "compact" ? 0.6 : s === "spacious" ? 1.4 : s === "default" ? 1 : undefined;
  const headingScaleToVar = (s: "small" | "default" | "large" | undefined) =>
    s === "small" ? 0.85 : s === "large" ? 1.25 : s === "default" ? 1 : undefined;
  // 最小高度：auto 不設定 / tall 80vh / fullscreen 100vh
  const minHeightToVal = (s: "auto" | "tall" | "fullscreen" | undefined) =>
    s === "tall" ? "80vh" : s === "fullscreen" ? "100vh" : undefined;
  // 外框：用 outline 不用 border 避免跟 divider borderTop/Bottom 衝突；outline-offset 設 negative 內凹
  const outlineToVal = (s: "none" | "subtle" | "strong" | undefined) => {
    if (s === "subtle") return { outline: `1px solid ${theme.border}`, outlineOffset: "-1px" };
    if (s === "strong") return { outline: `2px solid ${theme.border}`, outlineOffset: "-2px" };
    return undefined;
  };
  // 陰影：soft 淺浮起 / deep 深浮起，雙層 box-shadow 模擬 elev 系統
  const shadowToVal = (s: "none" | "soft" | "deep" | undefined) => {
    if (s === "soft") return "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)";
    if (s === "deep") return "0 2px 4px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.1)";
    return undefined;
  };
  // 圓角：soft 16px / strong 32px，搭配 bgColor + outline + shadow 三件套讓 section 像卡片
  const radiusToVal = (s: "none" | "soft" | "strong" | undefined) => {
    if (s === "soft") return "16px";
    if (s === "strong") return "32px";
    return undefined;
  };
  // 字體：serif 思源宋體（雜誌風）/ sans 思源黑體（現代），對齊 _theme.ts FONT_LABELS 的 noto-serif / noto
  const fontFamilyToVal = (s: "default" | "serif" | "sans" | undefined) => {
    if (s === "serif") return "var(--font-noto-serif), 'Times New Roman', serif";
    if (s === "sans") return "var(--font-noto), system-ui, sans-serif";
    return undefined;
  };
  // 字距：tight 緊（-0.02em，現代感）/ wide 寬（0.12em，雜誌大標）/ normal 預設不套
  const letterSpacingToVal = (s: "tight" | "normal" | "wide" | undefined) => {
    if (s === "tight") return "-0.02em";
    if (s === "wide") return "0.12em";
    return undefined;
  };
  // 行高：tight 緊湊（1.4，標題密集感）/ relaxed 舒展（2.0，長段落呼吸感）/ normal 預設不套
  // line-height 是 CSS inherited 屬性，套到 section 後內文 / 副題 / 描述會自動繼承；
  // 大標自己 inline 設的 lineHeight 1.2 不受影響（直接 override 繼承值）
  const lineHeightToVal = (s: "tight" | "normal" | "relaxed" | undefined) => {
    if (s === "tight") return 1.4;
    if (s === "relaxed") return 2.0;
    return undefined;
  };
  // 淡化：muted 0.85 / faint 0.7 / default 不套
  // 純 inline opacity，整段 section 都變淡（含 children）
  // 適合 partners / stats / faq 這種次要 section 變灰階感，襯托 hero / featured 跳出
  const opacityToVal = (s: "default" | "muted" | "faint" | undefined) => {
    if (s === "muted") return 0.85;
    if (s === "faint") return 0.7;
    return undefined;
  };
  // 濾鏡：grayscale 黑白（partners / gallery 雜誌感）/ sepia 復古褐（journal 懷舊感）/ none 不套
  // CSS filter 套整段 section，所有 children（含圖片 / 文字 / icon）自動繼承視覺效果
  // sepia 加 brightness(1.02) 補回變暗的亮度，避免整段沉下去
  const filterToVal = (s: "none" | "grayscale" | "sepia" | undefined) => {
    if (s === "grayscale") return "grayscale(1)";
    if (s === "sepia") return "sepia(0.6) brightness(1.02)";
    return undefined;
  };
  const sectionStyleFor = (key: string) => {
    const s = theme.layout.sectionStyles[key];
    const padVar = padScaleToVar(s?.paddingScale);
    const headingVar = headingScaleToVar(s?.headingScale);
    const minH = minHeightToVal(s?.minHeight);
    const outline = outlineToVal(s?.outline);
    const shadow = shadowToVal(s?.shadow);
    const radius = radiusToVal(s?.borderRadius);
    const font = fontFamilyToVal(s?.fontFamily);
    const letterSpacing = letterSpacingToVal(s?.letterSpacing);
    const lineHeight = lineHeightToVal(s?.lineHeight);
    const opacity = opacityToVal(s?.opacity);
    const filter = filterToVal(s?.filter);
    // 進場動畫：只回 "fade" / "slide-up" 給 wrapper 設 data-anim attr；
    // 實際 CSS keyframes + scroll-timeline 在 layout.tsx 注入；edit mode 內 disable
    const entranceVal: "fade" | "slide-up" | undefined =
      s?.entrance === "fade" || s?.entrance === "slide-up" ? s.entrance : undefined;
    return {
      bg: s?.bgColor ?? undefined,
      text: s?.textColor ?? undefined,
      align: s?.headingAlign ?? "center",
      padOverride: padVar,
      divider: s?.divider ?? "none",
      headingOverride: headingVar,
      minHeightOverride: minH,
      outlineOverride: outline,
      shadowOverride: shadow,
      borderRadiusOverride: radius,
      fontFamilyOverride: font,
      letterSpacingOverride: letterSpacing,
      lineHeightOverride: lineHeight,
      opacityOverride: opacity,
      filterOverride: filter,
      entranceVal,
    } as { bg: string | undefined; text: string | undefined; align: "left" | "center" | "right"; padOverride: number | undefined; divider: "none" | "top" | "bottom" | "both"; headingOverride: number | undefined; minHeightOverride: string | undefined; outlineOverride: { outline: string; outlineOffset: string } | undefined; shadowOverride: string | undefined; borderRadiusOverride: string | undefined; fontFamilyOverride: string | undefined; letterSpacingOverride: string | undefined; lineHeightOverride: number | undefined; opacityOverride: number | undefined; filterOverride: string | undefined; entranceVal: "fade" | "slide-up" | undefined };
  };

  // 把背景色 + 文字色 + padOverride + 分隔線 + 標題字級合併成 section 用的 inline style
  // 自訂 CSS variable 在 TS CSSProperties 預設沒有，所以走 Record<string, unknown> cast
  // 文字色用 color + 覆寫 --store-text / --store-text-muted CSS var
  // 讓 muted 文字（副題 / eyebrow）也跟著走，避免淺底深字 section 突然有深底白字時 muted 還是深的看不見
  // 標題字級 --store-heading-scale 由 layout.tsx 的 attribute selector 套到 h2 上（em 相對倍率）
  const mergeSectionStyle = (
    s: { bg: string | undefined; text: string | undefined; padOverride: number | undefined; divider: "none" | "top" | "bottom" | "both"; headingOverride: number | undefined; minHeightOverride: string | undefined; outlineOverride: { outline: string; outlineOffset: string } | undefined; shadowOverride: string | undefined; borderRadiusOverride: string | undefined; fontFamilyOverride: string | undefined; letterSpacingOverride: string | undefined; lineHeightOverride: number | undefined; opacityOverride: number | undefined; filterOverride: string | undefined },
    fallbackBg?: string
  ): React.CSSProperties | undefined => {
    const out: Record<string, unknown> = {};
    const bg = s.bg ?? fallbackBg;
    if (bg) out.backgroundColor = bg;
    if (s.text) {
      out.color = s.text;
      out["--store-text"] = s.text;
      out["--store-text-muted"] = s.text + "B3"; // 加 ~70% alpha 給 muted 用
    }
    if (s.padOverride !== undefined) out["--store-section-pad"] = String(s.padOverride);
    if (s.headingOverride !== undefined) out["--store-heading-scale"] = String(s.headingOverride);
    if (s.minHeightOverride !== undefined) out.minHeight = s.minHeightOverride;
    if (s.divider === "top" || s.divider === "both") {
      out.borderTop = `1px solid ${theme.border}`;
    }
    if (s.divider === "bottom" || s.divider === "both") {
      out.borderBottom = `1px solid ${theme.border}`;
    }
    if (s.outlineOverride) {
      out.outline = s.outlineOverride.outline;
      out.outlineOffset = s.outlineOverride.outlineOffset;
    }
    if (s.shadowOverride) {
      out.boxShadow = s.shadowOverride;
    }
    if (s.borderRadiusOverride) {
      out.borderRadius = s.borderRadiusOverride;
    }
    if (s.fontFamilyOverride) {
      out.fontFamily = s.fontFamilyOverride;
    }
    if (s.letterSpacingOverride) {
      out.letterSpacing = s.letterSpacingOverride;
    }
    if (s.lineHeightOverride !== undefined) {
      out.lineHeight = s.lineHeightOverride;
    }
    if (s.opacityOverride !== undefined) {
      out.opacity = s.opacityOverride;
    }
    if (s.filterOverride) {
      out.filter = s.filterOverride;
    }
    return Object.keys(out).length > 0 ? (out as React.CSSProperties) : undefined;
  };

  const BASE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://sproutly-drab.vercel.app";

  const storeJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    url: `${BASE_URL}/${slug}`,
  };
  if (store.description) storeJsonLd.description = store.description;
  if (theme.heroUrl) storeJsonLd.image = theme.heroUrl;
  if (store.logo_url) storeJsonLd.logo = store.logo_url;
  if (store.contact_phone) storeJsonLd.telephone = store.contact_phone;
  if (store.contact_email) storeJsonLd.email = store.contact_email;
  if (store.address) {
    storeJsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: store.address,
      addressCountry: "TW",
    };
  }
  if (businessHoursText) storeJsonLd.openingHours = businessHoursText;

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
      />
      <style>{`
        @keyframes sproutly-subtle-fade {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sproutly-subtle-fade {
          animation: sproutly-subtle-fade 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-timeline: view();
          animation-range: entry 0% entry 40%;
        }
        @keyframes sproutly-hero-fade {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sproutly-hero-fade-1 { animation: sproutly-hero-fade 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both; }
        .sproutly-hero-fade-2 { animation: sproutly-hero-fade 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.8s both; }
        .sproutly-hero-fade-3 { animation: sproutly-hero-fade 1.4s cubic-bezier(0.22, 1, 0.36, 1) 1.3s both; }
        @media (prefers-reduced-motion: reduce) {
          .sproutly-subtle-fade,
          .sproutly-hero-fade-1,
          .sproutly-hero-fade-2,
          .sproutly-hero-fade-3 {
            animation: none !important;
          }
        }
      `}</style>

      <main>
        {/* === Hero（4 種 variant，商家可選） === */}
        {(() => {
          const heroStyle = theme.layout.heroStyle;
          const fade1 = theme.homepage.enableAnimation ? "sproutly-hero-fade-1" : "";
          const fade2 = theme.homepage.enableAnimation ? "sproutly-hero-fade-2" : "";
          const fade3 = theme.homepage.enableAnimation ? "sproutly-hero-fade-3" : "";

          // Variant 1: full-image — 自適應 banner（圖 + 文字段），手機 / 桌機 同一套
          if (heroStyle === "full-image" && theme.heroUrl) {
            // Hero 高度策略
            const heroHeightClass =
              theme.layout.heroHeight === "short"
                ? "min-h-[60vh]"
                : theme.layout.heroHeight === "tall"
                ? "min-h-[80vh]"
                : theme.layout.heroHeight === "full"
                ? "min-h-screen"
                : ""; // auto
            const taglineColor =
              theme.layout.heroTaglineColor ?? theme.text;
            const taglineFontScale = theme.layout.heroTaglineFontScale;
            const taglineAlign = theme.layout.heroTaglineAlign;
            return (
              <section
                className={heroHeightClass}
                data-edit-target="hero"
                data-edit-label="Hero 區段"
              >
                {/* 自適應 banner — client 偵測圖片自帶 padding，banner aspect 動態算成
                    剛好框住內容本體的比例，不論手機 / 平板 / 桌機都用同一套：
                    圖以自身比例顯示，不再 h-screen 強制 overlay、不再 transform scale 放大圖片。 */}
                <HeroAdaptiveBanner url={theme.heroUrl} alt={store.name} />
                {(() => {
                  // 主標拖動：data-edit-drag 只綁在 h1，不綁外層整塊。
                  // 拖動座標範圍 = cream block（position:relative wrapper）。
                  const taglinePos = theme.layout.freePositions["hero-tagline"] ?? null;
                  return (
                <div
                  className="relative px-6 sm:px-12 py-14 sm:py-20"
                  style={{ backgroundColor: theme.bg, minHeight: taglinePos ? "300px" : undefined }}
                  data-edit-target="hero-text-area"
                >
                  <div
                    className={taglinePos ? "" : "max-w-4xl mx-auto"}
                    style={{ textAlign: taglineAlign }}
                  >
                    <h1
                      className={`leading-[1.6] ${fade1}`}
                      style={
                        taglinePos
                          ? {
                              position: "absolute",
                              left: `${taglinePos.x * 100}%`,
                              top: `${taglinePos.y * 100}%`,
                              transform: "translate(-50%, -50%)",
                              maxWidth: "min(800px, 90%)",
                              color: taglineColor,
                              fontFamily: "var(--store-font)",
                              fontWeight: 400,
                              letterSpacing: "0.02em",
                              wordBreak: "keep-all",
                              overflowWrap: "break-word",
                              fontSize: `clamp(${1.5 * taglineFontScale}rem, ${3 * taglineFontScale}vw, ${3 * taglineFontScale}rem)`,
                            }
                          : {
                              color: taglineColor,
                              fontFamily: "var(--store-font)",
                              fontWeight: 400,
                              letterSpacing: "0.02em",
                              wordBreak: "keep-all",
                              overflowWrap: "break-word",
                              fontSize: `clamp(${1.5 * taglineFontScale}rem, ${3 * taglineFontScale}vw, ${3 * taglineFontScale}rem)`,
                            }
                      }
                      data-edit-text
                      data-edit-field="tagline"
                      data-edit-drag="hero-tagline"
                    >
                      {taglineLines.map((line, i) => (
                        <span key={i} className="block">
                          {line}
                        </span>
                      ))}
                    </h1>
                    {!taglinePos && (
                      <Link
                        href={`/${slug}/shop`}
                        className={`sproutly-link mt-8 inline-block text-sm tracking-wider ${fade2}`}
                        data-default-line="true"
                        style={{
                          color: theme.text,
                          fontFamily: "var(--store-font)",
                        }}
                      >
                        看商品
                      </Link>
                    )}
                  </div>
                </div>
                  );
                })()}
              </section>
            );
          }

          // Variant 2: split — 左/右 50:50（圖 + 文字）
          if (heroStyle === "split" && theme.heroUrl) {
            const imageOnRight = theme.layout.heroImageSide === "right";
            return (
              <section
                className="relative grid grid-cols-1 md:grid-cols-2 min-h-[80vh] md:min-h-screen overflow-hidden"
                style={{ background: theme.bg }}
                data-edit-target="hero"
                data-edit-label="Hero 區段"
              >
                <div
                  className={`relative aspect-square md:aspect-auto md:h-full ${imageOnRight ? "md:order-2" : ""}`}
                >
                  <Image
                    src={theme.heroUrl}
                    alt={store.name}
                    fill
                    priority
                    sizes="(min-width: 768px) 50vw, 100vw"
                    quality={85}
                    className="object-cover"
                  />
                </div>
                <div
                  className={`flex flex-col justify-center px-8 sm:px-12 md:px-16 lg:px-24 py-20 md:py-0 ${imageOnRight ? "md:order-1" : ""}`}
                >
                  {theme.layout.heroEyebrow && (
                    <p
                      data-edit-text
                      data-edit-field="heroEyebrow"
                      className={`text-[10px] tracking-[0.4em] uppercase mb-6 ${fade1}`}
                      style={{ color: theme.accent }}
                    >
                      {theme.layout.heroEyebrow}
                    </p>
                  )}
                  <h1
                    className={`text-3xl sm:text-4xl lg:text-5xl xl:text-6xl leading-[1.15] ${fade1}`}
                    style={{
                      color: theme.text,
                      fontFamily: "var(--store-font)",
                      fontWeight: 400,
                      letterSpacing: "-0.01em",
                      wordBreak: "keep-all",
                      overflowWrap: "break-word",
                    }}
                    data-edit-text
                    data-edit-field="tagline"
                  >
                    {taglineLines.map((line, i) => (
                      <span key={i} className="block">
                        {line}
                      </span>
                    ))}
                  </h1>
                  {theme.layout.heroSubtitle && (
                    <p
                      data-edit-text
                      data-edit-field="heroSubtitle"
                      className={`mt-6 text-base sm:text-lg leading-[1.9] max-w-md ${fade2}`}
                      style={{ color: theme.textMuted }}
                    >
                      {theme.layout.heroSubtitle}
                    </p>
                  )}
                  <div className={`mt-10 flex gap-5 ${fade3}`}>
                    <Link
                      href={`/${slug}/shop`}
                      className="sproutly-btn sproutly-btn-primary sproutly-btn-lg"
                    >
                      看商品
                    </Link>
                    {theme.sections.about && (
                      <Link
                        href={`/${slug}/about`}
                        className="sproutly-btn sproutly-btn-secondary sproutly-btn-lg"
                      >
                        關於我們
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            );
          }

          // Variant 3: magazine — 雜誌封面風（上 metadata、中央大字、下 byline）
          if (heroStyle === "magazine") {
            return (
              <section
                className="relative min-h-screen flex flex-col justify-between py-20 sm:py-28"
                style={{ background: theme.bg }}
                data-edit-target="hero"
                data-edit-label="Hero 區段"
              >
                {/* 上方 metadata 條 */}
                <div className="max-w-6xl mx-auto px-8 sm:px-12 w-full">
                  <div
                    className={`flex justify-between items-center text-[10px] tracking-[0.32em] uppercase ${fade1}`}
                    style={{ color: theme.textMuted }}
                  >
                    <span>{theme.layout.heroEyebrow || "Issue"}</span>
                    <span>{store.name}</span>
                  </div>
                  <div
                    className="mt-4 h-px w-full"
                    style={{ background: theme.border }}
                  />
                </div>

                {/* 中央大字 */}
                <div className="max-w-5xl mx-auto px-8 sm:px-12 text-center w-full">
                  <h1
                    className={`text-4xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05] ${fade1}`}
                    style={{
                      color: theme.text,
                      fontFamily: "var(--store-font)",
                      fontWeight: 400,
                      letterSpacing: "-0.02em",
                      wordBreak: "keep-all",
                      overflowWrap: "break-word",
                    }}
                    data-edit-text
                    data-edit-field="tagline"
                  >
                    {taglineLines.map((line, i) => (
                      <span key={i} className="block">
                        {line}
                      </span>
                    ))}
                  </h1>
                  {theme.layout.heroSubtitle && (
                    <p
                      className={`mt-8 text-base sm:text-lg italic max-w-xl mx-auto leading-[1.9] ${fade2}`}
                      style={{ color: theme.textMuted }}
                    >
                      {theme.layout.heroSubtitle}
                    </p>
                  )}
                </div>

                {/* 下方 byline + CTA */}
                <div className="max-w-6xl mx-auto px-8 sm:px-12 w-full">
                  <div
                    className="h-px w-full mb-4"
                    style={{ background: theme.border }}
                  />
                  <div
                    className={`flex justify-between items-center text-[10px] tracking-[0.32em] uppercase ${fade3}`}
                    style={{ color: theme.textMuted }}
                  >
                    <span>
                      Curated by {store.name}
                    </span>
                    <Link
                      href={`/${slug}/shop`}
                      className="sproutly-link"
                      data-default-line="true"
                      style={{ color: theme.text }}
                    >
                      看商品 →
                    </Link>
                  </div>
                </div>
              </section>
            );
          }

          // Variant 4: minimal（無圖純文字大字 hero）+ 既有 full-image 但無 heroUrl 的 fallback
          return (
            <section
              className="max-w-3xl mx-auto px-6 py-40 sm:py-56 text-center"
              style={{ background: theme.bg }}
              data-edit-target="hero"
              data-edit-label="Hero 區段"
            >
              {theme.layout.heroEyebrow && (
                <p
                  className={`text-[10px] tracking-[0.4em] uppercase mb-8 ${fade1}`}
                  style={{ color: theme.accent }}
                >
                  {theme.layout.heroEyebrow}
                </p>
              )}
              <h1
                className={`text-3xl sm:text-5xl md:text-6xl leading-[1.2] ${fade1}`}
                style={{
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                  letterSpacing: "-0.015em",
                  wordBreak: "keep-all",
                  overflowWrap: "break-word",
                }}
                data-edit-text
                data-edit-field="tagline"
              >
                {taglineLines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </h1>
              {theme.layout.heroSubtitle && (
                <p
                  className={`mt-8 text-base sm:text-lg max-w-xl mx-auto leading-[1.9] ${fade2}`}
                  style={{ color: theme.textMuted }}
                >
                  {theme.layout.heroSubtitle}
                </p>
              )}
              <div
                className={`mx-auto mt-10 ${fade2}`}
                style={{
                  width: "48px",
                  height: "1px",
                  background: theme.accent,
                  opacity: 0.5,
                }}
              />
              <Link
                href={`/${slug}/shop`}
                className={`sproutly-btn sproutly-btn-primary sproutly-btn-lg mt-12 ${fade3}`}
              >
                看商品
              </Link>
            </section>
          );
        })()}

        {/* === 選物提案 === */}
        {visibleCollections.length > 0 && (() => {
          // free positioning 暫時停用（舊座標導致 absolute 重疊）
          const introPos = theme.layout.freePositions["__disabled__"] ?? null;
          // 暫時 disable 所有 section 的 free positioning，舊 DB 座標會把
          // collection-intro / featured-title / journal-intro / promise-card /
          // visit-card / testimonials-title 各種跑掉 absolute 重疊。等正式
          // free-positioning feature 重做再開回來。
          const introFree = false; void introPos;
          const collStyle = sectionStyleFor("collections");
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${introFree ? "min-h-[60vh]" : ""}`}
            data-edit-target="collections"
            data-edit-label="選物提案"
            data-anim={collStyle.entranceVal}
            style={mergeSectionStyle(collStyle)}
          >
            <div className="max-w-5xl mx-auto px-8 sm:px-12" style={{ textAlign: collStyle.align }}>
              {introFree ? (
                <h2
                  data-edit-text
                  data-edit-field="collectionsIntro"
                  data-edit-drag="collection-intro"
                  className="absolute text-xl sm:text-2xl leading-[1.9]"
                  style={{
                    left: `${introPos!.x * 100}%`,
                    top: `${introPos!.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    maxWidth: "min(560px, 80vw)",
                    width: "100%",
                    color: theme.text,
                    fontFamily: "var(--store-font)",
                    fontWeight: 400,
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                  }}
                >
                  {introLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </h2>
              ) : (
                <h2
                  data-edit-text
                  data-edit-field="collectionsIntro"
                  data-edit-drag="collection-intro"
                  className={`text-xl sm:text-2xl max-w-xl ${collStyle.align === "center" ? "mx-auto" : collStyle.align === "right" ? "ml-auto" : ""} mb-32 leading-[1.9]`}
                  style={{
                    color: theme.text,
                    fontFamily: "var(--store-font)",
                    fontWeight: 400,
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                  }}
                >
                  {introLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </h2>
              )}

              <div className={`sproutly-stagger grid grid-cols-2 gap-x-6 sm:gap-x-12 gap-y-20 sm:gap-y-24 ${
                theme.layout.collectionsColumns === 2 ? "sm:grid-cols-2"
                : theme.layout.collectionsColumns === 4 ? "sm:grid-cols-4"
                : "sm:grid-cols-3"
              }`}>
                {visibleCollections.map((c) => (
                  <Link
                    key={c.key}
                    href={`/${slug}/shop`}
                    className="sproutly-card"
                  >
                    <div className="sproutly-card-image aspect-[3/4] relative">
                      <Image
                        src={c.image}
                        alt={c.title}
                        fill
                        sizes="(min-width: 640px) 600px, 50vw"
                        quality={80}
                        loading="lazy"
                        className="object-cover"
                      />
                    </div>
                    <h3
                      className="sproutly-card-title mt-6 text-lg sm:text-xl"
                      style={{
                        color: theme.text,
                        fontFamily: "var(--store-font)",
                        fontWeight: 400,
                      }}
                    >
                      {c.title}
                    </h3>
                    {c.subtitle && (
                      <p
                        className="sproutly-card-meta mt-1 text-sm"
                        style={{ color: theme.textMuted }}
                      >
                        {c.subtitle}
                      </p>
                    )}
                    <span
                      className="sproutly-card-action inline-block text-xs tracking-widest uppercase"
                      style={{ color: theme.accent }}
                    >
                      看這個 →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
          );
        })()}

        {/* === 本月選物 === */}
        {featuredProducts && featuredProducts.length > 0 && (() => {
          const featuredPos = theme.layout.freePositions["__disabled__"] ?? null;
          const featuredFree = false; void featuredPos;
          const featuredStyle = sectionStyleFor("featured");
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${featuredFree ? "min-h-[60vh]" : ""}`}
            style={mergeSectionStyle(featuredStyle, theme.surface)}
            data-edit-target="featured"
            data-edit-label="本月選物"
            data-anim={featuredStyle.entranceVal}
          >
            <div className="max-w-5xl mx-auto px-8 sm:px-12" style={{ textAlign: featuredStyle.align }}>
              {featuredFree ? (
                <h2
                  data-edit-drag="featured-title"
                  className="absolute text-xl sm:text-2xl"
                  style={{
                    left: `${featuredPos!.x * 100}%`,
                    top: `${featuredPos!.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    color: theme.text,
                    fontFamily: "var(--store-font)",
                    fontWeight: 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {featuredTitle}
                </h2>
              ) : (
                <>
                  {featuredEyebrow && (
                    <p
                      data-edit-text
                      data-edit-field="featuredEyebrow"
                      className="text-[0.6875rem] uppercase mb-4"
                      style={{
                        color: theme.accent,
                        fontFamily: "var(--store-font)",
                        fontWeight: 500,
                        letterSpacing: "0.4em",
                      }}
                    >
                      {featuredEyebrow}
                    </p>
                  )}
                  <h2
                    data-edit-drag="featured-title"
                    data-edit-text
                    data-edit-field="featuredTitle"
                    className="text-xl sm:text-2xl mb-20 sm:mb-28"
                    style={{
                      color: theme.text,
                      fontFamily: "var(--store-font)",
                      fontWeight: 400,
                    }}
                  >
                    {featuredTitle}
                  </h2>
                </>
              )}
              <div className={`sproutly-stagger grid grid-cols-2 gap-x-6 sm:gap-x-10 gap-y-16 ${
                theme.layout.featuredColumns === 2 ? "md:grid-cols-2"
                : theme.layout.featuredColumns === 4 ? "md:grid-cols-4"
                : "md:grid-cols-3"
              }`}>
                {featuredProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/${slug}/products/${p.id}`}
                    className="sproutly-card"
                  >
                    <div className="sproutly-card-image aspect-square relative">
                      {p.image_urls?.[0] ? (
                        <Image
                          src={p.image_urls[0]}
                          alt={p.name}
                          fill
                          sizes="(min-width: 768px) 350px, 50vw"
                          quality={80}
                          loading="lazy"
                          className="object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: theme.bg }}
                        >
                          <span
                            className="text-xs tracking-widest uppercase"
                            style={{
                              color: theme.textMuted,
                              opacity: 0.4,
                            }}
                          >
                            No Image
                          </span>
                        </div>
                      )}
                    </div>
                    <h3
                      className="sproutly-card-title mt-5 text-base line-clamp-1"
                      style={{
                        color: theme.text,
                        fontFamily: "var(--store-font)",
                        fontWeight: 400,
                      }}
                    >
                      {p.name}
                    </h3>
                    <p
                      className="sproutly-card-meta mt-1 text-sm"
                      style={{ color: theme.textMuted }}
                    >
                      {formatPrice(p.price_cents, p.currency)}
                    </p>
                  </Link>
                ))}
              </div>
              <div className="mt-24 text-center">
                <Link
                  href={`/${slug}/shop`}
                  className="sproutly-link text-sm tracking-wider"
                  data-default-line="true"
                  data-edit-text
                  data-edit-field="featuredCta"
                  style={{ color: theme.text }}
                >
                  {featuredCta}
                </Link>
              </div>
            </div>
          </section>
          );
        })()}

        {/* === Journal（placeholder：尚無實際文章） === */}
        {(() => {
          const journalPos = theme.layout.freePositions["__disabled__"] ?? null;
          const journalFree = false; void journalPos;
          const journalStyle = sectionStyleFor("journal");
          const journalEyebrow =
            theme.homepage.journalEyebrow || HOMEPAGE_DEFAULTS.journalEyebrow;
          const journalTitle =
            theme.homepage.journalTitle || HOMEPAGE_DEFAULTS.journalTitle;
          const journalSubtitle =
            theme.homepage.journalSubtitle || HOMEPAGE_DEFAULTS.journalSubtitle;
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${journalFree ? "min-h-[60vh]" : ""}`}
            style={mergeSectionStyle(journalStyle)}
            data-edit-target="journal"
            data-edit-label="Journal 區段"
            data-anim={journalStyle.entranceVal}
          >
          <div className="max-w-5xl mx-auto px-8 sm:px-12" style={{ textAlign: journalStyle.align }}>
            {journalFree ? (
              <div
                data-edit-drag="journal-intro"
                className="absolute"
                style={{
                  left: `${journalPos!.x * 100}%`,
                  top: `${journalPos!.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  maxWidth: "min(560px, 80vw)",
                  width: "100%",
                }}
              >
                <p
                  className="text-[10px] tracking-[0.4em] uppercase mb-5"
                  style={{ color: theme.accent }}
                >
                  {journalEyebrow}
                </p>
                <h2
                  className="text-3xl sm:text-4xl lg:text-[2.5rem]"
                  style={{
                    color: theme.text,
                    fontFamily: "var(--store-font)",
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                  }}
                >
                  {journalTitle}
                </h2>
                <p
                  className="mt-6 text-sm sm:text-base leading-[1.9]"
                  style={{ color: theme.textMuted }}
                >
                  {journalSubtitle}
                </p>
              </div>
            ) : (
              <div className="mb-20 sm:mb-28" data-edit-drag="journal-intro">
                <p
                  className="text-[10px] tracking-[0.4em] uppercase mb-5"
                  style={{ color: theme.accent }}
                >
                  {journalEyebrow}
                </p>
                <h2
                  className="text-3xl sm:text-4xl lg:text-[2.5rem]"
                  style={{
                    color: theme.text,
                    fontFamily: "var(--store-font)",
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                  }}
                >
                  {journalTitle}
                </h2>
                <p
                  className="mt-6 text-sm sm:text-base max-w-xl leading-[1.9]"
                  style={{ color: theme.textMuted }}
                >
                  {journalSubtitle}
                </p>
              </div>
            )}

            <div className="sproutly-stagger grid grid-cols-1 sm:grid-cols-3 gap-x-8 sm:gap-x-10 gap-y-16">
              {[
                {
                  key: "care",
                  eyebrow: "Care",
                  title: "新手綠手指的第一步",
                  excerpt: "光線、澆水頻率、換盆時機 — 把基本功講清楚，少走幾年彎路。",
                },
                {
                  key: "space",
                  eyebrow: "Space",
                  title: "把植物放進小空間",
                  excerpt: "套房、租屋、窗台一隅，不同光線條件下的擺放提案。",
                },
                {
                  key: "story",
                  eyebrow: "Story",
                  title: "我們挑植物的方式",
                  excerpt: "從花市到溫室，這些植物是怎麼被選進這間店的。",
                },
              ].map((entry, i) => {
                const fallbackImage = visibleCollections[i]?.image;
                return (
                  <article key={entry.key} className="sproutly-card">
                    <div
                      className="sproutly-card-image aspect-[5/3] overflow-hidden relative"
                      style={{ background: theme.surface }}
                    >
                      {fallbackImage ? (
                        <Image
                          src={fallbackImage}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 400px, 100vw"
                          quality={75}
                          loading="lazy"
                          className="object-cover"
                          style={{ opacity: 0.55 }}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${theme.surface} 0%, ${theme.bg} 100%)`,
                          }}
                        />
                      )}
                    </div>
                    <p
                      className="mt-6 text-[10px] tracking-[0.4em] uppercase"
                      style={{ color: theme.accent }}
                    >
                      {entry.eyebrow}
                    </p>
                    <h3
                      className="sproutly-card-title mt-3 text-lg sm:text-xl leading-[1.4]"
                      style={{
                        color: theme.text,
                        fontFamily: "var(--store-font)",
                        fontWeight: 400,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {entry.title}
                    </h3>
                    <p
                      className="mt-3 text-sm leading-[1.85]"
                      style={{ color: theme.textMuted }}
                    >
                      {entry.excerpt}
                    </p>
                    <p
                      className="mt-5 text-[10px] tracking-[0.3em] uppercase"
                      style={{ color: theme.textMuted, opacity: 0.65 }}
                    >
                      Coming soon
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
          </section>
          );
        })()}

        {/* === Promise（雜誌風 quote card） === */}
        {promiseLines.length > 0 && (() => {
          // free positioning 暫時停用：lookup 一個不存在的 key 拿到 undefined → null
          const promisePos = theme.layout.freePositions["__disabled__"] ?? null;
          const promiseStyle = sectionStyleFor("promise");
          const promiseCardWrap =
            promiseStyle.align === "right"
              ? "ml-auto"
              : promiseStyle.align === "left"
              ? "mr-auto"
              : "mx-auto";
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${promisePos ? "min-h-screen" : ""}`}
            style={mergeSectionStyle(promiseStyle)}
            data-edit-target="promise"
            data-edit-label="Promise 區段"
            data-anim={promiseStyle.entranceVal}
          >
            <div
              className={
                promisePos
                  ? "absolute"
                  : `max-w-3xl ${promiseCardWrap} px-6 sm:px-12`
              }
              data-edit-drag="promise-card"
              style={
                promisePos
                  ? {
                      left: `${promisePos.x * 100}%`,
                      top: `${promisePos.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(680px, 90vw)",
                      width: "100%",
                      padding: "0 1.5rem",
                    }
                  : undefined
              }
            >
              <figure
                className="relative px-8 py-16 sm:px-16 sm:py-24 text-center rounded-sm"
                style={{
                  background: theme.surface,
                  boxShadow: "var(--sproutly-elev-3)",
                  border: `1px solid ${theme.border}`,
                }}
              >
                {/* 大引號 visual */}
                <span
                  aria-hidden="true"
                  className="absolute select-none pointer-events-none"
                  style={{
                    top: "1.5rem",
                    left: "2rem",
                    fontFamily: "var(--store-font)",
                    fontSize: "5rem",
                    lineHeight: 1,
                    color: theme.accent,
                    opacity: 0.18,
                    fontWeight: 400,
                  }}
                >
                  &ldquo;
                </span>
                <span
                  aria-hidden="true"
                  className="absolute select-none pointer-events-none"
                  style={{
                    bottom: "0.5rem",
                    right: "2rem",
                    fontFamily: "var(--store-font)",
                    fontSize: "5rem",
                    lineHeight: 1,
                    color: theme.accent,
                    opacity: 0.18,
                    fontWeight: 400,
                  }}
                >
                  &rdquo;
                </span>

                {/* 上方 eyebrow */}
                <p
                  className="text-[10px] tracking-[0.4em] uppercase mb-8 relative z-10"
                  style={{ color: theme.accent }}
                >
                  {promiseEyebrow}
                </p>

                <blockquote
                  data-edit-text
                  data-edit-field="promise"
                  className="text-lg sm:text-xl md:text-2xl leading-[2] relative z-10"
                  style={{
                    color: theme.text,
                    fontFamily: "var(--store-font)",
                    fontWeight: 400,
                    letterSpacing: "0.01em",
                    wordBreak: "keep-all",
                    overflowWrap: "break-word",
                  }}
                >
                  {promiseLines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </blockquote>

                {/* 底部裝飾線 */}
                <div
                  className="mx-auto mt-10 relative z-10"
                  style={{
                    width: "48px",
                    height: "1px",
                    background: theme.accent,
                    opacity: 0.4,
                  }}
                />
              </figure>
            </div>
          </section>
          );
        })()}

        {/* === Testimonials（optional block，商家從 editor 加） === */}
        {theme.layout.sectionOrder.includes("testimonials") &&
          theme.layout.testimonials.length > 0 &&
          (() => {
            const testimonialsPos = theme.layout.freePositions["__disabled__"] ?? null;
            const testimonialsFree = false;
            const testimonialsStyle = sectionStyleFor("testimonials");
            const testimonialsEyebrow =
              theme.homepage.testimonialsEyebrow ||
              HOMEPAGE_DEFAULTS.testimonialsEyebrow;
            const testimonialsTitle =
              theme.homepage.testimonialsTitle ||
              HOMEPAGE_DEFAULTS.testimonialsTitle;
            const testimonialsDivider =
              testimonialsStyle.align === "right"
                ? "ml-auto"
                : testimonialsStyle.align === "left"
                ? ""
                : "mx-auto";
            return (
            <section
              className={`relative py-40 sm:py-56 ${animClass} ${testimonialsFree ? "min-h-[60vh]" : ""}`}
              style={mergeSectionStyle(testimonialsStyle, theme.surface)}
              data-edit-target="testimonials"
              data-edit-label="顧客評語"
              data-anim={testimonialsStyle.entranceVal}
            >
              <div
                className="max-w-5xl mx-auto px-8 sm:px-12"
                style={{ textAlign: testimonialsStyle.align }}
              >
                {testimonialsFree ? (
                  <div
                    data-edit-drag="testimonials-title"
                    className="absolute"
                    style={{
                      left: `${testimonialsPos!.x * 100}%`,
                      top: `${testimonialsPos!.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(560px, 80vw)",
                      width: "100%",
                    }}
                  >
                    <p
                      className="text-[10px] tracking-[0.4em] uppercase mb-5"
                      style={{ color: theme.accent }}
                    >
                      {testimonialsEyebrow}
                    </p>
                    <h2
                      className="text-2xl sm:text-3xl md:text-4xl"
                      style={{
                        color: theme.text,
                        fontFamily: "var(--store-font)",
                        fontWeight: 400,
                        letterSpacing: "-0.01em",
                        lineHeight: 1.2,
                      }}
                    >
                      {testimonialsTitle}
                    </h2>
                    <div
                      className="mt-6"
                      style={{
                        width: "32px",
                        height: "1px",
                        background: theme.accent,
                        opacity: 0.5,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="mb-20 sm:mb-28"
                    data-edit-drag="testimonials-title"
                  >
                    <p
                      className="text-[10px] tracking-[0.4em] uppercase mb-5"
                      style={{ color: theme.accent }}
                    >
                      {testimonialsEyebrow}
                    </p>
                    <h2
                      className="text-2xl sm:text-3xl md:text-4xl"
                      style={{
                        color: theme.text,
                        fontFamily: "var(--store-font)",
                        fontWeight: 400,
                        letterSpacing: "-0.01em",
                        lineHeight: 1.2,
                      }}
                    >
                      {testimonialsTitle}
                    </h2>
                    <div
                      className={`${testimonialsDivider} mt-6`}
                      style={{
                        width: "32px",
                        height: "1px",
                        background: theme.accent,
                        opacity: 0.5,
                      }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                  {theme.layout.testimonials.slice(0, 6).map((t, i) => (
                    <figure
                      key={i}
                      className="relative p-8 rounded-sm"
                      style={{
                        background: theme.bg,
                        boxShadow: "var(--sproutly-elev-2)",
                        border: `1px solid ${theme.border}`,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute select-none pointer-events-none"
                        style={{
                          top: "0.5rem",
                          left: "1rem",
                          fontFamily: "var(--store-font)",
                          fontSize: "3rem",
                          lineHeight: 1,
                          color: theme.accent,
                          opacity: 0.2,
                        }}
                      >
                        &ldquo;
                      </span>
                      <blockquote
                        className="text-base leading-[1.95] relative z-10 mb-6"
                        style={{
                          color: theme.text,
                          fontFamily: "var(--store-font)",
                          fontWeight: 400,
                          letterSpacing: "0.005em",
                          wordBreak: "keep-all",
                        }}
                      >
                        {t.quote}
                      </blockquote>
                      <figcaption className="relative z-10">
                        <p
                          className="text-sm font-medium"
                          style={{ color: theme.text }}
                        >
                          {t.author}
                        </p>
                        {t.role && (
                          <p
                            className="text-xs mt-1"
                            style={{ color: theme.textMuted }}
                          >
                            {t.role}
                          </p>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </section>
            );
          })()}

        {/* === FAQ Accordion（optional block，<details> 原生 accordion） === */}
        {theme.layout.sectionOrder.includes("faq") &&
          theme.layout.faqItems.length > 0 && (() => {
            const faqStyle = sectionStyleFor("faq");
            const faqDivider =
              faqStyle.align === "right"
                ? "ml-auto"
                : faqStyle.align === "left"
                ? ""
                : "mx-auto";
            const faqEyebrow =
              theme.homepage.faqEyebrow ?? HOMEPAGE_DEFAULTS.faqEyebrow;
            const faqTitle =
              theme.homepage.faqTitle ?? HOMEPAGE_DEFAULTS.faqTitle;
            return (
            <section
              className={`py-40 sm:py-56 ${animClass}`}
              style={mergeSectionStyle(faqStyle)}
              data-edit-target="faq"
              data-edit-label="常見問題"
              data-anim={faqStyle.entranceVal}
            >
              <div
                className="max-w-2xl mx-auto px-6 sm:px-12"
                style={{ textAlign: faqStyle.align }}
              >
                <div className="mb-16">
                  <p
                    data-edit-text
                    data-edit-field="faqEyebrow"
                    className="text-[10px] tracking-[0.4em] uppercase mb-5"
                    style={{ color: theme.accent }}
                  >
                    {faqEyebrow}
                  </p>
                  <h2
                    data-edit-text
                    data-edit-field="faqTitle"
                    className="text-2xl sm:text-3xl md:text-4xl"
                    style={{
                      color: theme.text,
                      fontFamily: "var(--store-font)",
                      fontWeight: 400,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.2,
                    }}
                  >
                    {faqTitle}
                  </h2>
                  <div
                    className={`${faqDivider} mt-6`}
                    style={{
                      width: "32px",
                      height: "1px",
                      background: theme.accent,
                      opacity: 0.5,
                    }}
                  />
                </div>

                <ul className="divide-y" style={{ borderColor: theme.border }}>
                  {theme.layout.faqItems.map((item, i) => (
                    <li
                      key={i}
                      style={{ borderColor: theme.border }}
                      className="border-t last:border-b"
                    >
                      <details className="group">
                        <summary
                          className="flex items-center justify-between cursor-pointer py-6 list-none transition hover:opacity-80"
                          style={{ color: theme.text }}
                        >
                          <span
                            className="text-base sm:text-lg pr-4"
                            style={{
                              fontFamily: "var(--store-font)",
                              fontWeight: 400,
                              letterSpacing: "-0.005em",
                            }}
                          >
                            {item.question}
                          </span>
                          <span
                            className="text-2xl leading-none flex-shrink-0 transition-transform duration-500 group-open:rotate-45"
                            style={{ color: theme.accent }}
                            aria-hidden="true"
                          >
                            +
                          </span>
                        </summary>
                        <div
                          className="pb-7 pr-8 text-sm sm:text-base leading-[1.95]"
                          style={{ color: theme.textMuted }}
                        >
                          {item.answer.split(/\n+/).map((line, idx) => (
                            <p key={idx} className={idx > 0 ? "mt-3" : ""}>
                              {line}
                            </p>
                          ))}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            );
          })()}

        {/* === Stats（optional block：4 個大數字 + label） === */}
        {theme.layout.sectionOrder.includes("stats") &&
          theme.layout.stats.length > 0 && (() => {
            const statsStyle = sectionStyleFor("stats");
            return (
            <section
              className={`py-32 sm:py-44 ${animClass}`}
              style={mergeSectionStyle(statsStyle, theme.surface)}
              data-edit-target="stats"
              data-edit-label="數字 / 成就"
              data-anim={statsStyle.entranceVal}
            >
              <div
                className="max-w-5xl mx-auto px-8 sm:px-12"
                style={{ textAlign: statsStyle.align }}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8">
                  {theme.layout.stats.slice(0, 6).map((s, i) => (
                    <div key={i} className="space-y-3">
                      <p
                        className="text-4xl sm:text-5xl md:text-6xl tabular-nums"
                        style={{
                          color: theme.text,
                          fontFamily: "var(--store-font)",
                          fontWeight: 400,
                          letterSpacing: "-0.02em",
                          lineHeight: 1,
                        }}
                      >
                        {s.value}
                      </p>
                      <div
                        className="mx-auto"
                        style={{
                          width: "20px",
                          height: "1px",
                          background: theme.accent,
                          opacity: 0.6,
                        }}
                      />
                      <p
                        className="text-xs sm:text-sm tracking-[0.2em] uppercase"
                        style={{ color: theme.textMuted }}
                      >
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            );
          })()}

        {/* === Partners（optional block：合作夥伴 logos 灰階） === */}
        {theme.layout.sectionOrder.includes("partners") &&
          theme.layout.partners.length > 0 && (() => {
            const partnersStyle = sectionStyleFor("partners");
            const partnersJustify =
              partnersStyle.align === "left"
                ? "justify-start"
                : partnersStyle.align === "right"
                ? "justify-end"
                : "justify-center";
            return (
            <section
              className={`py-32 sm:py-44 ${animClass}`}
              style={mergeSectionStyle(partnersStyle)}
              data-edit-target="partners"
              data-edit-label="合作夥伴"
              data-anim={partnersStyle.entranceVal}
            >
              <div
                className="max-w-5xl mx-auto px-8 sm:px-12"
                style={{ textAlign: partnersStyle.align }}
              >
                <p
                  className="text-[10px] tracking-[0.4em] uppercase mb-12"
                  style={{ color: theme.textMuted }}
                >
                  As featured in
                </p>
                <div className={`flex flex-wrap items-center ${partnersJustify} gap-8 sm:gap-12 md:gap-16`}>
                  {theme.layout.partners.slice(0, 12).map((p, i) => {
                    const inner = (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.logoUrl}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className="h-8 sm:h-10 md:h-12 w-auto opacity-50 hover:opacity-100 transition duration-500"
                        style={{ filter: "grayscale(100%)" }}
                      />
                    );
                    return p.href ? (
                      <a
                        key={i}
                        href={p.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={i} className="inline-block">
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
            );
          })()}

        {/* === Gallery（optional block：3 欄圖片網格） === */}
        {theme.layout.sectionOrder.includes("gallery") &&
          theme.layout.gallery.length > 0 && (() => {
            const galleryStyle = sectionStyleFor("gallery");
            const galleryDivider =
              galleryStyle.align === "right"
                ? "ml-auto"
                : galleryStyle.align === "left"
                ? ""
                : "mx-auto";
            return (
            <section
              className={`py-40 sm:py-56 ${animClass}`}
              style={mergeSectionStyle(galleryStyle)}
              data-edit-target="gallery"
              data-edit-label="圖片相簿"
              data-anim={galleryStyle.entranceVal}
            >
              <div
                className="max-w-6xl mx-auto px-6 sm:px-10"
                style={{ textAlign: galleryStyle.align }}
              >
                <div className="mb-16 sm:mb-20">
                  <p
                    className="text-[10px] tracking-[0.4em] uppercase mb-5"
                    style={{ color: theme.accent }}
                  >
                    Gallery
                  </p>
                  <h2
                    className="text-2xl sm:text-3xl md:text-4xl"
                    style={{
                      color: theme.text,
                      fontFamily: "var(--store-font)",
                      fontWeight: 400,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.2,
                    }}
                  >
                    相片紀錄
                  </h2>
                  <div
                    className={`${galleryDivider} mt-6`}
                    style={{
                      width: "32px",
                      height: "1px",
                      background: theme.accent,
                      opacity: 0.5,
                    }}
                  />
                </div>

                <div className="sproutly-stagger grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
                  {theme.layout.gallery.slice(0, 12).map((g, i) => (
                    <figure
                      key={i}
                      className="sproutly-card"
                    >
                      <div className="sproutly-card-image aspect-square relative">
                        <Image
                          src={g.url}
                          alt={g.caption ?? ""}
                          fill
                          sizes="(min-width: 768px) 350px, 50vw"
                          quality={78}
                          loading="lazy"
                          className="object-cover"
                        />
                      </div>
                      {g.caption && (
                        <figcaption
                          className="mt-3 text-xs sm:text-sm leading-relaxed"
                          style={{ color: theme.textMuted }}
                        >
                          {g.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </div>
            </section>
            );
          })()}

        {/* === Visit === */}
        {(store.address || businessHoursText) && (() => {
          const visitPos = theme.layout.freePositions["__disabled__"] ?? null;
          const visitStyle = sectionStyleFor("visit");
          const visitDivider =
            visitStyle.align === "right"
              ? "ml-auto"
              : visitStyle.align === "left"
              ? ""
              : "mx-auto";
          const visitContactJustify =
            visitStyle.align === "left"
              ? "justify-start"
              : visitStyle.align === "right"
              ? "justify-end"
              : "justify-center";
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${visitPos ? "min-h-screen" : ""}`}
            style={mergeSectionStyle(visitStyle, theme.surface)}
            data-edit-target="visit"
            data-edit-label="來訪資訊"
            data-anim={visitStyle.entranceVal}
          >
            <div
              data-edit-drag="visit-card"
              className={
                visitPos
                  ? "absolute"
                  : "max-w-xl mx-auto px-8 sm:px-12"
              }
              style={
                visitPos
                  ? {
                      left: `${visitPos.x * 100}%`,
                      top: `${visitPos.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(560px, 90vw)",
                      width: "100%",
                      padding: "0 1.5rem",
                      textAlign: "center",
                    }
                  : { textAlign: visitStyle.align }
              }
            >
              <p
                data-edit-text
                data-edit-field="visitEyebrow"
                className="text-[10px] tracking-[0.4em] uppercase mb-5"
                style={{ color: theme.accent }}
              >
                {visitEyebrow}
              </p>
              <h2
                data-edit-text
                data-edit-field="visitTitle"
                className="text-2xl sm:text-3xl md:text-4xl mb-4"
                style={{
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                {visitTitle}
              </h2>
              <div
                className={`${visitDivider} mb-12`}
                style={{
                  width: "32px",
                  height: "1px",
                  background: theme.accent,
                  opacity: 0.5,
                }}
              />
              {store.address && (
                <p
                  className="text-base leading-loose"
                  style={{ color: theme.text }}
                >
                  {store.address}
                </p>
              )}
              {businessHoursText && (
                <div
                  className="mt-4 text-sm whitespace-pre-line leading-loose"
                  style={{ color: theme.textMuted }}
                >
                  {businessHoursText}
                </div>
              )}
              {(store.contact_phone || store.contact_email) && (
                <div
                  className={`mt-10 flex ${visitContactJustify} gap-8 text-sm tracking-wider`}
                  style={{ color: theme.text }}
                >
                  {store.contact_phone && (
                    <a
                      href={`tel:${store.contact_phone}`}
                      className="border-b border-current pb-0.5 hover:opacity-70 transition"
                    >
                      {store.contact_phone}
                    </a>
                  )}
                  {store.contact_email && (
                    <a
                      href={`mailto:${store.contact_email}`}
                      className="border-b border-current pb-0.5 hover:opacity-70 transition"
                    >
                      {store.contact_email}
                    </a>
                  )}
                </div>
              )}
              {theme.layout.mapEmbedUrl && (
                <div
                  className="mt-12 rounded-sm overflow-hidden border"
                  style={{
                    borderColor: theme.border,
                    boxShadow: "var(--sproutly-elev-2)",
                  }}
                >
                  <iframe
                    src={theme.layout.mapEmbedUrl}
                    title="店面地圖"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full aspect-[16/10] block"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          </section>
          );
        })()}
      </main>
    </>
  );
}
