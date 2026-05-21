import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../_theme";

type Params = Promise<{ slug: string }>;

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

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      {theme.sections.about && (
        <>
          <div className="mb-16 sm:mb-20">
            <p
              className="text-[10px] tracking-[0.4em] uppercase mb-5"
              style={{ color: theme.accent }}
            >
              About
            </p>
            <h1
              className="text-4xl md:text-5xl lg:text-[3rem]"
              style={{
                color: theme.text,
                fontFamily: "var(--store-font)",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                lineHeight: 1.15,
              }}
            >
              關於我們
            </h1>
          </div>

          {store.description ? (
            <div
              className="rounded-2xl p-8 shadow-sm"
              style={{ background: theme.surface }}
            >
              <p
                className="leading-relaxed whitespace-pre-line"
                style={{ color: theme.text }}
              >
                {store.description}
              </p>
            </div>
          ) : (
            <p style={{ color: theme.textMuted, opacity: 0.6 }}>
              店家還沒填寫介紹。
            </p>
          )}
        </>
      )}

      {theme.sections.faq && faqItems.length > 0 && (
        <section className={theme.sections.about ? "mt-16" : ""}>
          <h2
            className="text-2xl sm:text-3xl font-semibold mb-8"
            style={{ color: theme.text }}
          >
            常見問題
          </h2>
          <div className="space-y-3">
            {faqItems.map((item, idx) => (
              <details
                key={idx}
                className="group rounded-2xl shadow-sm overflow-hidden"
                style={{ background: theme.surface }}
              >
                <summary
                  className="px-6 py-5 cursor-pointer font-medium flex items-center justify-between hover:opacity-80 transition list-none"
                  style={{ color: theme.text }}
                >
                  <span>{item.question}</span>
                  <span
                    className="group-open:rotate-45 transition text-2xl"
                    style={{ color: theme.accent }}
                  >
                    +
                  </span>
                </summary>
                <div
                  className="px-6 pb-5 leading-relaxed whitespace-pre-line"
                  style={{ color: theme.textMuted }}
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
