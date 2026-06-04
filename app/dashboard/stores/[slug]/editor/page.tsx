import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme, SECTION_LABELS } from "@/app/[slug]/_theme";
import { EditorWorkspace } from "./editor-workspace";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ saved?: string; error?: string }>;

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { saved, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name, slug, theme, is_published")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  const theme = resolveTheme(store.theme);

  // 把 theme 傳給 client component 編輯
  const themeForEditor = {
    primary: theme.primary,
    accent: theme.accent,
    tagline: theme.tagline ?? "",
    heroUrl: theme.heroUrl,
    logoUrl: theme.logoUrl,
    layout: theme.layout,
    homepage: {
      promise: theme.homepage.promise ?? "",
      promiseEyebrow: theme.homepage.promiseEyebrow ?? "",
      featuredTitle: theme.homepage.featuredTitle ?? "",
      featuredEyebrow: theme.homepage.featuredEyebrow ?? "",
      featuredCta: theme.homepage.featuredCta ?? "",
      collectionsIntro: theme.homepage.collectionsIntro ?? "",
      visitTitle: theme.homepage.visitTitle ?? "",
      visitEyebrow: theme.homepage.visitEyebrow ?? "",
      journalEyebrow: theme.homepage.journalEyebrow ?? "",
      journalTitle: theme.homepage.journalTitle ?? "",
      journalSubtitle: theme.homepage.journalSubtitle ?? "",
      testimonialsEyebrow: theme.homepage.testimonialsEyebrow ?? "",
      testimonialsTitle: theme.homepage.testimonialsTitle ?? "",
      faqEyebrow: theme.homepage.faqEyebrow ?? "",
      faqTitle: theme.homepage.faqTitle ?? "",
    },
    sections: theme.sections,
  };

  return (
    <div className="-mx-8 -mb-16">
      {error && (
        <div className="mx-8 mb-4 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mx-8 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          已儲存
        </div>
      )}
      <EditorWorkspace
        slug={slug}
        storeName={store.name}
        isPublished={!!store.is_published}
        sectionLabels={SECTION_LABELS}
        initialTheme={themeForEditor}
      />
      <noscript>
        <div className="mx-8 my-8 rounded-2xl bg-amber-50 border border-amber-200 p-5 text-sm text-amber-900">
          編輯器需要 JavaScript。請改用{" "}
          <Link
            href={`/dashboard/stores/${slug}/settings`}
            className="underline font-medium"
          >
            傳統設定頁
          </Link>
        </div>
      </noscript>
    </div>
  );
}
