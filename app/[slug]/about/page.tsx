import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme, HOMEPAGE_DEFAULTS } from "../_theme";

type Params = Promise<{ slug: string }>;

export const metadata: Metadata = {
  title: "關於我們",
  description: "認識這家店的故事、理念與常見問題。",
};

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

  return (
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
    </main>
  );
}
