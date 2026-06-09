"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
    heroHeight?: string;
    fontScale?: number;
    sectionPaddingScale?: string;
    featuredCount?: number;
    featuredColumns?: number;
    collectionsColumns?: number;
    sectionStyles?: Record<string, {
      headingAlign?: string;
      bgColor?: string | null;
      textColor?: string | null;
      paddingScale?: string;
      divider?: string;
      headingScale?: string;
      minHeight?: string;
      outline?: string;
      shadow?: string;
      borderRadius?: string;
      entrance?: string;
      fontFamily?: string;
      letterSpacing?: string;
      lineHeight?: string;
      opacity?: string;
      filter?: string;
    }>;
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
    journalCardLabel?: string;
    journalCards?: Array<{ eyebrow?: string; title?: string; excerpt?: string }>;
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
  if (typeof s !== "string") return undefined;
  return /^#[0-9a-fA-F]{6}$/.test(s.trim()) ? s.trim() : undefined;
}

export async function saveEditorState(slug: string, payload: EditorPayload) {
  if (!slug) return { error: "missing slug" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

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
        layoutPatch.heroZoom = Math.max(1.0, Math.min(2.5, z));
      }
    }
    for (const key of ["heroZoomMobile", "heroZoomTablet", "heroZoomDesktop"] as const) {
      const z = payload.layout[key];
      if (z !== undefined && typeof z === "number" && Number.isFinite(z)) {
        layoutPatch[key] = Math.max(1.0, Math.min(2.5, z));
      }
    }
    if (payload.layout.heroTaglineFontScale !== undefined) {
      const v = payload.layout.heroTaglineFontScale;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.heroTaglineFontScale = Math.max(0.6, Math.min(1.8, v));
      }
    }
    if (payload.layout.heroTaglineColor !== undefined) {
      const v = payload.layout.heroTaglineColor;
      if (v === null || v === "") {
        layoutPatch.heroTaglineColor = null;
      } else if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim())) {
        layoutPatch.heroTaglineColor = v.trim();
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
    if (payload.layout.fontScale !== undefined) {
      const v = payload.layout.fontScale;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.fontScale = Math.max(0.8, Math.min(1.3, v));
      }
    }
    if (payload.layout.sectionPaddingScale !== undefined) {
      const v = payload.layout.sectionPaddingScale;
      if (v === "compact" || v === "default" || v === "spacious") {
        layoutPatch.sectionPaddingScale = v;
      }
    }
    if (payload.layout.featuredCount !== undefined) {
      const v = payload.layout.featuredCount;
      if (typeof v === "number" && Number.isFinite(v)) {
        layoutPatch.featuredCount = Math.max(3, Math.min(12, Math.floor(v)));
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
    if (payload.layout.sectionStyles !== undefined) {
      const raw = payload.layout.sectionStyles;
      const sanitized: Record<string, { headingAlign?: string; bgColor?: string | null; textColor?: string | null; paddingScale?: string; divider?: string; headingScale?: string; minHeight?: string; outline?: string; shadow?: string; borderRadius?: string; entrance?: string; fontFamily?: string; letterSpacing?: string; lineHeight?: string; opacity?: string; filter?: string }> = {};
      if (raw && typeof raw === "object") {
        for (const [k, v] of Object.entries(raw)) {
          if (!k || typeof k !== "string" || k.length > 60) continue;
          if (!v || typeof v !== "object") continue;
          const entry: { headingAlign?: string; bgColor?: string | null; textColor?: string | null; paddingScale?: string; divider?: string; headingScale?: string; minHeight?: string; outline?: string; shadow?: string; borderRadius?: string; entrance?: string; fontFamily?: string; letterSpacing?: string; lineHeight?: string; opacity?: string; filter?: string } = {};
          if (v.headingAlign === "left" || v.headingAlign === "center" || v.headingAlign === "right") {
            entry.headingAlign = v.headingAlign;
          }
          if (typeof v.bgColor === "string" && /^#[0-9a-fA-F]{6}$/.test(v.bgColor.trim())) {
            entry.bgColor = v.bgColor.trim();
          } else if (v.bgColor === null) {
            entry.bgColor = null;
          }
          if (typeof v.textColor === "string" && /^#[0-9a-fA-F]{6}$/.test(v.textColor.trim())) {
            entry.textColor = v.textColor.trim();
          } else if (v.textColor === null) {
            entry.textColor = null;
          }
          if (v.paddingScale === "compact" || v.paddingScale === "default" || v.paddingScale === "spacious") {
            entry.paddingScale = v.paddingScale;
          }
          if (v.divider === "none" || v.divider === "top" || v.divider === "bottom" || v.divider === "both") {
            entry.divider = v.divider;
          }
          if (v.headingScale === "small" || v.headingScale === "default" || v.headingScale === "large") {
            entry.headingScale = v.headingScale;
          }
          if (v.minHeight === "auto" || v.minHeight === "tall" || v.minHeight === "fullscreen") {
            entry.minHeight = v.minHeight;
          }
          if (v.outline === "none" || v.outline === "subtle" || v.outline === "strong") {
            entry.outline = v.outline;
          }
          if (v.shadow === "none" || v.shadow === "soft" || v.shadow === "deep") {
            entry.shadow = v.shadow;
          }
          if (v.borderRadius === "none" || v.borderRadius === "soft" || v.borderRadius === "strong") {
            entry.borderRadius = v.borderRadius;
          }
          if (v.entrance === "none" || v.entrance === "fade" || v.entrance === "slide-up") {
            entry.entrance = v.entrance;
          }
          if (v.fontFamily === "default" || v.fontFamily === "serif" || v.fontFamily === "sans") {
            entry.fontFamily = v.fontFamily;
          }
          if (v.letterSpacing === "tight" || v.letterSpacing === "normal" || v.letterSpacing === "wide") {
            entry.letterSpacing = v.letterSpacing;
          }
          if (v.lineHeight === "tight" || v.lineHeight === "normal" || v.lineHeight === "relaxed") {
            entry.lineHeight = v.lineHeight;
          }
          if (v.opacity === "default" || v.opacity === "muted" || v.opacity === "faint") {
            entry.opacity = v.opacity;
          }
          if (v.filter === "none" || v.filter === "grayscale" || v.filter === "sepia") {
            entry.filter = v.filter;
          }
          if (entry.headingAlign !== undefined || entry.bgColor !== undefined || entry.textColor !== undefined || entry.paddingScale !== undefined || entry.divider !== undefined || entry.headingScale !== undefined || entry.minHeight !== undefined || entry.outline !== undefined || entry.shadow !== undefined || entry.borderRadius !== undefined || entry.entrance !== undefined || entry.fontFamily !== undefined || entry.letterSpacing !== undefined || entry.lineHeight !== undefined || entry.opacity !== undefined || entry.filter !== undefined) {
            sanitized[k] = entry;
          }
        }
      }
      layoutPatch.sectionStyles = sanitized;
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
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
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
