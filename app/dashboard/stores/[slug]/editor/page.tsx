import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/require-user";
import { resolveTheme, SECTION_LABELS } from "@/app/[slug]/_theme";
import { EditorWorkspace } from "./editor-workspace";

type Params = Promise<{ slug: string }>;

// 這頁不讀 ?error= / ?saved=：編輯器的存檔動作（同目錄 actions.ts）都是回傳結果給畫面，
// 沒有任何流程會帶這兩個參數跳到這頁。以前照網址原樣把 ?error= 攤在紅色提醒框裡，任何人
// 都能做一條帶「店面即將停權，請加 LINE 客服」之類字句的編輯器連結傳給商家，看起來就像平台
// 自己的提醒。
export default async function EditorPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { supabase, user } = await requireUser();

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
    // 全站底色（preset base）— 給編輯器算「文字色配在底色上看不看得清」的對比防呆
    bg: theme.bg,
    // 卡片底色與全站文字色（preset base，唯讀）— 頁尾配色那兩格沒設時，取色器要拿
    // 公開頁實際用的那個值當初始值，不然商家一點取色器就跳到一個跟畫面無關的顏色
    surface: theme.surface,
    text: theme.text,
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
      collectionsEyebrow: theme.homepage.collectionsEyebrow ?? "",
      visitTitle: theme.homepage.visitTitle ?? "",
      visitEyebrow: theme.homepage.visitEyebrow ?? "",
      journalEyebrow: theme.homepage.journalEyebrow ?? "",
      journalTitle: theme.homepage.journalTitle ?? "",
      journalSubtitle: theme.homepage.journalSubtitle ?? "",
      testimonialsEyebrow: theme.homepage.testimonialsEyebrow ?? "",
      testimonialsTitle: theme.homepage.testimonialsTitle ?? "",
      faqEyebrow: theme.homepage.faqEyebrow ?? "",
      faqTitle: theme.homepage.faqTitle ?? "",
      galleryEyebrow: theme.homepage.galleryEyebrow ?? "",
      galleryTitle: theme.homepage.galleryTitle ?? "",
      partnersEyebrow: theme.homepage.partnersEyebrow ?? "",
      statsEyebrow: theme.homepage.statsEyebrow ?? "",
      statsTitle: theme.homepage.statsTitle ?? "",
      heroCta: theme.homepage.heroCta ?? "",
      heroSecondaryCta: theme.homepage.heroSecondaryCta ?? "",
      heroMagazineByline: theme.homepage.heroMagazineByline ?? "",
      collectionsCardCta: theme.homepage.collectionsCardCta ?? "",
      aboutEyebrow: theme.homepage.aboutEyebrow ?? "",
      aboutTitle: theme.homepage.aboutTitle ?? "",
      contactEyebrow: theme.homepage.contactEyebrow ?? "",
      contactTitle: theme.homepage.contactTitle ?? "",
      shopEyebrow: theme.homepage.shopEyebrow ?? "",
      shopTitle: theme.homepage.shopTitle ?? "",
      footerWordsLabel: theme.homepage.footerWordsLabel ?? "",
      footerFollowLabel: theme.homepage.footerFollowLabel ?? "",
      footerTrackLabel: theme.homepage.footerTrackLabel ?? "",
      footerVisitLabel: theme.homepage.footerVisitLabel ?? "",
      journalCardLabel: theme.homepage.journalCardLabel ?? "",
      journalCards: theme.homepage.journalCards,
      collectionItems: theme.homepage.collectionItems,
    },
    sections: theme.sections,
  };

  return (
    <div className="-mx-8 -mb-16">
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
