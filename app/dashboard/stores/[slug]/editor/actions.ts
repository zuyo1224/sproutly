"use server";

import {
  MAX_COLLECTION_SUBTITLE_LEN,
  MAX_COLLECTION_TITLE_LEN,
  MAX_COLLECTIONS_INTRO_LEN,
  MAX_HERO_EYEBROW_LEN,
  MAX_HERO_SUBTITLE_LEN,
  MAX_PROMISE_LEN,
  MAX_THEME_TAGLINE_LEN,
  MAX_VISIT_TITLE_LEN,
} from "@/lib/store-limits";
import { requireUser } from "@/lib/require-user";
import { socialUrl } from "@/lib/contact-href";
import { cleanMapEmbedUrl } from "@/lib/map-embed-url";
import {
  clampHeroZoom,
  clampHeroFontScale,
  clampFontScale,
  clampFeaturedCount,
} from "@/lib/theme-scale";
import { sanitizeFreePos } from "@/lib/free-positions";
import { normalizeHexColor } from "@/lib/hex-color";
import { sanitizeClearable } from "@/lib/clearable-field";
import { isFiniteNumber } from "@/lib/is-finite-number";
import { isPlainObject } from "@/lib/is-plain-object";
import { displayableImageUrl } from "@/lib/image-url";
import { normalizeHeroImageBounds } from "@/lib/hero-image-bounds";
import {
  LAYOUT_CHOICE_KEYS,
  LAYOUT_COLUMN_KEYS,
  isLayoutChoice,
  isLayoutColumns,
} from "@/lib/theme-layout-choices";
import {
  sanitizeSectionStyles,
  type SectionStyle,
} from "@/lib/section-style-schema";
import {
  DEFAULT_SECTION_ORDER,
  isHeroImageSide,
  isHeroStyle,
  isSectionKey,
} from "@/lib/theme-keys";

