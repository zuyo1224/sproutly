"use server";

import { requireUser } from "@/lib/require-user";
import {
  clampHeroZoom,
  clampHeroFontScale,
  clampFontScale,
  clampFeaturedCount,
  clampFreePos,
} from "@/lib/theme-scale";
import { normalizeHexColor } from "@/lib/hex-color";
import {
  sanitizeSectionStyles,
  type SectionStyle,
} from "@/lib/section-style-schema";

const HERO_STYLES = new Set(["full-image", "split", "minimal", "magazine"]);
const SECTION_KEYS = ["hero", "collections", "featured", "journal", "promise", "testimonials", "faq", "stats", "partners", "gallery", "visit"];

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
    heroSplitRatio?: string;
    heroImageFocus?: string;
    heroSplitImageAspect?: string;
    heroSplitTextAlign?: string;
    heroSplitTextAlignX?: string;
    heroSplitTextPadding?: string;
    heroSplitMobilePadY?: string;
    heroSplitGap?: string;
    heroSplitMobileOrder?: string;
    heroSplitHeight?: string;
    heroSplitTextBg?: string | null;
    heroMagazineRuleWeight?: string;
    heroMagazineRuleTone?: string;
    heroMagazineGap?: string;
    heroMagazineTextWidth?: string;
    heroMagazineRuleWidth?: string;
    heroMagazinePadX?: string;
    heroMagazineSubtitleWidth?: string;
    heroMagazineTextGap?: string;
    heroMinimalWidth?: string;
    heroMinimalPadding?: string;
    heroMinimalPadX?: string;
    heroMinimalRule?: string;
    heroMinimalRuleColor?: string | null;
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
    heroHeight?: string;
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

