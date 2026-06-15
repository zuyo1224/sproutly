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
  const title = "關於我們";
  const description = "認識這家店的故事、理念與常見問題。";

  // 店家把「關於我們」連結貼到社群時，分享卡片要顯示「關於我們 · 店名」+ 店面主視覺，
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
    alternates: { canonical: `/${slug}/about` },
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

export default async function AboutPage({ params }: { params: Params }) {
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
  if (!theme.sections.about && !theme.sections.faq) notFound();

  const faqText =
    typeof store.faq === "object" && store.faq !== null
      ? ((store.faq as { text?: string }).text ?? "")
      : "";

  const faqItems: { question: string; answer: string }[] = [];
  if (faqText && theme.sections.faq) {
    const lines = faqText.split(/\r?\n/);
    let currentQ: string | null = null;
    let currentA: string[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith("Q:") || line.startsWith("Q：")) {
        if (currentQ) {
          faqItems.push({
            question: currentQ,
            answer: currentA.join("\n").trim(),
          });
        }
        currentQ = line.replace(/^Q[:：]\s*/, "");
        currentA = [];
      } else if (line.startsWith("A:") || line.startsWith("A：")) {
        currentA.push(line.replace(/^A[:：]\s*/, ""));
      } else if (currentQ) {
        currentA.push(line);
      }
    }
    if (currentQ) {
      faqItems.push({
        question: currentQ,
        answer: currentA.join("\n").trim(),
      });
    }
  }

  const hasDescription = Boolean(store.description);
  const aboutCaption = hasDescription
    ? "關於這間店 · 慢慢讀"
    : "店家還沒留下介紹";

  const aboutEyebrow =
    theme.homepage.aboutEyebrow ?? HOMEPAGE_DEFAULTS.aboutEyebrow;
  const aboutTitle =
    theme.homepage.aboutTitle ?? HOMEPAGE_DEFAULTS.aboutTitle;
  const faqEyebrow =
    theme.homepage.faqEyebrow ?? HOMEPAGE_DEFAULTS.faqEyebrow;
  const faqTitle =
    theme.homepage.faqTitle ?? HOMEPAGE_DEFAULTS.faqTitle;

  // FAQPage 結構化資料 — 這頁的 FAQ 來自 store.faq 文字欄（跟首頁那組 block 不同來源），
  // 之前完全沒有結構化標記，等於對 Google 隱形。補上後常見問題能在搜尋結果直接展開，
  // 條件跟畫面上實際渲染的 FAQ 一致（區段有開且真的解析出問答）才放，不會標到空的。
  const faqJsonLd =
    faqItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null;

  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <main className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      {theme.sections.about && (
        <>
          <header className="mb-16 sm:mb-20">
            <p
              className="text-[0.6875rem] uppercase font-medium"
              data-edit-text
              data-edit-field="aboutEyebrow"
              style={{ color: theme.accent, letterSpacing: "0.4em" }}
            >
              {aboutEyebrow}
            </p>
            <h1
              className="mt-4 text-3xl sm:text-4xl font-medium"
              data-edit-text
              data-edit-field="aboutTitle"
              style={{
                color: theme.text,
                fontFamily: "var(--store-font)",
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
              }}
            >
              {aboutTitle}
            </h1>
            <div
              className="mt-5 h-px w-12"
              style={{ background: theme.accent, opacity: 0.5 }}
            />
            <p
              className="mt-5 text-[0.9375rem]"
              style={{ color: theme.textMuted, lineHeight: 1.7 }}
            >
              {aboutCaption}
            </p>
          </header>

          {hasDescription ? (
            <div
              className="rounded-2xl p-7 sm:p-8"
              style={{
                background: "var(--store-surface)",
                border: "1px solid var(--store-border)",
                boxShadow: "var(--sproutly-elev-2)",
              }}
            >
              <p
                className="text-[0.9375rem] whitespace-pre-line"
                style={{
                  color: theme.text,
                  lineHeight: 1.85,
                }}
              >
                {store.description}
              </p>
            </div>
          ) : (
            <div className="py-12 max-w-md">
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
                店家還沒
                <br />
                寫下故事
              </p>
              <p
                className="mt-5 text-[0.9375rem]"
                style={{ color: theme.textMuted, lineHeight: 1.7 }}
              >
                過幾天再回來看看。
              </p>
            </div>
          )}
        </>
      )}

      {theme.sections.faq && faqItems.length > 0 && (
        <section className={theme.sections.about ? "mt-20 sm:mt-24" : ""}>
          <div className="mb-12 sm:mb-14">
            <p
              className="text-[0.6875rem] uppercase font-medium"
              data-edit-text
              data-edit-field="faqEyebrow"
              style={{ color: theme.accent, letterSpacing: "0.4em" }}
            >
              {faqEyebrow}
            </p>
            <h2
              className="mt-4 text-2xl sm:text-3xl font-medium"
              data-edit-text
              data-edit-field="faqTitle"
              style={{
                color: theme.text,
                fontFamily: "var(--store-font)",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              {faqTitle}
            </h2>
            <div
              className="mt-5 h-px w-10"
              style={{ background: theme.accent, opacity: 0.4 }}
            />
          </div>
          <div className="space-y-3">
            {faqItems.map((item, idx) => (
              <details
                key={idx}
                className="group rounded-2xl overflow-hidden"
                style={{
                  background: "var(--store-surface)",
                  border: "1px solid var(--store-border)",
                  boxShadow: "var(--sproutly-elev-2)",
                }}
              >
                <summary
                  className="px-6 sm:px-7 py-5 cursor-pointer flex items-center justify-between gap-6 hover:opacity-80 transition list-none text-[0.9375rem]"
                  style={{
                    color: theme.text,
                    letterSpacing: "-0.005em",
                  }}
                >
                  <span>{item.question}</span>
                  <span
                    className="group-open:rotate-45 transition text-2xl flex-shrink-0"
                    style={{ color: theme.accent }}
                  >
                    +
                  </span>
                </summary>
                <div
                  className="px-6 sm:px-7 pb-6 text-[0.9375rem] whitespace-pre-line"
                  style={{
                    color: theme.textMuted,
                    lineHeight: 1.85,
                  }}
                >
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* 讀完故事 / 常見問題的客人正是最想逛逛的時候，但這頁本來到底就斷了，
          只能捲回最上面的導覽找商品。補一條往商品頁的去路，沿用購物車 / 收藏 /
          會員中心那幾頁「繼續逛」的同一套低調連結視覺，讓每頁都有下一步。 */}
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
    </>
  );
}