type EditorPayload = {
  primary?: string;
  accent?: string;
  tagline?: string;
  heroUrl?: string | null;
  logoUrl?: string | null;
  layout?: {
    heroStyle?: string;
    heroEyebrow?: string;
    heroSubtitle?: string;
    heroImageSide?: string;
    sectionOrder?: string[];
    testimonials?: Array<{ quote: string; author: string; role?: string }>;
    faqItems?: Array<{ question: string; answer: string }>;
    stats?: Array<{ value: string; label: string }>;
    partners?: Array<{ name: string; logoUrl: string; href?: string | null }>;
    gallery?: Array<{ url: string; caption?: string | null }>;
    mapEmbedUrl?: string | null;
    freePositions?: Record<string, { x: number; y: number }>;
    heroZoom?: number;
    heroZoomMobile?: number;
    heroZoomTablet?: number;
    heroZoomDesktop?: number;
    heroTaglineFontScale?: number;
    heroTaglineFontScaleMobile?: number | null;
    heroTaglineColor?: string | null;
    heroTaglineAlign?: string;
    heroTaglineWeight?: string;
    heroTaglineTracking?: string;
    heroTaglineLeading?: string;
    heroEyebrowFontScale?: number;
    heroEyebrowTracking?: string;
    heroEyebrowColor?: string | null;
    heroEyebrowCase?: string;
    heroEyebrowWeight?: string;
    heroEyebrowLeading?: string;
    heroSubtitleFontScale?: number;
    heroSubtitleColor?: string | null;
    heroSubtitleAlign?: string;
    heroSubtitleWeight?: string;
    heroSubtitleTracking?: string;
    heroSubtitleLeading?: string;
    heroCtaFontScale?: number;
    heroCtaTracking?: string;
    heroCtaCase?: string;
    heroCtaWeight?: string;
    heroCtaColor?: string | null;
    heroBylineFontScale?: number;
    heroBylineColor?: string | null;
    heroBylineTracking?: string;
    heroBylineCase?: string;
    heroBylineWeight?: string;
    heroBylineLeading?: string;
    heroSplitRatio?: string;
    heroImageFocus?: string;
    heroImageFocusX?: string;
    heroSplitImageFit?: string;
    heroSplitImageAspect?: string;
    heroSplitTextAlign?: string;
    heroSplitTextAlignX?: string;
    heroSplitTextPadding?: string;
    heroSplitMobilePadY?: string;
    heroSplitGap?: string;
    heroSplitMobileOrder?: string;
    heroSplitHeight?: string;
    heroSplitTextBg?: string | null;
    heroSplitImageBg?: string | null;
    heroSplitDivider?: string;
    heroSplitDividerTone?: string;
    heroMagazineRuleWeight?: string;
    heroMagazineRuleTone?: string;
    heroMagazineGap?: string;
    heroMagazineGapMobile?: string;
    heroMagazineTextWidth?: string;
    heroMagazineRuleWidth?: string;
    heroMagazinePadX?: string;
    heroMagazinePadY?: string;
    heroMagazineSubtitleWidth?: string;
    heroMagazineTextGap?: string;
    heroMinimalWidth?: string;
    heroMinimalPadding?: string;
    heroMinimalPaddingMobile?: string;
    heroMinimalPadX?: string;
    heroMinimalPadXMobile?: string;
    heroMinimalRule?: string;
    heroMinimalRuleColor?: string | null;
    heroMinimalRuleWeight?: string;
    heroMinimalAlign?: string;
    heroMinimalBg?: string | null;
    heroMinimalGap?: string;
    heroMagazineBg?: string | null;
    heroTextBg?: string | null;
    heroTextPadding?: string;
    heroTextWidth?: string;
    heroTextAlignX?: string;
    heroTextGap?: string;
    heroImageMaxHeight?: string;
    heroFullImageFit?: string;
    heroFullImageBg?: string | null;
    heroImageBounds?: unknown;
    heroHeight?: string;
    heroHeightMobile?: string;
    heroFullTextAlignY?: string;
    fontScale?: number;
    sectionPaddingScale?: string;
    buttonRadius?: string;
    footerBg?: string | null;
    footerText?: string | null;
    featuredCount?: number;
    featuredColumns?: number;
    collectionsColumns?: number;
    testimonialsColumns?: number;
    statsColumns?: number;
    galleryColumns?: number;
    journalColumns?: number;
    faqDefaultOpen?: string;
    // 直接用共用型別，不再手抄一份欄位表（值合不合法交給 sanitizeSectionStyles 擋）
    sectionStyles?: Record<string, SectionStyle>;
  };
  homepage?: {
    promise?: string;
    promiseEyebrow?: string;
    featuredTitle?: string;
    featuredEyebrow?: string;
    featuredCta?: string;
    collectionsIntro?: string;
    collectionsEyebrow?: string;
    visitTitle?: string;
    visitEyebrow?: string;
    journalEyebrow?: string;
    journalTitle?: string;
    journalSubtitle?: string;
    testimonialsEyebrow?: string;
    testimonialsTitle?: string;
    faqEyebrow?: string;
    faqTitle?: string;
    galleryEyebrow?: string;
    galleryTitle?: string;
    partnersEyebrow?: string;
    statsEyebrow?: string;
    statsTitle?: string;
    heroCta?: string;
    heroSecondaryCta?: string;
    heroMagazineByline?: string;
    collectionsCardCta?: string;
    aboutEyebrow?: string;
    aboutTitle?: string;
    contactEyebrow?: string;
    contactTitle?: string;
    shopEyebrow?: string;
    shopTitle?: string;
    footerWordsLabel?: string;
    footerFollowLabel?: string;
    footerTrackLabel?: string;
    footerVisitLabel?: string;
    journalCardLabel?: string;
    journalCards?: Array<{ eyebrow?: string; title?: string; excerpt?: string }>;
    collectionItems?: Array<{ key?: string; title?: string; subtitle?: string }>;
  };
  sections?: {
    about?: boolean;
    contact?: boolean;
    hours?: boolean;
    faq?: boolean;
    social?: boolean;
  };
};


