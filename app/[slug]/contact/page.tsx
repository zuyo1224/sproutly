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

  const blocks: { kind: "phone" | "email" | "address" | "hours"; label: string; value: string; href?: string }[] = [];
  if (theme.sections.contact) {
    if (store.contact_phone) {
      blocks.push({ kind: "phone", label: "電話", value: store.contact_phone, href: `tel:${store.contact_phone}` });
    }
    if (store.contact_email) {
      blocks.push({ kind: "email", label: "Email", value: store.contact_email, href: `mailto:${store.contact_email}` });
    }
    if (store.address) {
      blocks.push({ kind: "address", label: "地址", value: store.address });
    }
  }
  if (theme.sections.hours && businessHoursText) {
    blocks.push({ kind: "hours", label: "營業時間", value: businessHoursText });
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-10">
        <p
          className="text-xs uppercase tracking-widest"
          style={{ color: theme.accent }}
        >
          Contact
        </p>
        <h1
          className="mt-2 text-4xl font-semibold tracking-tight"
          style={{ color: theme.text }}
        >
          聯絡我們
        </h1>
      </div>

      {blocks.length === 0 ? (
        <p style={{ color: theme.textMuted, opacity: 0.6 }}>
          店家還沒填寫聯絡資訊。
        </p>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, idx) => {
            const content = (
              <>
                <p
                  className="text-xs uppercase tracking-widest"
                  style={{ color: theme.textMuted }}
                >
                  {block.label}
                </p>
                <div
                  className="mt-2 text-lg whitespace-pre-line"
                  style={{ color: theme.text }}
                >
                  {block.value}
                </div>
              </>
            );
            if (block.href) {
              return (
                <a
                  key={idx}
                  href={block.href}
                  className="block rounded-2xl p-6 shadow-sm transition hover:shadow-md"
                  style={{ background: theme.surface }}
                >
                  {content}
                </a>
              );
            }
            return (
              <div
                key={idx}
                className="rounded-2xl p-6 shadow-sm"
                style={{ background: theme.surface }}
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
