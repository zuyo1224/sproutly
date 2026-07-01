"use server";
import { formString, formStringOrNull } from "@/lib/form-fields";

import { createClient } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/storage";
import { normalizeHexColor } from "@/lib/hex-color";
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
  return normalizeHexColor(input) ?? fallback;
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

  const name = formString(formData, "name");
  const description =
    formStringOrNull(formData, "description");
  const contact_phone =
    formStringOrNull(formData, "contact_phone");
  const contact_email =
    formStringOrNull(formData, "contact_email");
  const address = formStringOrNull(formData, "address");
  const businessHoursText =
    formString(formData, "business_hours");
  const faqText = formString(formData, "faq");
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
  const tagline = formStringOrNull(formData, "theme_tagline");

  // logo / hero：優先上傳，沒上傳就保留原值 / 用 URL 欄
  const logoFile = formData.get("theme_logo_file") as File | null;
  const heroFile = formData.get("theme_hero_file") as File | null;
  const logoUrlInput =
    formStringOrNull(formData, "theme_logo_url");
  const heroUrlInput =
    formStringOrNull(formData, "theme_hero_url");

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
    title: formString(formData, `hp_collection_${k}_title`),
    subtitle: formString(formData, `hp_collection_${k}_subtitle`),
  })).filter((c) => c.title); // 空標題 = 不顯示這個提案

  const existingCollections = (existingTheme.collections as Record<string, string>) ?? {};

  // 保留 editor 才有改的 layout 子欄位（settings 表單只管 hero variant / 副標 / eyebrow /
  // 圖片側 / 區段排序這 5 個，其餘 sectionStyles / freePositions / heroZoom 三裝置 /
  // heroTagline / featured 設定 / testimonials / faq / stats / partners / gallery 全是
  // 視覺編輯器寫的。沒先 spread 既有 layout 就送出，會把這些全部清成預設 — 商家在編輯器
  // 排好版後一進舊的店面設定頁按儲存，整站樣式歸零）。resolveLayout 讀取時會再 sanitize 一次。
  const existingLayout =
    (existingTheme.layout as Record<string, unknown>) ?? {};

  // 保留 editor 才有改的 homepage 子欄位。settings 表單只管 collectionsIntro /
  // collectionItems / promise / visitTitle / enableAnimation 這幾個，其餘各 eyebrow /
  // section 標題 / hero CTA / footer label / journalCards 全是視覺編輯器寫的。先 spread
  // 既有 homepage 再覆寫 settings 管的那幾欄，未來 editor 新增欄位也不會被這頁清掉（跟
  // 上面 layout 同款根因修法，取代以前一個個列 existing* 的脆弱 allowlist —— 漏列一個
  // 新欄位就會被清空）。resolveHomepage 讀取時會再 sanitize，spread raw 既有值安全。
  const existingHomepage =
    (existingTheme.homepage as Record<string, unknown>) ?? {};

  const homepage = {
    ...existingHomepage,
    collectionsIntro:
      formStringOrNull(formData, "hp_collections_intro"),
    collectionItems,
    promise: formStringOrNull(formData, "hp_promise"),
    visitTitle: formStringOrNull(formData, "hp_visit_title"),
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
    ...existingLayout,
    heroStyle,
    heroSubtitle:
      formStringOrNull(formData, "layout_hero_subtitle"),
    heroEyebrow:
      formStringOrNull(formData, "layout_hero_eyebrow"),
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
        formStringOrNull(formData, "social_instagram"),
      facebook:
        formStringOrNull(formData, "social_facebook"),
      line: formStringOrNull(formData, "social_line"),
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