export async function saveEditorState(slug: string, payload: EditorPayload) {
  if (!slug) return { error: "missing slug" };

  const { supabase, user } = await requireUser();

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, theme")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) return { error: "找不到店面" };

  const existing = (store.theme as Record<string, unknown>) ?? {};

  // 合併 — 只覆蓋 payload 提到的欄位
  const merged = { ...existing };

  // 主色／強調色：店面一定要有這兩個色，所以沒有「清除」態（跟下面 14 格 Hero 文字色
  // 不同），有帶才判、判不過就不動原值。兩格規則相同，一個迴圈跑完。
  for (const key of ["primary", "accent"] as const) {
    if (payload[key] === undefined) continue;
    const hex = normalizeHexColor(payload[key]);
    if (hex) merged[key] = hex;
  }
  if (payload.tagline !== undefined) {
    merged.tagline = String(payload.tagline).slice(0, MAX_THEME_TAGLINE_LEN);
  }
  // hero／logo：空值就是「移除」，存 null；有值就先用 displayableImageUrl 判一次，
  // 只收 https:// 完整網址（去前後空白、500 字上限）。編輯器這兩格只能從圖庫挑
  // （Supabase Storage、Pexels 都是 https），正常操作不會送出別的東西；會送出 http://
  // 或半截網址的只有手打的請求。以前照單全收，https 店面上 http:// 被瀏覽器當混合
  // 內容擋掉、「/hero.jpg」去抓 sproutly 自己網域下不存在的檔，那張圖開天窗、後台又
  // 看不出哪裡壞。判不過就不動原值，跟上面 primary／accent 同一態度。
  // 兩格規則逐字相同，只差 payload 的欄位名（camelCase）跟 theme jsonb 裡的欄位名
  // （snake_case），一張表跑完；以前各抄一段，改判法要記得兩段一起改。三態（沒帶跳過／
  // 空值存 null／有值走 helper）跟下面地圖網址、14 格顏色共用 lib/clearable-field。
  for (const [key, column] of [
    ["heroUrl", "hero_url"],
    ["logoUrl", "logo_url"],
  ] as const) {
    const u = sanitizeClearable(payload[key], (s) => displayableImageUrl(s.slice(0, 500)));
    if (u !== undefined) merged[column] = u;
  }

  if (payload.layout) {
    const existingLayout = (existing.layout as Record<string, unknown>) ?? {};
    const layoutPatch: Record<string, unknown> = { ...existingLayout };

    if (isHeroStyle(payload.layout.heroStyle)) {
      layoutPatch.heroStyle = payload.layout.heroStyle;
    }
    if (payload.layout.heroEyebrow !== undefined) {
      layoutPatch.heroEyebrow = String(payload.layout.heroEyebrow).slice(0, MAX_HERO_EYEBROW_LEN);
    }
    if (payload.layout.heroSubtitle !== undefined) {
      layoutPatch.heroSubtitle = String(payload.layout.heroSubtitle).slice(0, MAX_HERO_SUBTITLE_LEN);
    }
    if (payload.layout.heroImageSide) {
      layoutPatch.heroImageSide = isHeroImageSide(payload.layout.heroImageSide)
        ? payload.layout.heroImageSide
        : "left";
    }
    if (payload.layout.sectionOrder) {
      const order: string[] = [];
      for (const k of payload.layout.sectionOrder) {
        if (isSectionKey(k) && !order.includes(k)) order.push(k);
      }
      // 基本必要 6 個 section（DEFAULT_SECTION_ORDER）沒在 user order 就 append
      // testimonials 不 auto-append（商家自己加才會出現）
      for (const k of DEFAULT_SECTION_ORDER) {
        if (!order.includes(k)) order.push(k);
      }
      layoutPatch.sectionOrder = order;
    }
    if (payload.layout.testimonials !== undefined && Array.isArray(payload.layout.testimonials)) {
      layoutPatch.testimonials = payload.layout.testimonials
        .filter(isPlainObject)
        .map((t) => ({
          quote: String(t.quote ?? "").slice(0, 500).trim(),
          author: String(t.author ?? "").slice(0, 100).trim(),
          role: t.role ? String(t.role).slice(0, 100).trim() : null,
        }))
        .filter((t) => t.quote && t.author)
        .slice(0, 6); // 上限 6 個 testimonial
    }
    if (payload.layout.faqItems !== undefined && Array.isArray(payload.layout.faqItems)) {
      layoutPatch.faqItems = payload.layout.faqItems
        .filter(isPlainObject)
        .map((f) => ({
          question: String(f.question ?? "").slice(0, 300).trim(),
          answer: String(f.answer ?? "").slice(0, 2000).trim(),
        }))
        .filter((f) => f.question && f.answer)
        .slice(0, 20);
    }
    if (payload.layout.stats !== undefined && Array.isArray(payload.layout.stats)) {
      layoutPatch.stats = payload.layout.stats
        .filter(isPlainObject)
        .map((s) => ({
          value: String(s.value ?? "").slice(0, 30).trim(),
          label: String(s.label ?? "").slice(0, 60).trim(),
        }))
        .filter((s) => s.value && s.label)
        .slice(0, 6);
    }
    if (payload.layout.partners !== undefined && Array.isArray(payload.layout.partners)) {
      layoutPatch.partners = payload.layout.partners
        .filter(isPlainObject)
        .map((p) => ({
          name: String(p.name ?? "").slice(0, 100).trim(),
          logoUrl: String(p.logoUrl ?? "").slice(0, 500).trim(),
          // 只存得下 http(s):// 或漏 scheme 的真網域（跟頁尾社群連結同一支 socialUrl），
          // 其他字串（javascript:、純帳號、亂填）一律存 null；公開頁那顆 logo 就變成
          // 點不下去的靜態卡，不會掛一個壞掉或危險的連結。
          href: p.href ? socialUrl(String(p.href).slice(0, 500)) : null,
        }))
        .filter((p) => p.name && p.logoUrl)
        .slice(0, 12);
    }
    // 只接受 google.com/maps/embed 開頭的嵌入網址，防商家貼任意 iframe src。
    // 判斷跟讀取端 resolveTheme、編輯器輸入框的即時提示共用 lib/map-embed-url 那一支，
    // 整段 <iframe> HTML 貼過來也會挖出裡面的 src 照收。清空存 null；有字但判不過
    // 就不動 DB（店面繼續用上一次存好的那張地圖），編輯器那格會即時提示商家貼錯了。
    const mapEmbed = sanitizeClearable(payload.layout.mapEmbedUrl, cleanMapEmbedUrl);
    if (mapEmbed !== undefined) layoutPatch.mapEmbedUrl = mapEmbed;
    // 「沒帶就跳過、不是有限數字就整格不動 DB、是就夾進範圍存」的 11 格數值欄位，一張表
    // 配各自那支 clamp 跑完：舊的單一 heroZoom 跟三個裝置各自的 zoom、Hero 五段文字（主標／
    // 眉標／副標／按鈕／署名）的字級倍率、全站字級倍率、精選張數。主標的手機版字級另外要吃
    // null（見下面那段），不放進來。公開頁讀回那端是「不是有限數就回預設」（lib/clamp 的
    // clampOr），語意不同，這張表是存檔端自己的。
    for (const [key, clampFn] of [
      ["heroZoom", clampHeroZoom],
      ["heroZoomMobile", clampHeroZoom],
      ["heroZoomTablet", clampHeroZoom],
      ["heroZoomDesktop", clampHeroZoom],
      ["heroTaglineFontScale", clampHeroFontScale],
      ["heroEyebrowFontScale", clampHeroFontScale],
      ["heroSubtitleFontScale", clampHeroFontScale],
      ["heroCtaFontScale", clampHeroFontScale],
      ["heroBylineFontScale", clampHeroFontScale],
      ["fontScale", clampFontScale],
      ["featuredCount", clampFeaturedCount],
    ] as const) {
      const v = payload.layout[key];
      if (isFiniteNumber(v)) layoutPatch[key] = clampFn(v);
    }
    if (payload.layout.heroTaglineFontScaleMobile !== undefined) {
      const v = payload.layout.heroTaglineFontScaleMobile;
      if (v === null) {
        // null = 商家按「改回跟桌機一樣」，要存進去把舊值蓋掉，不能當「沒帶」跳過
        layoutPatch.heroTaglineFontScaleMobile = null;
      } else if (isFiniteNumber(v)) {
        layoutPatch.heroTaglineFontScaleMobile = clampHeroFontScale(v);
      }
    }
    // 「只認清單內的值」的 64 格版面欄位（含 Hero 五段文字的對齊／粗細／字距／行距／大小寫）：
    // 值不在清單內就整格不動 DB。清單與預設值跟公開頁讀回端共用 lib/theme-layout-choices 那張表，
    // 多一格只在那邊加一行。
    for (const key of LAYOUT_CHOICE_KEYS) {
      const v = payload.layout[key];
      if (isLayoutChoice(key, v)) layoutPatch[key] = v;
    }
    if (payload.layout.heroImageBounds !== undefined) {
      // 編輯器自動偵測存進來的主體邊界。壞資料（數字不合理、沒 url）一律存 null，
      // 公開頁就退回客人那邊自己偵測，不會畫出奇怪的比例。
      layoutPatch.heroImageBounds = normalizeHeroImageBounds(
        payload.layout.heroImageBounds
      );
    }
    // Hero 各段文字色／底色與頁尾底色／文字色全走同一套：空字串或 null = 清除回預設，非法色碼整格不存
    for (const field of [
      "heroTaglineColor",
      "heroEyebrowColor",
      "heroSubtitleColor",
      "heroCtaColor",
      "heroBylineColor",
      "heroSplitTextBg",
      "heroSplitImageBg",
      "heroMinimalRuleColor",
      "heroMinimalBg",
      "heroMagazineBg",
      "heroTextBg",
      "heroFullImageBg",
      "footerBg",
      "footerText",
    ] as const) {
      const hex = sanitizeClearable(payload.layout[field], normalizeHexColor);
      if (hex !== undefined) layoutPatch[field] = hex;
    }
    // 排成幾欄六格（2/3/4，慢讀只到 3）也走 lib/theme-layout-choices 那張表，跟讀回端同一份。
    for (const key of LAYOUT_COLUMN_KEYS) {
      const v = payload.layout[key];
      if (isLayoutColumns(key, v)) layoutPatch[key] = v;
    }
    if (payload.layout.sectionStyles !== undefined) {
      // 欄位表與合法值都在 lib/section-style-schema，跟公開頁讀回那層走同一支——
      // 以前這裡跟 _theme.ts 各手抄一條長判斷鏈，漏在存這邊就是「存得下去、重整就沒了」。
      layoutPatch.sectionStyles = sanitizeSectionStyles(payload.layout.sectionStyles);
    }
    if (payload.layout.freePositions !== undefined) {
      const fp = payload.layout.freePositions;
      const sanitized: Record<string, { x: number; y: number }> = {};
      if (isPlainObject(fp)) {
        for (const [k, v] of Object.entries(fp)) {
          if (!k || typeof k !== "string" || k.length > 60) continue;
          const pos = sanitizeFreePos(v);
          if (!pos) continue;
          sanitized[k] = pos;
        }
      }
      layoutPatch.freePositions = sanitized;
    }
    if (payload.layout.gallery !== undefined && Array.isArray(payload.layout.gallery)) {
      layoutPatch.gallery = payload.layout.gallery
        .filter(isPlainObject)
        .map((g) => ({
          url: String(g.url ?? "").slice(0, 500).trim(),
          caption: g.caption ? String(g.caption).slice(0, 200).trim() : null,
        }))
        .filter((g) => g.url)
        .slice(0, 12);
    }
    merged.layout = layoutPatch;
  }

  if (payload.homepage) {
    const existingHomepage = (existing.homepage as Record<string, unknown>) ?? {};
    const hpPatch: Record<string, unknown> = { ...existingHomepage };
    if (payload.homepage.promise !== undefined) {
      hpPatch.promise = String(payload.homepage.promise).slice(0, MAX_PROMISE_LEN);
    }
    if (payload.homepage.promiseEyebrow !== undefined) {
      const v = String(payload.homepage.promiseEyebrow).trim().slice(0, 60);
      hpPatch.promiseEyebrow = v || null;
    }
    if (payload.homepage.featuredTitle !== undefined) {
      const v = String(payload.homepage.featuredTitle).trim().slice(0, 60);
      hpPatch.featuredTitle = v || null;
    }
    if (payload.homepage.featuredEyebrow !== undefined) {
      const v = String(payload.homepage.featuredEyebrow).trim().slice(0, 60);
      hpPatch.featuredEyebrow = v || null;
    }
    if (payload.homepage.featuredCta !== undefined) {
      const v = String(payload.homepage.featuredCta).trim().slice(0, 60);
      hpPatch.featuredCta = v || null;
    }
    if (payload.homepage.collectionsIntro !== undefined) {
      hpPatch.collectionsIntro = String(payload.homepage.collectionsIntro).slice(
        0,
        MAX_COLLECTIONS_INTRO_LEN
      );
    }
    if (payload.homepage.collectionsEyebrow !== undefined) {
      const v = String(payload.homepage.collectionsEyebrow).trim().slice(0, 60);
      hpPatch.collectionsEyebrow = v || null;
    }
    if (payload.homepage.visitTitle !== undefined) {
      hpPatch.visitTitle = String(payload.homepage.visitTitle).slice(0, MAX_VISIT_TITLE_LEN);
    }
    if (payload.homepage.visitEyebrow !== undefined) {
      const v = String(payload.homepage.visitEyebrow).trim().slice(0, 60);
      hpPatch.visitEyebrow = v || null;
    }
    if (payload.homepage.journalEyebrow !== undefined) {
      const v = String(payload.homepage.journalEyebrow).trim().slice(0, 60);
      hpPatch.journalEyebrow = v || null;
    }
    if (payload.homepage.journalTitle !== undefined) {
      const v = String(payload.homepage.journalTitle).trim().slice(0, 60);
      hpPatch.journalTitle = v || null;
    }
    if (payload.homepage.journalSubtitle !== undefined) {
      const v = String(payload.homepage.journalSubtitle).trim().slice(0, 160);
      hpPatch.journalSubtitle = v || null;
    }
    if (payload.homepage.testimonialsEyebrow !== undefined) {
      const v = String(payload.homepage.testimonialsEyebrow).trim().slice(0, 60);
      hpPatch.testimonialsEyebrow = v || null;
    }
    if (payload.homepage.testimonialsTitle !== undefined) {
      const v = String(payload.homepage.testimonialsTitle).trim().slice(0, 60);
      hpPatch.testimonialsTitle = v || null;
    }
    if (payload.homepage.faqEyebrow !== undefined) {
      const v = String(payload.homepage.faqEyebrow).trim().slice(0, 60);
      hpPatch.faqEyebrow = v || null;
    }
    if (payload.homepage.faqTitle !== undefined) {
      const v = String(payload.homepage.faqTitle).trim().slice(0, 60);
      hpPatch.faqTitle = v || null;
    }
    if (payload.homepage.galleryEyebrow !== undefined) {
      const v = String(payload.homepage.galleryEyebrow).trim().slice(0, 60);
      hpPatch.galleryEyebrow = v || null;
    }
    if (payload.homepage.galleryTitle !== undefined) {
      const v = String(payload.homepage.galleryTitle).trim().slice(0, 60);
      hpPatch.galleryTitle = v || null;
    }
    if (payload.homepage.partnersEyebrow !== undefined) {
      const v = String(payload.homepage.partnersEyebrow).trim().slice(0, 60);
      hpPatch.partnersEyebrow = v || null;
    }
    if (payload.homepage.statsEyebrow !== undefined) {
      const v = String(payload.homepage.statsEyebrow).trim().slice(0, 60);
      hpPatch.statsEyebrow = v || null;
    }
    if (payload.homepage.statsTitle !== undefined) {
      const v = String(payload.homepage.statsTitle).trim().slice(0, 60);
      hpPatch.statsTitle = v || null;
    }
    if (payload.homepage.heroCta !== undefined) {
      const v = String(payload.homepage.heroCta).trim().slice(0, 60);
      hpPatch.heroCta = v || null;
    }
    if (payload.homepage.heroSecondaryCta !== undefined) {
      const v = String(payload.homepage.heroSecondaryCta).trim().slice(0, 60);
      hpPatch.heroSecondaryCta = v || null;
    }
    if (payload.homepage.heroMagazineByline !== undefined) {
      const v = String(payload.homepage.heroMagazineByline).trim().slice(0, 60);
      hpPatch.heroMagazineByline = v || null;
    }
    if (payload.homepage.collectionsCardCta !== undefined) {
      const v = String(payload.homepage.collectionsCardCta).trim().slice(0, 60);
      hpPatch.collectionsCardCta = v || null;
    }
    if (payload.homepage.aboutEyebrow !== undefined) {
      const v = String(payload.homepage.aboutEyebrow).trim().slice(0, 60);
      hpPatch.aboutEyebrow = v || null;
    }
    if (payload.homepage.aboutTitle !== undefined) {
      const v = String(payload.homepage.aboutTitle).trim().slice(0, 60);
      hpPatch.aboutTitle = v || null;
    }
    if (payload.homepage.contactEyebrow !== undefined) {
      const v = String(payload.homepage.contactEyebrow).trim().slice(0, 60);
      hpPatch.contactEyebrow = v || null;
    }
    if (payload.homepage.contactTitle !== undefined) {
      const v = String(payload.homepage.contactTitle).trim().slice(0, 60);
      hpPatch.contactTitle = v || null;
    }
    if (payload.homepage.shopEyebrow !== undefined) {
      const v = String(payload.homepage.shopEyebrow).trim().slice(0, 60);
      hpPatch.shopEyebrow = v || null;
    }
    if (payload.homepage.shopTitle !== undefined) {
      const v = String(payload.homepage.shopTitle).trim().slice(0, 60);
      hpPatch.shopTitle = v || null;
    }
    if (payload.homepage.footerWordsLabel !== undefined) {
      const v = String(payload.homepage.footerWordsLabel).trim().slice(0, 60);
      hpPatch.footerWordsLabel = v || null;
    }
    if (payload.homepage.footerFollowLabel !== undefined) {
      const v = String(payload.homepage.footerFollowLabel).trim().slice(0, 60);
      hpPatch.footerFollowLabel = v || null;
    }
    if (payload.homepage.footerTrackLabel !== undefined) {
      const v = String(payload.homepage.footerTrackLabel).trim().slice(0, 60);
      hpPatch.footerTrackLabel = v || null;
    }
    if (payload.homepage.footerVisitLabel !== undefined) {
      const v = String(payload.homepage.footerVisitLabel).trim().slice(0, 60);
      hpPatch.footerVisitLabel = v || null;
    }
    if (payload.homepage.journalCardLabel !== undefined) {
      const v = String(payload.homepage.journalCardLabel).trim().slice(0, 60);
      hpPatch.journalCardLabel = v || null;
    }
    if (payload.homepage.journalCards !== undefined) {
      const arr = Array.isArray(payload.homepage.journalCards)
        ? payload.homepage.journalCards
        : [];
      hpPatch.journalCards = arr
        .filter(isPlainObject)
        .map((c) => ({
          eyebrow: String(c.eyebrow ?? "").trim().slice(0, 40),
          title: String(c.title ?? "").trim().slice(0, 80),
          excerpt: String(c.excerpt ?? "").trim().slice(0, 200),
        }))
        .filter((c) => c.eyebrow || c.title || c.excerpt)
        .slice(0, 3);
    }
    if (payload.homepage.collectionItems !== undefined) {
      const arr = Array.isArray(payload.homepage.collectionItems)
        ? payload.homepage.collectionItems
        : [];
      // 空標題的卡照 settings 頁同款規則丟掉（空標題 = 不顯示這個提案）；
      // 上限 6 跟固定六個情境 key 對齊。
      // 同一個 key 只留第一筆：key 是店面首頁 map 這六張卡的 React key，settings 頁
      // 是照固定六個 key 組出來的不會重複，但這條 payload 是客戶端送什麼收什麼，
      // 重複的 key 存進 DB 會讓店面 React 警告、卡片互相蓋掉。讀取端 _theme.ts
      // resolveHomepage 也同款去重，這裡先擋住不讓髒資料進 DB。
      const seenCollectionKeys = new Set<string>();
      hpPatch.collectionItems = arr
        .filter(isPlainObject)
        .map((c) => ({
          key: String(c.key ?? "").trim().slice(0, 40),
          title: String(c.title ?? "").trim().slice(0, MAX_COLLECTION_TITLE_LEN),
          subtitle: String(c.subtitle ?? "").trim().slice(0, MAX_COLLECTION_SUBTITLE_LEN),
        }))
        .filter((c) => c.key && c.title)
        .filter((c) => {
          if (seenCollectionKeys.has(c.key)) return false;
          seenCollectionKeys.add(c.key);
          return true;
        })
        .slice(0, 6);
    }
    merged.homepage = hpPatch;
  }

  if (payload.sections) {
    const existingSections = (existing.sections as Record<string, unknown>) ?? {};
    merged.sections = {
      ...existingSections,
      ...Object.fromEntries(
        Object.entries(payload.sections).map(([k, v]) => [k, Boolean(v)])
      ),
    };
  }

  const { error } = await supabase
    .from("sproutly_merchants")
    .update({ theme: merged })
    .eq("id", store.id);

  if (error) return { error: error.message };
  return { ok: true };
}
