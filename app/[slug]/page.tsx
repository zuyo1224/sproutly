import { notFound } from "next/navigation";
import Link from "next/link";
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

  return (
    <>
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
        @media (prefers-reduced-motion: reduce) {
          .sproutly-subtle-fade, .sproutly-hero-fade-1, .sproutly-hero-fade-2 {
            animation: none !important;
          }
        }
      `}</style>

      <main>
        {/* === Hero === */}
        {theme.heroUrl ? (
          <section className="relative h-screen overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={theme.heroUrl}
              alt={store.name}
              className="sproutly-hero-parallax absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/45" />
            <div className="relative h-full max-w-6xl mx-auto px-8 sm:px-12 flex flex-col justify-end pb-24 sm:pb-32">
              <h1
                className={`text-2xl sm:text-4xl lg:text-5xl text-white leading-[1.6] ${theme.homepage.enableAnimation ? "sproutly-hero-fade-1" : ""}`}
                style={{
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                  letterSpacing: "0.02em",
                  wordBreak: "keep-all",
                  overflowWrap: "break-word",
                }}
              >
                {taglineLines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </h1>
              <Link
                href={`/${slug}/shop`}
                className={`sproutly-link mt-12 self-start text-white text-sm tracking-wider ${theme.homepage.enableAnimation ? "sproutly-hero-fade-2" : ""}`}
                data-default-line="true"
                style={{ fontFamily: "var(--store-font)" }}
              >
                看商品
              </Link>
            </div>
          </section>
        ) : (
          <section className="max-w-2xl mx-auto px-6 py-48 text-center">
            <h1
              className={`text-2xl sm:text-4xl leading-[1.7] ${theme.homepage.enableAnimation ? "sproutly-hero-fade-1" : ""}`}
              style={{
                color: theme.text,
                fontFamily: "var(--store-font)",
                fontWeight: 400,
                wordBreak: "keep-all",
                overflowWrap: "break-word",
              }}
            >
              {taglineLines.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <Link
              href={`/${slug}/shop`}
              className={`sproutly-link mt-12 inline-block text-sm tracking-wider ${theme.homepage.enableAnimation ? "sproutly-hero-fade-2" : ""}`}
              data-default-line="true"
              style={{ color: theme.text }}
            >
              看商品
            </Link>
          </section>
        )}

        {/* === 選物提案 === */}
        {visibleCollections.length > 0 && (
          <section className={`py-40 sm:py-56 ${animClass}`}>
            <div className="max-w-5xl mx-auto px-8 sm:px-12">
              <h2
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
                    <div className="sproutly-card-image aspect-[3/4]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.image}
                        alt={c.title}
                        className="w-full h-full object-cover"
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
                    <div className="sproutly-card-image aspect-square">
                      {p.image_urls?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_urls[0]}
                          alt={p.name}
                          className="w-full h-full object-cover"
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

        {/* === Promise === */}
        {promiseLines.length > 0 && (
          <section className={`py-40 sm:py-56 ${animClass}`}>
            <div className="max-w-xl mx-auto px-8 sm:px-12 text-center">
              <p
                className="text-base sm:text-lg leading-[2.4]"
                style={{
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                  wordBreak: "keep-all",
                  overflowWrap: "break-word",
                }}
              >
                {promiseLines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </div>
          </section>
        )}

        {/* === Visit === */}
        {(store.address || businessHoursText) && (
          <section
            className={`py-40 sm:py-56 ${animClass}`}
            style={{ background: theme.surface }}
          >
            <div className="max-w-xl mx-auto px-8 sm:px-12 text-center">
              <h2
                className="text-xl sm:text-2xl mb-12"
                style={{
                  color: theme.text,
                  fontFamily: "var(--store-font)",
                  fontWeight: 400,
                }}
              >
                {visitTitle}
              </h2>
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
            </div>
          </section>
        )}
      </main>
    </>
  );
}
