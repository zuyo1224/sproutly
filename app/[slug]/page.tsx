import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme, HOMEPAGE_DEFAULTS, HOMEPAGE_DEFAULT_COLLECTIONS } from "./_theme";

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
    .limit(6);

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
  const visitTitle =
    theme.homepage.visitTitle || HOMEPAGE_DEFAULTS.visitTitle;
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

          // Variant 1: full-image（既有預設）— 整屏圖 + tagline overlay 文字
          if (heroStyle === "full-image" && theme.heroUrl) {
            const pos = theme.layout.freePositions["hero-tagline"] ?? null;
            const freePositioned = pos !== null;
            return (
              <section
                className="relative h-screen overflow-hidden"
                data-edit-target="hero"
                data-edit-label="Hero 區段"
              >
                <div
                  className="sproutly-hero-parallax absolute inset-0"
                  role="img"
                  aria-label={store.name}
                  style={{
                    backgroundImage: `url(${theme.heroUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/45" />
                {freePositioned ? (
                  // Phase 5 free-positioned tagline overlay
                  <div
                    className="absolute"
                    data-edit-drag="hero-tagline"
                    style={{
                      left: `${pos!.x * 100}%`,
                      top: `${pos!.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      maxWidth: "min(800px, 80vw)",
                    }}
                  >
                    <h1
                      className={`text-2xl sm:text-4xl lg:text-5xl text-white leading-[1.6] ${fade1}`}
                      style={{
                        fontFamily: "var(--store-font)",
                        fontWeight: 400,
                        letterSpacing: "0.02em",
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
                    <Link
                      href={`/${slug}/shop`}
                      className={`sproutly-link mt-8 inline-block text-white text-sm tracking-wider ${fade2}`}
                      data-default-line="true"
                      style={{ fontFamily: "var(--store-font)" }}
                    >
                      看商品
                    </Link>
                  </div>
                ) : (
                  <div
                    className="relative h-full max-w-6xl mx-auto px-8 sm:px-12 flex flex-col justify-end pb-24 sm:pb-32"
                    data-edit-drag="hero-tagline"
                  >
                    <h1
                      className={`text-2xl sm:text-4xl lg:text-5xl text-white leading-[1.6] ${fade1}`}
                      style={{
                        fontFamily: "var(--store-font)",
                        fontWeight: 400,
                        letterSpacing: "0.02em",
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
                    <Link
                      href={`/${slug}/shop`}
                      className={`sproutly-link mt-12 self-start text-white text-sm tracking-wider ${fade2}`}
                      data-default-line="true"
                      style={{ fontFamily: "var(--store-font)" }}
                    >
                      看商品
                    </Link>
                  </div>
                )}
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
        {visibleCollections.length > 0 && (
          <section
            className={`py-40 sm:py-56 ${animClass}`}
            data-edit-target="collections"
            data-edit-label="選物提案"
          >
            <div className="max-w-5xl mx-auto px-8 sm:px-12">
              <h2
                data-edit-text
                data-edit-field="collectionsIntro"
                className="text-xl sm:text-2xl text-center max-w-xl mx-auto mb-32 leading-[1.9]"
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

              <div className="sproutly-stagger grid grid-cols-2 gap-x-6 sm:gap-x-12 gap-y-20 sm:gap-y-24">
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
        )}

        {/* === 本月選物 === */}
        {featuredProducts && featuredProducts.length > 0 && (
          <section
            className={`py-40 sm:py-56 ${animClass}`}
            style={{ background: theme.surface }}
            data-edit-target="featured"
            data-edit-label="本月選物"
          >
            <div className="max-w-5xl mx-auto px-8 sm:px-12">
              <h2
                className="text-xl sm:text-2xl mb-20 sm:mb-28"
                style={{
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                }}
              >
                本月選物
              </h2>
              <div className="sproutly-stagger grid grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-16">
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
                  style={{ color: theme.text }}
                >
                  看所有的植物
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* === Journal（placeholder：尚無實際文章） === */}
        <section
          className={`py-40 sm:py-56 ${animClass}`}
          data-edit-target="journal"
          data-edit-label="Journal 區段"
        >
          <div className="max-w-5xl mx-auto px-8 sm:px-12">
            <div className="mb-20 sm:mb-28">
              <p
                className="text-[10px] tracking-[0.4em] uppercase mb-5"
                style={{ color: theme.accent }}
              >
                Journal
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
                慢讀
              </h2>
              <p
                className="mt-6 text-sm sm:text-base max-w-xl leading-[1.9]"
                style={{ color: theme.textMuted }}
              >
                關於植物、空間，與這間店的日常筆記。
              </p>
            </div>

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

        {/* === Promise（雜誌風 quote card） === */}
        {promiseLines.length > 0 && (() => {
          const promisePos = theme.layout.freePositions["promise-card"] ?? null;
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${promisePos ? "min-h-screen" : ""}`}
            data-edit-target="promise"
            data-edit-label="Promise 區段"
          >
            <div
              className={
                promisePos
                  ? "absolute"
                  : "max-w-3xl mx-auto px-6 sm:px-12"
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
                  Our Promise
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
          theme.layout.testimonials.length > 0 && (
            <section
              className={`py-40 sm:py-56 ${animClass}`}
              style={{ background: theme.surface }}
              data-edit-target="testimonials"
              data-edit-label="顧客評語"
            >
              <div className="max-w-5xl mx-auto px-8 sm:px-12">
                <div className="text-center mb-20 sm:mb-28">
                  <p
                    className="text-[10px] tracking-[0.4em] uppercase mb-5"
                    style={{ color: theme.accent }}
                  >
                    Testimonials
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
                    顧客的話
                  </h2>
                  <div
                    className="mx-auto mt-6"
                    style={{
                      width: "32px",
                      height: "1px",
                      background: theme.accent,
                      opacity: 0.5,
                    }}
                  />
                </div>

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
          )}

        {/* === FAQ Accordion（optional block，<details> 原生 accordion） === */}
        {theme.layout.sectionOrder.includes("faq") &&
          theme.layout.faqItems.length > 0 && (
            <section
              className={`py-40 sm:py-56 ${animClass}`}
              data-edit-target="faq"
              data-edit-label="常見問題"
            >
              <div className="max-w-2xl mx-auto px-6 sm:px-12">
                <div className="text-center mb-16">
                  <p
                    className="text-[10px] tracking-[0.4em] uppercase mb-5"
                    style={{ color: theme.accent }}
                  >
                    FAQ
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
                    常見問題
                  </h2>
                  <div
                    className="mx-auto mt-6"
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
          )}

        {/* === Stats（optional block：4 個大數字 + label） === */}
        {theme.layout.sectionOrder.includes("stats") &&
          theme.layout.stats.length > 0 && (
            <section
              className={`py-32 sm:py-44 ${animClass}`}
              style={{ background: theme.surface }}
              data-edit-target="stats"
              data-edit-label="數字 / 成就"
            >
              <div className="max-w-5xl mx-auto px-8 sm:px-12">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8 text-center">
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
          )}

        {/* === Partners（optional block：合作夥伴 logos 灰階） === */}
        {theme.layout.sectionOrder.includes("partners") &&
          theme.layout.partners.length > 0 && (
            <section
              className={`py-32 sm:py-44 ${animClass}`}
              data-edit-target="partners"
              data-edit-label="合作夥伴"
            >
              <div className="max-w-5xl mx-auto px-8 sm:px-12">
                <p
                  className="text-[10px] tracking-[0.4em] uppercase mb-12 text-center"
                  style={{ color: theme.textMuted }}
                >
                  As featured in
                </p>
                <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 md:gap-16">
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
          )}

        {/* === Gallery（optional block：3 欄圖片網格） === */}
        {theme.layout.sectionOrder.includes("gallery") &&
          theme.layout.gallery.length > 0 && (
            <section
              className={`py-40 sm:py-56 ${animClass}`}
              data-edit-target="gallery"
              data-edit-label="圖片相簿"
            >
              <div className="max-w-6xl mx-auto px-6 sm:px-10">
                <div className="text-center mb-16 sm:mb-20">
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
                    className="mx-auto mt-6"
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
          )}

        {/* === Visit === */}
        {(store.address || businessHoursText) && (() => {
          const visitPos = theme.layout.freePositions["visit-card"] ?? null;
          return (
          <section
            className={`relative py-40 sm:py-56 ${animClass} ${visitPos ? "min-h-screen" : ""}`}
            style={{ background: theme.surface }}
            data-edit-target="visit"
            data-edit-label="來訪資訊"
          >
            <div
              data-edit-drag="visit-card"
              className={
                visitPos
                  ? "absolute"
                  : "max-w-xl mx-auto px-8 sm:px-12 text-center"
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
                  : undefined
              }
            >
              <p
                className="text-[10px] tracking-[0.4em] uppercase mb-5"
                style={{ color: theme.accent }}
              >
                Visit
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
                className="mx-auto mb-12"
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
                  className="mt-10 flex justify-center gap-8 text-sm tracking-wider"
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
