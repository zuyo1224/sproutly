import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../_theme";

type Params = Promise<{ slug: string }>;

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

  const blocks: { kind: "phone" | "email" | "address" | "hours"; label: string; latin: string; value: string; href?: string }[] = [];
  if (theme.sections.contact) {
    if (store.contact_phone) {
      blocks.push({ kind: "phone", label: "電話", latin: "Phone", value: store.contact_phone, href: `tel:${store.contact_phone}` });
    }
    if (store.contact_email) {
      blocks.push({ kind: "email", label: "Email", latin: "Email", value: store.contact_email, href: `mailto:${store.contact_email}` });
    }
    if (store.address) {
      blocks.push({ kind: "address", label: "地址", latin: "Address", value: store.address });
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

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
      <header className="mb-16 sm:mb-20">
        <p
          className="text-[0.6875rem] uppercase font-medium"
          style={{ color: theme.accent, letterSpacing: "0.4em" }}
        >
          Contact
        </p>
        <h1
          className="mt-4 text-3xl sm:text-4xl font-medium"
          style={{
            color: theme.text,
            fontFamily: "var(--store-font)",
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          聯絡我們
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
    </main>
  );
}
