"use server";
import { formString, formStringOrNull } from "@/lib/form-fields";
import { storeTextLimitError, storeThemeTextLimitError } from "@/lib/store-limits";

import { requireUser } from "@/lib/require-user";
import { uploadImage } from "@/lib/storage";
import { normalizeHexColor } from "@/lib/hex-color";
import { readPageSectionToggles } from "@/lib/page-section-toggles";
import { readSocialLinks } from "@/lib/social-links";
import { redirect } from "next/navigation";
import { buildUrl, withErrorParam } from "@/lib/url";
import {
  DEFAULT_SECTION_ORDER,
  isFontKey,
  isHeroImageSide,
  isHeroStyle,
  isPresetKey,
  sanitizeSectionOrder,
  withRequiredSections,
} from "@/lib/theme-keys";
import { HOMEPAGE_DEFAULT_COLLECTIONS } from "@/app/[slug]/_theme";

export async function updateStore(slug: string, formData: FormData) {
  const baseRedirect = `/dashboard/stores/${slug}/settings`;

  const { supabase, user } = await requireUser();

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
    redirect(withErrorParam(baseRedirect, "店名不能空"));
  }
  // 五個文字欄位的字數上限（表單 maxLength 吃同一份數字，這裡是伺服器端真正擋下）
  const tooLong = storeTextLimitError({
    name,
    description,
    contact_phone,
    contact_email,
    address,
  });
  if (tooLong) {
    redirect(withErrorParam(baseRedirect, tooLong));
  }

  // 視覺風格相關
  const presetRaw = String(formData.get("theme_preset") ?? "aesop");
  const preset = isPresetKey(presetRaw) ? presetRaw : "aesop";

  const fontRaw = String(formData.get("theme_font") ?? "inter");
  const font = isFontKey(fontRaw) ? fontRaw : "inter";

  // 主色／點綴色：判不過就不放進 theme（下面整份 theme 是重組的，這格省略等於退回
  // 風格預設色，_theme.ts 讀回時補）。跟視覺編輯器那邊「判不過不動原值」語意不同，
  // 兩邊各自維持。normalizeHexColor 自己擋非字串，FormData 拿到什麼直接丟進去就好。
  const primary = normalizeHexColor(formData.get("theme_primary")) ?? undefined;
  const accent = normalizeHexColor(formData.get("theme_accent")) ?? undefined;
  const tagline = formStringOrNull(formData, "theme_tagline");

  // logo / hero：設定頁只收「上傳檔案」跟「移除」勾選，沒上傳就保留原值。
  // 貼網址那條路在視覺編輯器（editor/actions.ts 的 heroUrl / logoUrl，有 500 字上限），
  // 設定頁的表單從第一版起就沒有 URL 輸入框，這裡不再讀 theme_logo_url / theme_hero_url。
  const logoFile = formData.get("theme_logo_file") as File | null;
  const heroFile = formData.get("theme_hero_file") as File | null;

  const existingTheme = (store.theme as Record<string, unknown>) ?? {};
  let logoUrl = (existingTheme.logo_url as string | undefined) ?? null;
  let heroUrl = (existingTheme.hero_url as string | undefined) ?? null;

  if (logoFile && logoFile.size > 0) {
    try {
      logoUrl = await uploadImage(logoFile, "sproutly-products", `logos/${store.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Logo 上傳失敗";
      redirect(withErrorParam(baseRedirect, msg));
    }
  }

  if (heroFile && heroFile.size > 0) {
    try {
      heroUrl = await uploadImage(heroFile, "sproutly-products", `heroes/${store.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Hero 圖上傳失敗";
      redirect(withErrorParam(baseRedirect, msg));
    }
  }

  // 移除按鈕
  if (formData.get("theme_remove_logo") === "on") logoUrl = null;
  if (formData.get("theme_remove_hero") === "on") heroUrl = null;

  // 首頁文案。六張選物卡的 key 跟設定頁表單、公開頁預設內容同一份
  // （_theme.ts 的 HOMEPAGE_DEFAULT_COLLECTIONS），這裡不另抄一份 key 清單。
  const collectionItems = HOMEPAGE_DEFAULT_COLLECTIONS.map(({ key: k }) => ({
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
  const heroStyleRaw = String(formData.get("layout_hero_style") ?? "full-image");
  const heroStyle = isHeroStyle(heroStyleRaw) ? heroStyleRaw : "full-image";

  const heroImageSideRaw = String(formData.get("layout_hero_image_side") ?? "left");
  const heroImageSide = isHeroImageSide(heroImageSideRaw) ? heroImageSideRaw : "left";

  // 設定頁的排序 UI 只列基本 6 個 section（沒有編輯器那五個可加的區塊），所以這裡
  // 也只認這 6 個；編輯器存檔那邊認的是完整 11 個（lib/theme-keys 的 SECTION_KEYS）。
  const sectionOrder = withRequiredSections(
    sanitizeSectionOrder(
      String(formData.get("layout_section_order") ?? "")
        .split(",")
        .map((s) => s.trim()),
      DEFAULT_SECTION_ORDER,
    ),
  );

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

  // theme 文案欄位的字數上限（跟視覺編輯器 slice 的數字同一份，見 lib/store-limits）。
  // 放在圖片上傳之後是既有順序的代價：真要省那趟上傳可再往前搬，但這些欄位裡有幾個
  // （collectionItems、layout 副標）要等上面組好才拿得到。
  const social = readSocialLinks(formData);
  const themeTooLong = storeThemeTextLimitError({
    tagline,
    heroEyebrow: layout.heroEyebrow,
    heroSubtitle: layout.heroSubtitle,
    collectionsIntro: homepage.collectionsIntro,
    collectionItems,
    promise: homepage.promise,
    visitTitle: homepage.visitTitle,
    businessHours: businessHoursText,
    faq: faqText,
    social,
  });
  if (themeTooLong) {
    redirect(withErrorParam(baseRedirect, themeTooLong));
  }

  const theme = {
    preset,
    font,
    primary,
    accent,
    logo_url: logoUrl,
    hero_url: heroUrl,
    sections: readPageSectionToggles(formData),
    social,
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
    redirect(withErrorParam(baseRedirect, error.message));
  }

  redirect(buildUrl(baseRedirect, { saved: 1 }));
}
