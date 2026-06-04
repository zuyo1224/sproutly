"use server";

import { createClient } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/storage";
import { redirect } from "next/navigation";

const PRESETS = new Set(["editorial", "plant-zen", "nordic", "aesop", "modern"]);
const FONTS = new Set([
  "cormorant",
  "playfair",
  "inter",
  "noto",
  "noto-serif",
  "lora",
]);

function safeHex(input: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(input) ? input : fallback;
}

export async function updateStore(slug: string, formData: FormData) {
  const baseRedirect = `/dashboard/stores/${slug}/settings`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, theme")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) redirect("/dashboard");

  const name = String(formData.get("name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const contact_phone =
    String(formData.get("contact_phone") ?? "").trim() || null;
  const contact_email =
    String(formData.get("contact_email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const businessHoursText =
    String(formData.get("business_hours") ?? "").trim();
  const faqText = String(formData.get("faq") ?? "").trim();
  const isPublished = formData.get("is_published") === "on";

  if (!name) {
    redirect(baseRedirect + "?error=" + encodeURIComponent("店名不能空"));
  }

  // 視覺風格相關
  const presetRaw = String(formData.get("theme_preset") ?? "aesop");
  const preset = PRESETS.has(presetRaw) ? presetRaw : "aesop";

  const fontRaw = String(formData.get("theme_font") ?? "inter");
  const font = FONTS.has(fontRaw) ? fontRaw : "inter";

  const primary = safeHex(
    String(formData.get("theme_primary") ?? ""),
    ""
  );
  const accent = safeHex(String(formData.get("theme_accent") ?? ""), "");
  const tagline = String(formData.get("theme_tagline") ?? "").trim() || null;

  // logo / hero：優先上傳，沒上傳就保留原值 / 用 URL 欄
  const logoFile = formData.get("theme_logo_file") as File | null;
  const heroFile = formData.get("theme_hero_file") as File | null;
  const logoUrlInput =
    String(formData.get("theme_logo_url") ?? "").trim() || null;
  const heroUrlInput =
    String(formData.get("theme_hero_url") ?? "").trim() || null;

  const existingTheme = (store.theme as Record<string, unknown>) ?? {};
  let logoUrl = (existingTheme.logo_url as string | undefined) ?? null;
  let heroUrl = (existingTheme.hero_url as string | undefined) ?? null;

  if (logoFile && logoFile.size > 0) {
    try {
      logoUrl = await uploadImage(logoFile, "sproutly-products", `logos/${store.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Logo 上傳失敗";
      redirect(baseRedirect + "?error=" + encodeURIComponent(msg));
    }
  } else if (logoUrlInput) {
    logoUrl = logoUrlInput;
  }

  if (heroFile && heroFile.size > 0) {
    try {
      heroUrl = await uploadImage(heroFile, "sproutly-products", `heroes/${store.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Hero 圖上傳失敗";
      redirect(baseRedirect + "?error=" + encodeURIComponent(msg));
    }
  } else if (heroUrlInput) {
    heroUrl = heroUrlInput;
  }

  // 移除按鈕
  if (formData.get("theme_remove_logo") === "on") logoUrl = null;
  if (formData.get("theme_remove_hero") === "on") heroUrl = null;

  // 首頁文案
  const HP_KEYS = ["window", "living", "desk", "bathroom", "nordic", "japanese"];
  const collectionItems = HP_KEYS.map((k) => ({
    key: k,
    title: String(formData.get(`hp_collection_${k}_title`) ?? "").trim(),
    subtitle: String(formData.get(`hp_collection_${k}_subtitle`) ?? "").trim(),
  })).filter((c) => c.title); // 空標題 = 不顯示這個提案

  const existingCollections = (existingTheme.collections as Record<string, string>) ?? {};

  // 保留 editor 才有改的欄位（避免 settings 頁送出時被清掉）
  const existingHomepage =
    (existingTheme.homepage as Record<string, unknown>) ?? {};
  const existingPromiseEyebrow =
    typeof existingHomepage.promiseEyebrow === "string"
      ? existingHomepage.promiseEyebrow
      : null;
  const existingFeaturedTitle =
    typeof existingHomepage.featuredTitle === "string"
      ? existingHomepage.featuredTitle
      : null;
  const existingFeaturedEyebrow =
    typeof existingHomepage.featuredEyebrow === "string"
      ? existingHomepage.featuredEyebrow
      : null;
  const existingFeaturedCta =
    typeof existingHomepage.featuredCta === "string"
      ? existingHomepage.featuredCta
      : null;
  const existingJournalEyebrow =
    typeof existingHomepage.journalEyebrow === "string"
      ? existingHomepage.journalEyebrow
      : null;
  const existingJournalTitle =
    typeof existingHomepage.journalTitle === "string"
      ? existingHomepage.journalTitle
      : null;
  const existingJournalSubtitle =
    typeof existingHomepage.journalSubtitle === "string"
      ? existingHomepage.journalSubtitle
      : null;
  const existingTestimonialsEyebrow =
    typeof existingHomepage.testimonialsEyebrow === "string"
      ? existingHomepage.testimonialsEyebrow
      : null;
  const existingTestimonialsTitle =
    typeof existingHomepage.testimonialsTitle === "string"
      ? existingHomepage.testimonialsTitle
      : null;
  const existingFaqEyebrow =
    typeof existingHomepage.faqEyebrow === "string"
      ? existingHomepage.faqEyebrow
      : null;
  const existingFaqTitle =
    typeof existingHomepage.faqTitle === "string"
      ? existingHomepage.faqTitle
      : null;
  const existingVisitEyebrow =
    typeof existingHomepage.visitEyebrow === "string"
      ? existingHomepage.visitEyebrow
      : null;
  const existingGalleryEyebrow =
    typeof existingHomepage.galleryEyebrow === "string"
      ? existingHomepage.galleryEyebrow
      : null;
  const existingGalleryTitle =
    typeof existingHomepage.galleryTitle === "string"
      ? existingHomepage.galleryTitle
      : null;
  const existingPartnersEyebrow =
    typeof existingHomepage.partnersEyebrow === "string"
      ? existingHomepage.partnersEyebrow
      : null;
  const existingStatsEyebrow =
    typeof existingHomepage.statsEyebrow === "string"
      ? existingHomepage.statsEyebrow
      : null;
  const existingStatsTitle =
    typeof existingHomepage.statsTitle === "string"
      ? existingHomepage.statsTitle
      : null;
  const existingHeroCta =
    typeof existingHomepage.heroCta === "string"
      ? existingHomepage.heroCta
      : null;

  const homepage = {
    collectionsIntro:
      String(formData.get("hp_collections_intro") ?? "").trim() || null,
    collectionItems,
    promise: String(formData.get("hp_promise") ?? "").trim() || null,
    promiseEyebrow: existingPromiseEyebrow,
    featuredTitle: existingFeaturedTitle,
    featuredEyebrow: existingFeaturedEyebrow,
    featuredCta: existingFeaturedCta,
    visitTitle: String(formData.get("hp_visit_title") ?? "").trim() || null,
    visitEyebrow: existingVisitEyebrow,
    journalEyebrow: existingJournalEyebrow,
    journalTitle: existingJournalTitle,
    journalSubtitle: existingJournalSubtitle,
    testimonialsEyebrow: existingTestimonialsEyebrow,
    testimonialsTitle: existingTestimonialsTitle,
    faqEyebrow: existingFaqEyebrow,
    faqTitle: existingFaqTitle,
    galleryEyebrow: existingGalleryEyebrow,
    galleryTitle: existingGalleryTitle,
    partnersEyebrow: existingPartnersEyebrow,
    statsEyebrow: existingStatsEyebrow,
    statsTitle: existingStatsTitle,
    heroCta: existingHeroCta,
    enableAnimation: formData.get("hp_enable_animation") === "on",
  };

  // 版面設計 layout：hero variant + section sortable
  const HERO_STYLES_SET = new Set(["full-image", "split", "minimal", "magazine"]);
  const heroStyleRaw = String(formData.get("layout_hero_style") ?? "full-image");
  const heroStyle = HERO_STYLES_SET.has(heroStyleRaw)
    ? heroStyleRaw
    : "full-image";

  const heroImageSideRaw = String(formData.get("layout_hero_image_side") ?? "left");
  const heroImageSide = heroImageSideRaw === "right" ? "right" : "left";

  const SECTION_KEYS = ["hero", "collections", "featured", "journal", "promise", "visit"];
  const sectionOrderRaw = String(formData.get("layout_section_order") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => SECTION_KEYS.includes(s));
  const sectionOrder: string[] = [];
  for (const k of sectionOrderRaw) {
    if (!sectionOrder.includes(k)) sectionOrder.push(k);
  }
  for (const k of SECTION_KEYS) {
    if (!sectionOrder.includes(k)) sectionOrder.push(k);
  }

  const layout = {
    heroStyle,
    heroSubtitle:
      String(formData.get("layout_hero_subtitle") ?? "").trim() || null,
    heroEyebrow:
      String(formData.get("layout_hero_eyebrow") ?? "").trim() || null,
    heroImageSide,
    sectionOrder,
  };

  const theme = {
    preset,
    font,
    primary: primary || undefined,
    accent: accent || undefined,
    logo_url: logoUrl,
    hero_url: heroUrl,
    sections: {
      about: formData.get("section_about") === "on",
      contact: formData.get("section_contact") === "on",
      hours: formData.get("section_hours") === "on",
      faq: formData.get("section_faq") === "on",
      social: formData.get("section_social") === "on",
    },
    social: {
      instagram:
        String(formData.get("social_instagram") ?? "").trim() || null,
      facebook:
        String(formData.get("social_facebook") ?? "").trim() || null,
      line: String(formData.get("social_line") ?? "").trim() || null,
    },
    tagline,
    collections: existingCollections,
    homepage,
    layout,
  };

  const businessHours = businessHoursText ? { text: businessHoursText } : null;
  const faq = faqText ? { text: faqText } : null;

  const { error } = await supabase
    .from("sproutly_merchants")
    .update({
      name,
      description,
      contact_phone,
      contact_email,
      address,
      business_hours: businessHours,
      faq,
      is_published: isPublished,
      theme,
    })
    .eq("id", store.id);

  if (error) {
    redirect(baseRedirect + "?error=" + encodeURIComponent(error.message));
  }

  redirect(baseRedirect + "?saved=1");
}
