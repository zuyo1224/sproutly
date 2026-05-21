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
  };
  homepage?: {
    promise?: string;
    collectionsIntro?: string;
    visitTitle?: string;
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
    if (payload.homepage.collectionsIntro !== undefined) {
      hpPatch.collectionsIntro = String(payload.homepage.collectionsIntro).slice(
        0,
        500
      );
    }
    if (payload.homepage.visitTitle !== undefined) {
      hpPatch.visitTitle = String(payload.homepage.visitTitle).slice(0, 100);
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
