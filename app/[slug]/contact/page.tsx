import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme, HOMEPAGE_DEFAULTS } from "../_theme";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = "聯絡與營業時間";
  const description = "店家地址、營業時間與聯絡方式都在這裡。";

  // 店家把聯絡頁連結貼到社群接客時，分享卡片要顯示「聯絡與營業時間 · 店名」+ 店面主視覺，
  // 而不是退回 layout 那層只有店名的預設。沒撈到店面就只留純文字 meta。
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("name, theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  const base: Metadata = {
    title,
    description,
    alternates: { canonical: `/${slug}/contact` },
  };
  if (!store) return base;

  const theme = resolveTheme(store.theme);
  const ogTitle = `${title} · ${store.name}`;
  const ogImage = theme.heroUrl || theme.logoUrl || null;
  return {
    ...base,
    openGraph: {
      title: ogTitle,
      description,
      siteName: store.name,
      type: "website",
      images: ogImage ? [{ url: ogImage, alt: store.name }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: ogTitle,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function ContactPage({ params }: { params: Params }) {
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
  if (!theme.sections.contact && !theme.sections.hours) notFound();

  const businessHoursText =
    typeof store.business_hours === "object" && store.business_hours !== null
      ? ((store.business_hours as { text?: string }).text ?? "")
      : "";

  const blocks: { kind: "phone" | "email" | "address" | "hours"; label: string; latin: string; value: string; href?: string; external?: boolean }[] = [];
  if (theme.sections.contact) {
    if (store.contact_phone) {
      blocks.push({ kind: "phone", label: "電話", latin: "Phone", value: store.contact_phone, href: `tel:${store.contact_phone}` });
    }
    if (store.contact_email) {
      blocks.push({ kind: "email", label: "Email", latin: "Email", value: store.contact_email, href: `mailto:${store.contact_email}` });
    }
    if (store.address) {
      // 地址直接連去 Google Maps，手機上會開地圖 App 帶起導航，客人不用自己複製貼上。
      blocks.push({
        kind: "address",
        label: "地址",
        latin: "Address",
        value: store.address,
        href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`,
        external: true,
      });
    }
  }
  if (theme.sections.hours && businessHoursText) {
    blocks.push({ kind: "hours", label: "營業時間", latin: "Hours", value: businessHoursText });
  }

  const caption =
    blocks.length === 0
      ? "店家還沒填寫聯絡資訊"
      : blocks.length === 1
        ? "一個聯絡方式 · 隨時找到我們"
        : `${blocks.length} 個聯絡方式 · 隨時找到我們`;

  const contactEyebrow =
    theme.homepage.contactEyebrow ?? HOMEPAGE_DEFAULTS.contactEyebrow;
  const contactTitle =
    theme.homepage.contactTitle ?? HOMEPAGE_DEFAULTS.contactTitle;

  // 聯絡頁結構化資料 — 這頁專門講「怎麼找到店家」，把電話、Email、地址、營業時間
  // 餵給 Google，客人搜「店名 電話」「店名 地址」「店名 營業時間」時，搜尋結果有機會
  // 直接顯示這些資訊，少點一步進站。跟首頁那份用同一套欄位，只有真的有填才放。
  const BASE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://sproutly-drab.vercel.app";
  const contactJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    url: `${BASE_URL}/${slug}`,
  };
  if (store.logo_url) contactJsonLd.logo = store.logo_url;
  if (store.contact_phone) contactJsonLd.telephone = store.contact_phone;
  if (store.contact_email) contactJsonLd.email = store.contact_email;
  if (store.address) {
    contactJsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: store.address,
      addressCountry: "TW",
    };
  }
  if (businessHoursText) contactJsonLd.openingHours = businessHoursText;
  // 只有真的有任何一項聯絡資訊才放結構化資料，空店面不丟空殼給 Google。
  const hasContactData = Boolean(
    store.contact_phone ||
      store.contact_email ||
      store.address ||
      businessHoursText,
  );

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      {hasContactData && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
        />
      )}
      <header className="mb-16 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          data-edit-text
          data-edit-field="contactEyebrow"
          style={{ color: theme.accent, letterSpacing: "0.4em" }}
        >
          {contactEyebrow}
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          data-edit-text
          data-edit-field="contactTitle"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {contactTitle}
        </h1>
        <div
          className="mt-5 h-px w-12"
          style={{ background: theme.accent, opacity: 0.5 }}
        />
        <p
          className="mt-5 text-[0.9375rem]"
          style={{ color: theme.textMuted, lineHeight: 1.7 }}
        >
          {caption}
        </p>
      </header>

      {blocks.length === 0 ? (
        <div className="py-16 max-w-md">
          <p
            className="text-[0.6875rem] uppercase font-medium"
            style={{ color: theme.accent, letterSpacing: "0.4em" }}
          >
            Empty
          </p>
          <div
            className="mt-5 h-px w-10"
            style={{ background: theme.accent, opacity: 0.4 }}
          />
          <p
            className="mt-6 text-2xl sm:text-3xl font-medium"
            style={{
              color: theme.text,
              fontFamily: "var(--store-font)",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            還沒留下
            <br />
            聯絡方式
          </p>
          <p
            className="mt-5 text-[0.9375rem]"
            style={{ color: theme.textMuted, lineHeight: 1.7 }}
          >
            店家正在準備 · 過幾天再回來看看。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, idx) => {
            const content = (
              <>
                <p
                  className="text-[0.6875rem] uppercase font-medium"
                  style={{ color: theme.accent, letterSpacing: "0.4em" }}
                >
                  {block.latin} · {block.label}
                </p>
                <div
                  className="mt-3 text-lg whitespace-pre-line"
                  style={{
                    color: theme.text,
                    letterSpacing: "-0.005em",
                    lineHeight: 1.6,
                  }}
                >
                  {block.value}
                </div>
                {block.href && (
                  // 電話 / Email / 地址都是可點連結，但沒有提示客人就只當成顯示文字。
                  // 手機上點電話直接撥號、點 Email 開信件、點地址開地圖導航——各給一句明確的可點提示。
                  <p
                    className="mt-4 text-[0.6875rem] uppercase font-medium"
                    style={{ color: theme.accent, letterSpacing: "0.3em" }}
                  >
                    {block.kind === "address"
                      ? "開啟地圖導航 →"
                      : block.kind === "phone"
                        ? "點一下直接撥號 →"
                        : "點一下寫信給我們 →"}
                  </p>
                )}
              </>
            );
            const blockStyle = {
              background: "var(--store-surface)",
              border: "1px solid var(--store-border)",
              boxShadow: "var(--sproutly-elev-2)",
            } as const;
            if (block.href) {
              return (
                <a
                  key={idx}
                  href={block.href}
                  {...(block.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="block rounded-2xl p-7 sm:p-8 transition hover:opacity-90"
                  style={blockStyle}
                >
                  {content}
                </a>
              );
            }
            return (
              <div
                key={idx}
                className="rounded-2xl p-7 sm:p-8"
                style={blockStyle}
              >
                {content}
              </div>
            );
          })}
        </div>
      )}

      {/* 商家若在後台填了地圖嵌入網址，首頁的 Visit 區塊本來就會顯示地圖，
          但客人專程到聯絡頁找店反而看不到位置。這裡補上同一張地圖（吃同一個
          theme.layout.mapEmbedUrl，不需額外 API key），用聯絡區段的開關 gate
          —— 商家把聯絡區段關掉就不從這裡外洩店面位置。 */}
      {theme.sections.contact && theme.layout.mapEmbedUrl && (
        <div
          className="mt-10 rounded-2xl overflow-hidden"
          style={{
            border: "1px solid var(--store-border)",
            boxShadow: "var(--sproutly-elev-2)",
          }}
        >
          <iframe
            src={theme.layout.mapEmbedUrl}
            title={`${store.name} 店面地圖`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full aspect-[16/10] block"
            allowFullScreen
          />
        </div>
      )}

      {/* 客人專程查到地址 / 電話 / 營業時間，正是接著想看看店裡賣什麼的時候，
          但這頁本來到底就斷了，只能捲回最上面的導覽找商品。沿用關於頁 / 購物車 /
          收藏那幾頁「繼續逛」的同一套低調連結視覺，補一條往商品頁的去路收尾。 */}
      <div className="mt-20 sm:mt-24 flex flex-col items-center gap-5 text-center">
        <span
          className="h-px w-10"
          style={{ background: theme.accent, opacity: 0.4 }}
        />
        <Link
          href={`/${slug}/shop`}
          className="sproutly-link uppercase"
          style={{
            color: theme.accent,
            fontSize: "0.75rem",
            letterSpacing: "0.3em",
          }}
        >
          看看店裡的商品 →
        </Link>
      </div>
    </main>
  );
}
