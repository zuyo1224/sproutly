import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { jsonLdHtml } from "@/lib/json-ld";
import { parseBusinessHoursToSpec } from "@/lib/business-hours-schema";
import { telHref, mailHref, telDigits, cleanEmail, socialUrl, mapsHref } from "@/lib/contact-href";
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
      locale: "zh_TW",
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
      // 清得出可撥號的主號才掛 tel: 連結；商家在電話欄填「問我」「再問」這種非號碼
      // （telDigits 回空、telHref 會退成陽春 "tel:"）時不掛死連結，仍把字顯示出來，
      // 但不再給「點一下直接撥號」的假提示。跟 mapsHref／socialUrl 同一條防呆線。
      const phoneDigits = telDigits(store.contact_phone);
      blocks.push({ kind: "phone", label: "電話", latin: "Phone", value: store.contact_phone, href: phoneDigits ? telHref(store.contact_phone) : undefined });
    }
    if (store.contact_email) {
      // 同上：清完不像 email（cleanEmail 回空、mailHref 退成陽春 "mailto:"）就不掛死連結。
      const emailClean = cleanEmail(store.contact_email);
      blocks.push({ kind: "email", label: "Email", latin: "Email", value: store.contact_email, href: emailClean ? mailHref(store.contact_email) : undefined });
    }
    // 地址直接連去 Google Maps，手機上會開地圖 App 帶起導航，客人不用自己複製貼上。
    // 走共用 mapsHref（trim 完空白回 null），跟頁尾、首頁來訪區段同一條路徑：
    // 商家只打空白時不冒出連到空白地圖搜尋的壞連結，顯示的地址也用 trim 後的值。
    const addressText = store.address?.trim();
    const addressMapsHref = mapsHref(store.address);
    if (addressText && addressMapsHref) {
      blocks.push({
        kind: "address",
        label: "地址",
        latin: "Address",
        value: addressText,
        href: addressMapsHref,
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
  // @id 跟首頁 page.tsx 那份 Store 用同一個值（${BASE_URL}/${slug}#store），
  // 讓 Google 知道聯絡頁這段跟首頁那段講的是同一間店、不是兩間同名的不同店，
  // 否則兩段匿名 Store 會被當成各自獨立的實體，搜尋結果可能對不起來。
  const storeId = `${BASE_URL}/${slug}#store`;
  const contactJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": storeId,
    name: store.name,
    url: `${BASE_URL}/${slug}`,
  };
  // 跟首頁那段 Store 共用同一個 @id，理論上 Google 會把兩段合併看成同一間店；
  // 但跨頁合併不是保證的事，而聯絡頁正是客人搜「店名 地址／電話／營業時間」會落地的頁，
  // 所以這段自己也補上店家簡介、主視覺、社群連結，自成完整、不賭合併。
  if (store.description) contactJsonLd.description = store.description;
  if (theme.heroUrl) contactJsonLd.image = theme.heroUrl;
  if (store.logo_url) contactJsonLd.logo = store.logo_url;
  const contactPhone = telDigits(store.contact_phone);
  if (contactPhone) contactJsonLd.telephone = contactPhone;
  const contactEmail = cleanEmail(store.contact_email);
  if (contactEmail) contactJsonLd.email = contactEmail;
  // 地址先去前後空白再放：商家若只打了空白（或地址前後黏了換行），原本
  // if (store.address) 對「  」之類的全空白字串也成立，會吐出一個 streetAddress
  // 是空白的 PostalAddress 給 Google，等於餵一筆空地址。trim 後仍有字才放。
  const contactAddress = store.address?.trim();
  if (contactAddress) {
    contactJsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: contactAddress,
      addressCountry: "TW",
    };
  }
  // 營業時間給 Google：schema.org 的 openingHours 只吃結構化星期＋24 小時時間，
  // 商家打的是中文自由文字，直接塞會被判無效、連整段 Store 結構化資料一起忽略
  // （首頁 page.tsx 早就改用解析版，這頁之前漏掉，等於把整段結構化資料賭掉）。
  // 解析得出來才放 openingHoursSpecification，判讀不出來就不放，不誤導搜尋結果
  //（頁面上給客人看的原始文字照常顯示）。
  const openingHoursSpec = parseBusinessHoursToSpec(businessHoursText);
  if (openingHoursSpec) contactJsonLd.openingHoursSpecification = openingHoursSpec;
  // 把店家填的 Instagram / Facebook / LINE 連回同一個店家實體，Google 用這條把
  // 社群帳號跟搜尋結果的店家對起來（跟首頁同一套）。商家可能填成 @帳號 之類的非網址，
  // sameAs 只吃絕對網址，所以只放真的以 http(s) 開頭的，其餘略過不放錯的。
  const socialUrls = [
    theme.social.instagram,
    theme.social.facebook,
    theme.social.line,
  ]
    .map(socialUrl)
    .filter((u): u is string => u !== null);
  if (socialUrls.length > 0) {
    contactJsonLd.sameAs = socialUrls;
  }
  // 只有真的有任何一項聯絡資訊才放結構化資料，空店面不丟空殼給 Google。
  const hasContactData = Boolean(
    store.contact_phone ||
      store.contact_email ||
      contactAddress ||
      businessHoursText,
  );

  // 麵包屑結構化資料 — 跟 shop / 商品詳情頁同一套，讓 Google 搜尋結果用
  // 「店名 › 聯絡與營業時間」標出這頁在店裡的位置，取代生硬的網址。
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: store.name,
        item: `${BASE_URL}/${slug}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "聯絡與營業時間",
        item: `${BASE_URL}/${slug}/contact`,
      },
    ],
  };

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />
      {hasContactData && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(contactJsonLd) }}
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
