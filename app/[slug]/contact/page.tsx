import type { Metadata } from "next";
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
  return {
    title: "聯絡與營業時間",
    description: "店家地址、營業時間與聯絡方式都在這裡。",
    alternates: { canonical: `/${slug}/contact` },
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

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
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
                {block.kind === "address" && (
                  <p
                    className="mt-4 text-[0.6875rem] uppercase font-medium"
                    style={{ color: theme.accent, letterSpacing: "0.3em" }}
                  >
                    開啟地圖導航 →
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
    </main>
  );
}