function sanitizeHex(s: unknown): string | undefined {
  return normalizeHexColor(s) ?? undefined;
}

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

  if (payload.primary !== undefined) {
    const hex = sanitizeHex(payload.primary);
    if (hex) merged.primary = hex;
  }
  if (payload.accent !== undefined) {
    const hex = sanitizeHex(payload.accent);
    if (hex) merged.accent = hex;
  }
  if (payload.tagline !== undefined) {
    merged.tagline = String(payload.tagline).slice(0, 500);
  }
  if (payload.heroUrl !== undefined) {
    merged.hero_url = payload.heroUrl ? String(payload.heroUrl).slice(0, 500) : null;
  }
  if (payload.logoUrl !== undefined) {
    merged.logo_url = payload.logoUrl ? String(payload.logoUrl).slice(0, 500) : null;
  }

  if (payload.layout) {
    const existingLayout = (existing.layout as Record<string, unknown>) ?? {};
    const layoutPatch: Record<string, unknown> = { ...existingLayout };

    if (payload.layout.heroStyle && HERO_STYLES.has(payload.layout.heroStyle)) {
      layoutPatch.heroStyle = payload.layout.heroStyle;
    }
    if (payload.layout.heroEyebrow !== undefined) {
      layoutPatch.heroEyebrow = String(payload.layout.heroEyebrow).slice(0, 200);
    }
    if (payload.layout.heroSubtitle !== undefined) {
      layoutPatch.heroSubtitle = String(payload.layout.heroSubtitle).slice(0, 1000);
    }
    if (payload.layout.heroImageSide) {
      layoutPatch.heroImageSide =
        payload.layout.heroImageSide === "right" ? "right" : "left";
    }
    if (payload.layout.sectionOrder) {
      const order: string[] = [];
      for (const k of payload.layout.sectionOrder) {
        if (typeof k === "string" && SECTION_KEYS.includes(k) && !order.includes(k)) {
          order.push(k);
        }
      }
      // 基本必要 6 個 section（DEFAULT_SECTION_ORDER）沒在 user order 就 append
      // testimonials 不 auto-append（商家自己加才會出現）
      for (const k of ["hero", "collections", "featured", "journal", "promise", "visit"]) {
        if (!order.includes(k)) order.push(k);
      }
      layoutPatch.sectionOrder = order;
    }
    if (payload.layout.testimonials !== undefined && Array.isArray(payload.layout.testimonials)) {
      layoutPatch.testimonials = payload.layout.testimonials
        .filter((t) => t && typeof t === "object")
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
        .filter((f) => f && typeof f === "object")
        .map((f) => ({
          question: String(f.question ?? "").slice(0, 300).trim(),
          answer: String(f.answer ?? "").slice(0, 2000).trim(),
        }))
        .filter((f) => f.question && f.answer)
        .slice(0, 20);
    }
    if (payload.layout.stats !== undefined && Array.isArray(payload.layout.stats)) {
      layoutPatch.stats = payload.layout.stats
        .filter((s) => s && typeof s === "object")
        .map((s) => ({
          value: String(s.value ?? "").slice(0, 30).trim(),
          label: String(s.label ?? "").slice(0, 60).trim(),
        }))
        .filter((s) => s.value && s.label)
        .slice(0, 6);
    }
    if (payload.layout.partners !== undefined && Array.isArray(payload.layout.partners)) {
      layoutPatch.partners = payload.layout.partners
        .filter((p) => p && typeof p === "object")
        .map((p) => ({
          name: String(p.name ?? "").slice(0, 100).trim(),
          logoUrl: String(p.logoUrl ?? "").slice(0, 500).trim(),
          href: p.href ? String(p.href).slice(0, 500).trim() : null,
        }))
        .filter((p) => p.name && p.logoUrl)
        .slice(0, 12);
    }
    if (payload.layout.mapEmbedUrl !== undefined) {
      const v = payload.layout.mapEmbedUrl;
      // 只接受 google maps embed URL，防 user 貼任意 iframe src
      if (v === null || v === "") {
        layoutPatch.mapEmbedUrl = null;
      } else if (
        typeof v === "string" &&
        /^https:\/\/(www\.)?google\.com\/maps\/embed/i.test(v)
      ) {
        layoutPatch.mapEmbedUrl = v.slice(0, 1000).trim();
      }
    }
    if (payload.layout.heroZoom !== undefined) {
      const z = payload.layout.heroZoom;
      if (typeof z === "number" && Number.isFinite(z)) {
        layoutPatch.heroZoom = clampHeroZoom(z);
      }
    }
    for (const key of ["heroZoomMobile", "heroZoomTablet", "heroZoomDesktop"] as const) {
      const z = payload.layout[key];
      if (z !== undefined && typeof z === "number" && Number.isFinite(z)) {
        layoutPatch[key] = clampHeroZoom(z);
      }
    }
    if (payload.layout.heroTaglineFontScale !== undefined) {
      const v = payload.layout.heroTaglineFontScale;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.heroTaglineFontScale = clampHeroFontScale(v);
      }
    }
    if (payload.layout.heroTaglineColor !== undefined) {
      const v = payload.layout.heroTaglineColor;
      if (v === null || v === "") {
        layoutPatch.heroTaglineColor = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroTaglineColor = hex;
      }
    }
    if (payload.layout.heroHeight !== undefined) {
      const v = payload.layout.heroHeight;
      if (v === "auto" || v === "short" || v === "tall" || v === "full") {
        layoutPatch.heroHeight = v;
      }
    }
    if (payload.layout.heroTaglineAlign !== undefined) {
      const v = payload.layout.heroTaglineAlign;
      if (v === "left" || v === "center" || v === "right") {
        layoutPatch.heroTaglineAlign = v;
      }
    }
    if (payload.layout.heroTaglineWeight !== undefined) {
      const v = payload.layout.heroTaglineWeight;
      if (v === "normal" || v === "medium" || v === "bold") {
        layoutPatch.heroTaglineWeight = v;
      }
    }
    if (payload.layout.heroTaglineTracking !== undefined) {
      const v = payload.layout.heroTaglineTracking;
      if (v === "tight" || v === "normal" || v === "wide") {
        layoutPatch.heroTaglineTracking = v;
      }
    }
    if (payload.layout.heroTaglineLeading !== undefined) {
      const v = payload.layout.heroTaglineLeading;
      if (v === "tight" || v === "normal" || v === "relaxed") {
        layoutPatch.heroTaglineLeading = v;
      }
    }
    if (payload.layout.heroEyebrowFontScale !== undefined) {
      const v = payload.layout.heroEyebrowFontScale;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.heroEyebrowFontScale = clampHeroFontScale(v);
      }
    }
    if (payload.layout.heroEyebrowTracking !== undefined) {
      const v = payload.layout.heroEyebrowTracking;
      if (v === "tight" || v === "normal" || v === "wide") {
        layoutPatch.heroEyebrowTracking = v;
      }
    }
    if (payload.layout.heroEyebrowColor !== undefined) {
      const v = payload.layout.heroEyebrowColor;
      if (v === null || v === "") {
        layoutPatch.heroEyebrowColor = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroEyebrowColor = hex;
      }
    }
    if (payload.layout.heroEyebrowCase !== undefined) {
      const v = payload.layout.heroEyebrowCase;
      if (v === "upper" || v === "capitalize" || v === "none") {
        layoutPatch.heroEyebrowCase = v;
      }
    }
    if (payload.layout.heroEyebrowWeight !== undefined) {
      const v = payload.layout.heroEyebrowWeight;
      if (v === "normal" || v === "medium" || v === "bold") {
        layoutPatch.heroEyebrowWeight = v;
      }
    }
    if (payload.layout.heroSubtitleFontScale !== undefined) {
      const v = payload.layout.heroSubtitleFontScale;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.heroSubtitleFontScale = clampHeroFontScale(v);
      }
    }
    if (payload.layout.heroSubtitleColor !== undefined) {
      const v = payload.layout.heroSubtitleColor;
      if (v === null || v === "") {
        layoutPatch.heroSubtitleColor = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroSubtitleColor = hex;
      }
    }
    if (payload.layout.heroSubtitleAlign !== undefined) {
      const v = payload.layout.heroSubtitleAlign;
      if (v === "inherit" || v === "left" || v === "center" || v === "right") {
        layoutPatch.heroSubtitleAlign = v;
      }
    }
    if (payload.layout.heroSubtitleWeight !== undefined) {
      const v = payload.layout.heroSubtitleWeight;
      if (v === "normal" || v === "medium" || v === "bold") {
        layoutPatch.heroSubtitleWeight = v;
      }
    }
    if (payload.layout.heroSubtitleTracking !== undefined) {
      const v = payload.layout.heroSubtitleTracking;
      if (v === "tight" || v === "normal" || v === "wide") {
        layoutPatch.heroSubtitleTracking = v;
      }
    }
    if (payload.layout.heroSubtitleLeading !== undefined) {
      const v = payload.layout.heroSubtitleLeading;
      if (v === "tight" || v === "normal" || v === "relaxed") {
        layoutPatch.heroSubtitleLeading = v;
      }
    }
    if (payload.layout.heroCtaFontScale !== undefined) {
      const v = payload.layout.heroCtaFontScale;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.heroCtaFontScale = clampHeroFontScale(v);
      }
    }
    if (payload.layout.heroCtaTracking !== undefined) {
      const v = payload.layout.heroCtaTracking;
      if (v === "tight" || v === "normal" || v === "wide") {
        layoutPatch.heroCtaTracking = v;
      }
    }
    if (payload.layout.heroCtaCase !== undefined) {
      const v = payload.layout.heroCtaCase;
      if (v === "default" || v === "capitalize" || v === "none") {
        layoutPatch.heroCtaCase = v;
      }
    }
    if (payload.layout.heroCtaWeight !== undefined) {
      const v = payload.layout.heroCtaWeight;
      if (v === "default" || v === "normal" || v === "medium" || v === "bold") {
        layoutPatch.heroCtaWeight = v;
      }
    }
    if (payload.layout.heroCtaColor !== undefined) {
      const v = payload.layout.heroCtaColor;
      if (v === null || v === "") {
        layoutPatch.heroCtaColor = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroCtaColor = hex;
      }
    }
    if (payload.layout.heroBylineFontScale !== undefined) {
      const v = payload.layout.heroBylineFontScale;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.heroBylineFontScale = clampHeroFontScale(v);
      }
    }
    if (payload.layout.heroBylineColor !== undefined) {
      const v = payload.layout.heroBylineColor;
      if (v === null || v === "") {
        layoutPatch.heroBylineColor = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroBylineColor = hex;
      }
    }
    if (payload.layout.heroBylineTracking !== undefined) {
      const v = payload.layout.heroBylineTracking;
      if (v === "tight" || v === "normal" || v === "wide") {
        layoutPatch.heroBylineTracking = v;
      }
    }
    if (payload.layout.heroBylineCase !== undefined) {
      const v = payload.layout.heroBylineCase;
      if (v === "upper" || v === "capitalize" || v === "none") {
        layoutPatch.heroBylineCase = v;
      }
    }
    if (payload.layout.heroBylineWeight !== undefined) {
      const v = payload.layout.heroBylineWeight;
      if (v === "normal" || v === "medium" || v === "bold") {
        layoutPatch.heroBylineWeight = v;
      }
    }
    if (payload.layout.heroSplitRatio !== undefined) {
      const v = payload.layout.heroSplitRatio;
      if (v === "image-narrow" || v === "normal" || v === "image-wide") {
        layoutPatch.heroSplitRatio = v;
      }
    }
    if (payload.layout.heroImageFocus !== undefined) {
      const v = payload.layout.heroImageFocus;
      if (v === "top" || v === "center" || v === "bottom") {
        layoutPatch.heroImageFocus = v;
      }
    }
    if (payload.layout.heroSplitImageAspect !== undefined) {
      const v = payload.layout.heroSplitImageAspect;
      if (v === "tall" || v === "square" || v === "wide") {
        layoutPatch.heroSplitImageAspect = v;
      }
    }
    if (payload.layout.heroSplitTextAlign !== undefined) {
      const v = payload.layout.heroSplitTextAlign;
      if (v === "top" || v === "center" || v === "bottom") {
        layoutPatch.heroSplitTextAlign = v;
      }
    }
    if (payload.layout.heroSplitTextAlignX !== undefined) {
      const v = payload.layout.heroSplitTextAlignX;
      if (v === "left" || v === "center" || v === "right") {
        layoutPatch.heroSplitTextAlignX = v;
      }
    }
    if (payload.layout.heroSplitMobileOrder !== undefined) {
      const v = payload.layout.heroSplitMobileOrder;
      if (v === "image-first" || v === "text-first") {
        layoutPatch.heroSplitMobileOrder = v;
      }
    }
    if (payload.layout.heroSplitTextBg !== undefined) {
      const v = payload.layout.heroSplitTextBg;
      if (v === null || v === "") {
        layoutPatch.heroSplitTextBg = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroSplitTextBg = hex;
      }
    }
    if (payload.layout.heroSplitHeight !== undefined) {
      const v = payload.layout.heroSplitHeight;
      if (v === "content" || v === "compact" || v === "normal") {
        layoutPatch.heroSplitHeight = v;
      }
    }
    if (payload.layout.heroSplitTextPadding !== undefined) {
      const v = payload.layout.heroSplitTextPadding;
      if (v === "tight" || v === "normal" || v === "roomy") {
        layoutPatch.heroSplitTextPadding = v;
      }
    }
    if (payload.layout.heroSplitMobilePadY !== undefined) {
      const v = payload.layout.heroSplitMobilePadY;
      if (v === "tight" || v === "normal" || v === "roomy") {
        layoutPatch.heroSplitMobilePadY = v;
      }
    }
    if (payload.layout.heroSplitGap !== undefined) {
      const v = payload.layout.heroSplitGap;
      if (v === "tight" || v === "normal" || v === "loose") {
        layoutPatch.heroSplitGap = v;
      }
    }
    if (payload.layout.heroMagazineRuleWeight !== undefined) {
      const v = payload.layout.heroMagazineRuleWeight;
      if (v === "normal" || v === "medium" || v === "thick") {
        layoutPatch.heroMagazineRuleWeight = v;
      }
    }
    if (payload.layout.heroMagazineRuleTone !== undefined) {
      const v = payload.layout.heroMagazineRuleTone;
      if (v === "normal" || v === "faint" || v === "strong" || v === "accent") {
        layoutPatch.heroMagazineRuleTone = v;
      }
    }
    if (payload.layout.heroMagazineGap !== undefined) {
      const v = payload.layout.heroMagazineGap;
      if (v === "tight" || v === "medium" || v === "normal") {
        layoutPatch.heroMagazineGap = v;
      }
    }
    if (payload.layout.heroMagazineTextWidth !== undefined) {
      const v = payload.layout.heroMagazineTextWidth;
      if (v === "narrow" || v === "normal" || v === "rule" || v === "full") {
        layoutPatch.heroMagazineTextWidth = v;
      }
    }
    if (payload.layout.heroMagazineRuleWidth !== undefined) {
      const v = payload.layout.heroMagazineRuleWidth;
      if (v === "narrow" || v === "normal" || v === "full") {
        layoutPatch.heroMagazineRuleWidth = v;
      }
    }
    if (payload.layout.heroMagazineTextGap !== undefined) {
      const v = payload.layout.heroMagazineTextGap;
      if (v === "tight" || v === "normal" || v === "loose") {
        layoutPatch.heroMagazineTextGap = v;
      }
    }
    if (payload.layout.heroMagazinePadX !== undefined) {
      const v = payload.layout.heroMagazinePadX;
      if (v === "narrow" || v === "normal" || v === "wide") {
        layoutPatch.heroMagazinePadX = v;
      }
    }
    if (payload.layout.heroMagazineSubtitleWidth !== undefined) {
      const v = payload.layout.heroMagazineSubtitleWidth;
      if (v === "narrow" || v === "normal" || v === "wide" || v === "title") {
        layoutPatch.heroMagazineSubtitleWidth = v;
      }
    }
    if (payload.layout.heroMinimalWidth !== undefined) {
      const v = payload.layout.heroMinimalWidth;
      if (v === "narrow" || v === "normal" || v === "wide") {
        layoutPatch.heroMinimalWidth = v;
      }
    }
    if (payload.layout.heroMinimalPadding !== undefined) {
      const v = payload.layout.heroMinimalPadding;
      if (v === "compact" || v === "normal" || v === "spacious") {
        layoutPatch.heroMinimalPadding = v;
      }
    }
    if (payload.layout.heroMinimalPadX !== undefined) {
      const v = payload.layout.heroMinimalPadX;
      if (v === "narrow" || v === "normal" || v === "wide") {
        layoutPatch.heroMinimalPadX = v;
      }
    }
    if (payload.layout.heroMinimalRule !== undefined) {
      const v = payload.layout.heroMinimalRule;
      if (v === "none" || v === "short" || v === "normal" || v === "long") {
        layoutPatch.heroMinimalRule = v;
      }
    }
    if (payload.layout.heroMinimalRuleColor !== undefined) {
      const v = payload.layout.heroMinimalRuleColor;
      if (v === null || v === "") {
        layoutPatch.heroMinimalRuleColor = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroMinimalRuleColor = hex;
      }
    }
    if (payload.layout.heroMinimalAlign !== undefined) {
      const v = payload.layout.heroMinimalAlign;
      if (v === "left" || v === "center" || v === "right") {
        layoutPatch.heroMinimalAlign = v;
      }
    }
    if (payload.layout.heroMinimalGap !== undefined) {
      const v = payload.layout.heroMinimalGap;
      if (v === "tight" || v === "normal" || v === "loose") {
        layoutPatch.heroMinimalGap = v;
      }
    }
    if (payload.layout.heroMinimalBg !== undefined) {
      const v = payload.layout.heroMinimalBg;
      if (v === null || v === "") {
        layoutPatch.heroMinimalBg = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroMinimalBg = hex;
      }
    }
    if (payload.layout.heroMagazineBg !== undefined) {
      const v = payload.layout.heroMagazineBg;
      if (v === null || v === "") {
        layoutPatch.heroMagazineBg = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroMagazineBg = hex;
      }
    }
    if (payload.layout.heroTextBg !== undefined) {
      const v = payload.layout.heroTextBg;
      if (v === null || v === "") {
        layoutPatch.heroTextBg = null;
      } else {
        const hex = normalizeHexColor(v);
        if (hex) layoutPatch.heroTextBg = hex;
      }
    }
    if (payload.layout.heroTextPadding !== undefined) {
      const v = payload.layout.heroTextPadding;
      if (v === "compact" || v === "normal" || v === "spacious") {
        layoutPatch.heroTextPadding = v;
      }
    }
    if (payload.layout.heroTextWidth !== undefined) {
      const v = payload.layout.heroTextWidth;
      if (v === "narrow" || v === "normal" || v === "wide" || v === "full") {
        layoutPatch.heroTextWidth = v;
      }
    }
    if (payload.layout.heroTextAlignX !== undefined) {
      const v = payload.layout.heroTextAlignX;
      if (v === "left" || v === "center" || v === "right") {
        layoutPatch.heroTextAlignX = v;
      }
    }
    if (payload.layout.heroTextGap !== undefined) {
      const v = payload.layout.heroTextGap;
      if (v === "tight" || v === "normal" || v === "loose") {
        layoutPatch.heroTextGap = v;
      }
    }
    if (payload.layout.heroImageMaxHeight !== undefined) {
      const v = payload.layout.heroImageMaxHeight;
      if (v === "none" || v === "screen" || v === "short") {
        layoutPatch.heroImageMaxHeight = v;
      }
    }
    if (payload.layout.fontScale !== undefined) {
      const v = payload.layout.fontScale;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.fontScale = clampFontScale(v);
      }
    }
    if (payload.layout.sectionPaddingScale !== undefined) {
      const v = payload.layout.sectionPaddingScale;
      if (v === "compact" || v === "default" || v === "spacious") {
        layoutPatch.sectionPaddingScale = v;
      }
    }
    if (payload.layout.buttonRadius !== undefined) {
      const v = payload.layout.buttonRadius;
      if (v === "pill" || v === "soft" || v === "square") {
        layoutPatch.buttonRadius = v;
      }
    }
    // 頁尾底色 / 文字色：跟其他色碼欄位同一套（空字串 = 清除回預設，非法色碼整格不存）
    for (const field of ["footerBg", "footerText"] as const) {
      if (payload.layout[field] !== undefined) {
        const v = payload.layout[field];
        if (v === null || v === "") {
          layoutPatch[field] = null;
        } else {
          const hex = normalizeHexColor(v);
          if (hex) layoutPatch[field] = hex;
        }
      }
    }
    if (payload.layout.featuredCount !== undefined) {
      const v = payload.layout.featuredCount;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.featuredCount = clampFeaturedCount(v);
      }
    }
    if (payload.layout.featuredColumns !== undefined) {
      const v = payload.layout.featuredColumns;
      if (v === 2 || v === 3 || v === 4) layoutPatch.featuredColumns = v;
    }
    if (payload.layout.collectionsColumns !== undefined) {
      const v = payload.layout.collectionsColumns;
      if (v === 2 || v === 3 || v === 4) layoutPatch.collectionsColumns = v;
    }
    if (payload.layout.testimonialsColumns !== undefined) {
      const v = payload.layout.testimonialsColumns;
      if (v === 2 || v === 3 || v === 4) layoutPatch.testimonialsColumns = v;
    }
    if (payload.layout.statsColumns !== undefined) {
      const v = payload.layout.statsColumns;
      if (v === 2 || v === 3 || v === 4) layoutPatch.statsColumns = v;
    }
    if (payload.layout.galleryColumns !== undefined) {
      const v = payload.layout.galleryColumns;
      if (v === 2 || v === 3 || v === 4) layoutPatch.galleryColumns = v;
    }
    if (payload.layout.journalColumns !== undefined) {
      const v = payload.layout.journalColumns;
      // 慢讀固定三張卡，4 欄永遠填不滿，只收 2/3
      if (v === 2 || v === 3) layoutPatch.journalColumns = v;
    }
    if (payload.layout.faqDefaultOpen !== undefined) {
      const v = payload.layout.faqDefaultOpen;
      if (v === "none" || v === "first" || v === "all") {
        layoutPatch.faqDefaultOpen = v;
      }
    }
    if (payload.layout.sectionStyles !== undefined) {
      // 欄位表與合法值都在 lib/section-style-schema，跟公開頁讀回那層走同一支——
      // 以前這裡跟 _theme.ts 各手抄一條長判斷鏈，漏在存這邊就是「存得下去、重整就沒了」。
      layoutPatch.sectionStyles = sanitizeSectionStyles(payload.layout.sectionStyles);
    }
    if (payload.layout.freePositions !== undefined) {
      const fp = payload.layout.freePositions;
      const sanitized: Record<string, { x: number; y: number }> = {};
      if (fp && typeof fp === "object" && !Array.isArray(fp)) {
        for (const [k, v] of Object.entries(fp)) {
          if (!k || typeof k !== "string" || k.length > 60) continue;
          if (!v || typeof v !== "object") continue;
          const x = v.x;
          const y = v.y;
          if (typeof x !== "number" || typeof y !== "number") continue;
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          sanitized[k] = {
            x: clampFreePos(x),
            y: clampFreePos(y),
          };
        }
      }
      layoutPatch.freePositions = sanitized;
    }
    if (payload.layout.gallery !== undefined && Array.isArray(payload.layout.gallery)) {
      layoutPatch.gallery = payload.layout.gallery
        .filter((g) => g && typeof g === "object")
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
      hpPatch.promise = String(payload.homepage.promise).slice(0, 2000);
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
        500
      );
    }
    if (payload.homepage.collectionsEyebrow !== undefined) {
      const v = String(payload.homepage.collectionsEyebrow).trim().slice(0, 60);
      hpPatch.collectionsEyebrow = v || null;
    }
    if (payload.homepage.visitTitle !== undefined) {
      hpPatch.visitTitle = String(payload.homepage.visitTitle).slice(0, 100);
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
    if (payload.homepage.journalCardLabel !== undefined) {
      const v = String(payload.homepage.journalCardLabel).trim().slice(0, 60);
      hpPatch.journalCardLabel = v || null;
    }
    if (payload.homepage.journalCards !== undefined) {
      const arr = Array.isArray(payload.homepage.journalCards)
        ? payload.homepage.journalCards
        : [];
      hpPatch.journalCards = arr
        .filter((c) => c && typeof c === "object")
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
      // 上限 6 跟固定六個情境 key 對齊
      hpPatch.collectionItems = arr
        .filter((c) => c && typeof c === "object")
        .map((c) => ({
          key: String(c.key ?? "").trim().slice(0, 40),
          title: String(c.title ?? "").trim().slice(0, 60),
          subtitle: String(c.subtitle ?? "").trim().slice(0, 80),
        }))
        .filter((c) => c.key && c.title)
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
