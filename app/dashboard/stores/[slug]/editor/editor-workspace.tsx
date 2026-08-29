"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveEditorState } from "./actions";
import {
  detectHeroImageBounds,
  type HeroImageBounds,
} from "@/lib/hero-image-bounds";
import { AssetPicker } from "@/app/_components/asset-picker";
import { EditorAIChat } from "./editor-ai-chat";
import {
  HERO_ZOOM_MIN,
  HERO_ZOOM_MAX,
  HERO_FONT_SCALE_MIN,
  HERO_FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FEATURED_COUNT_MIN,
  FEATURED_COUNT_MAX,
} from "@/lib/theme-scale";
import { FREE_POS_KEYS, SECTION_DRAG_ELEMENT, stripLegacyFreePositions } from "@/lib/free-positions";
import type { SectionStyle } from "@/app/[slug]/_theme";
import { applySectionStylePatch, type SectionStylePatch } from "@/lib/section-style-schema";

type SectionKey =
  | "hero"
  | "collections"
  | "featured"
  | "journal"
  | "promise"
  | "testimonials"
  | "faq"
  | "stats"
  | "partners"
  | "gallery"
  | "visit";
type HeroStyle = "full-image" | "split" | "minimal" | "magazine";

type Testimonial = { quote: string; author: string; role: string | null };
type FaqItem = { question: string; answer: string };
type StatItem = { value: string; label: string };
type PartnerItem = { name: string; logoUrl: string; href: string | null };
type GalleryItem = { url: string; caption: string | null };

const ADDABLE_BLOCKS: { key: SectionKey; label: string; description: string }[] = [
  { key: "testimonials", label: "顧客評語", description: "3 個 quote card" },
  { key: "faq", label: "常見問題", description: "Accordion 展開式問答" },
  { key: "stats", label: "數字 / 成就", description: "4 個大數字 + 標籤" },
  { key: "partners", label: "合作夥伴", description: "logo 灰階展示" },
  { key: "gallery", label: "圖片相簿", description: "3 欄圖片網格 + caption" },
];

type EditorTheme = {
  primary: string;
  accent: string;
  // 全站底色（preset base，唯讀）— 算區段文字色的對比防呆用，不經編輯器修改也不存回 DB
  bg: string;
  // 卡片底色 / 全站文字色（preset base，唯讀）— 頁尾配色那兩格的取色器初始值
  surface: string;
  text: string;
  tagline: string;
  heroUrl: string | null;
  logoUrl: string | null;
  layout: {
    heroStyle: HeroStyle;
    heroEyebrow: string | null;
    heroSubtitle: string | null;
    heroImageSide: "left" | "right";
    sectionOrder: SectionKey[];
    testimonials: Testimonial[];
    faqItems: FaqItem[];
    stats: StatItem[];
    partners: PartnerItem[];
    gallery: GalleryItem[];
    mapEmbedUrl: string | null;
    freePositions: Record<string, { x: number; y: number }>;
    heroZoom: number;
    heroZoomMobile: number;
    heroZoomTablet: number;
    heroZoomDesktop: number;
    heroTaglineFontScale: number;
    heroTaglineColor: string | null;
    heroTaglineAlign: "left" | "center" | "right";
    heroTaglineWeight: "normal" | "medium" | "bold";
    heroTaglineTracking: "tight" | "normal" | "wide";
    heroTaglineLeading: "tight" | "normal" | "relaxed";
    heroEyebrowFontScale: number;
    heroEyebrowTracking: "tight" | "normal" | "wide";
    heroEyebrowColor: string | null;
    heroEyebrowCase: "upper" | "capitalize" | "none";
    heroEyebrowWeight: "normal" | "medium" | "bold";
    heroSubtitleFontScale: number;
    heroSubtitleColor: string | null;
    heroSubtitleAlign: "inherit" | "left" | "center" | "right";
    heroSubtitleWeight: "normal" | "medium" | "bold";
    heroSubtitleTracking: "tight" | "normal" | "wide";
    heroSubtitleLeading: "tight" | "normal" | "relaxed";
    heroCtaFontScale: number;
    heroCtaTracking: "tight" | "normal" | "wide";
    heroCtaCase: "default" | "capitalize" | "none";
    heroCtaWeight: "default" | "normal" | "medium" | "bold";
    heroCtaColor: string | null;
    heroBylineFontScale: number;
    heroBylineColor: string | null;
    heroBylineTracking: "tight" | "normal" | "wide";
    heroBylineCase: "upper" | "capitalize" | "none";
    heroBylineWeight: "normal" | "medium" | "bold";
    heroSplitRatio: "image-narrow" | "normal" | "image-wide" | "photo";
    heroImageFocus: "top" | "center" | "bottom";
    heroImageFocusX: "left" | "center" | "right";
    heroSplitImageFit: "cover" | "contain";
    heroSplitImageAspect: "tall" | "square" | "wide" | "photo";
    heroSplitTextAlign: "top" | "center" | "bottom";
    heroSplitTextAlignX: "left" | "center" | "right";
    heroSplitTextPadding: "tight" | "normal" | "roomy";
    heroSplitMobilePadY: "tight" | "normal" | "roomy";
    heroSplitGap: "tight" | "normal" | "loose";
    heroSplitMobileOrder: "image-first" | "text-first";
    heroSplitHeight: "content" | "compact" | "normal";
    heroSplitTextBg: string | null;
    heroSplitImageBg: string | null;
    heroSplitDivider: "none" | "thin" | "medium" | "thick";
    heroSplitDividerTone: "normal" | "strong" | "accent";
    heroMagazineRuleWeight: "normal" | "medium" | "thick";
    heroMagazineRuleTone: "normal" | "faint" | "strong" | "accent";
    heroMagazineGap: "tight" | "medium" | "normal";
    heroMagazineTextWidth: "narrow" | "normal" | "rule" | "full";
    heroMagazineRuleWidth: "narrow" | "normal" | "full";
    heroMagazinePadX: "narrow" | "normal" | "wide";
    heroMagazineSubtitleWidth: "narrow" | "normal" | "wide" | "title";
    heroMagazineTextGap: "tight" | "normal" | "loose";
    heroMagazineBg: string | null;
    heroMinimalWidth: "narrow" | "normal" | "wide";
    heroMinimalPadding: "compact" | "normal" | "spacious";
    heroMinimalPadX: "narrow" | "normal" | "wide";
    heroMinimalRule: "none" | "short" | "normal" | "long";
    heroMinimalRuleColor: string | null;
    heroMinimalAlign: "left" | "center" | "right";
    heroMinimalBg: string | null;
    heroMinimalGap: "tight" | "normal" | "loose";
    heroTextBg: string | null;
    heroTextPadding: "compact" | "normal" | "spacious";
    heroTextWidth: "narrow" | "normal" | "wide" | "full";
    heroTextAlignX: "left" | "center" | "right";
    heroTextGap: "tight" | "normal" | "loose";
    heroImageMaxHeight: "none" | "screen" | "short";
    heroFullImageFit: "cover" | "contain";
    heroFullImageBg: string | null;
    heroImageBounds: HeroImageBounds | null;
    heroHeight: "auto" | "short" | "tall" | "full";
    fontScale: number;
    sectionPaddingScale: "compact" | "default" | "spacious";
    buttonRadius: "pill" | "soft" | "square";
    footerBg: string | null;
    footerText: string | null;
    featuredCount: number;
    featuredColumns: 2 | 3 | 4;
    collectionsColumns: 2 | 3 | 4;
    testimonialsColumns: 2 | 3 | 4;
    statsColumns: 2 | 3 | 4;
    galleryColumns: 2 | 3 | 4;
    journalColumns: 2 | 3;
    faqDefaultOpen: "none" | "first" | "all";
    // 欄位表跟公開頁共用同一份 SectionStyle，加控制不必兩邊各抄一次
    sectionStyles: Record<string, SectionStyle>;
  };
  homepage: {
    promise: string;
    promiseEyebrow: string;
    featuredTitle: string;
    featuredEyebrow: string;
    featuredCta: string;
    collectionsIntro: string;
    collectionsEyebrow: string;
    visitTitle: string;
    visitEyebrow: string;
    journalEyebrow: string;
    journalTitle: string;
    journalSubtitle: string;
    testimonialsEyebrow: string;
    testimonialsTitle: string;
    faqEyebrow: string;
    faqTitle: string;
    galleryEyebrow: string;
    galleryTitle: string;
    partnersEyebrow: string;
    statsEyebrow: string;
    statsTitle: string;
    heroCta: string;
    heroSecondaryCta: string;
    heroMagazineByline: string;
    collectionsCardCta: string;
    collectionItems: Array<{ key: string; title: string; subtitle: string }>;
    aboutEyebrow: string;
    aboutTitle: string;
    contactEyebrow: string;
    contactTitle: string;
    shopEyebrow: string;
    shopTitle: string;
    footerWordsLabel: string;
    footerFollowLabel: string;
    footerTrackLabel: string;
    journalCardLabel: string;
    journalCards: Array<{ eyebrow: string; title: string; excerpt: string }>;
  };
  sections: {
    about: boolean;
    contact: boolean;
    hours: boolean;
    faq: boolean;
    social: boolean;
  };
};

type SelectedTab = "section" | "design" | "content" | "ai";

// Journal 三張卡片預設內容（跟 _theme.ts 的 JOURNAL_CARD_DEFAULTS 對齊）
const JOURNAL_CARD_DEFAULTS: { eyebrow: string; title: string; excerpt: string }[] = [
  { eyebrow: "Care", title: "新手綠手指的第一步", excerpt: "光線、澆水頻率、換盆時機 — 把基本功講清楚，少走幾年彎路。" },
  { eyebrow: "Space", title: "把植物放進小空間", excerpt: "套房、租屋、窗台一隅，不同光線條件下的擺放提案。" },
  { eyebrow: "Story", title: "我們挑植物的方式", excerpt: "從花市到溫室，這些植物是怎麼被選進這間店的。" },
];

// 選物提案六張卡預設內容（跟 _theme.ts 的 HOMEPAGE_DEFAULT_COLLECTIONS 對齊）
const COLLECTION_ITEM_DEFAULTS: { key: string; title: string; subtitle: string }[] = [
  { key: "window", title: "給窗邊的", subtitle: "明亮散光也活得好" },
  { key: "living", title: "給客廳的", subtitle: "撐起整個空間" },
  { key: "desk", title: "給辦公桌的", subtitle: "小巧好顧" },
  { key: "bathroom", title: "給浴室的", subtitle: "潮濕也不怕" },
  { key: "nordic", title: "給北歐風的", subtitle: "搭淺木色家具" },
  { key: "japanese", title: "給日式空間的", subtitle: "配榻榻米和障子" },
];

const HERO_STYLE_LABELS: Record<HeroStyle, string> = {
  "full-image": "全屏沉浸",
  split: "左右分割",
  minimal: "極簡文字",
  magazine: "雜誌封面",
};

// 算顏色亮度（WCAG relative luminance），給「背景色 / 文字色」對比防呆用
function hexLuminance(hex: string): number | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin((int >> 16) & 255);
  const g = toLin((int >> 8) & 255);
  const b = toLin(int & 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function EditorWorkspace({
  slug,
  storeName,
  isPublished,
  sectionLabels,
  initialTheme,
}: {
  slug: string;
  storeName: string;
  isPublished: boolean;
  sectionLabels: Record<SectionKey, string>;
  initialTheme: EditorTheme;
}) {
  const [theme, setTheme] = useState<EditorTheme>(initialTheme);
  const [selectedSection, setSelectedSection] = useState<SectionKey>("hero");
  const [activeTab, setActiveTab] = useState<SelectedTab>("section");
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 把 theme 推進 iframe，iframe 端的 EditorClickBridge 接到後即時 patch DOM／CSS
  // 用於 undo/redo 等不需要 reload 的情境
  function pushThemeToIframe(themeToPush: EditorTheme) {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage(
      { type: "sproutly-theme-apply", theme: themeToPush },
      "*"
    );
  }
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 全螢幕預覽（隱藏 sidebar / panel，iframe 直接 100% 寬高）
  const [fullscreen, setFullscreen] = useState(false);
  // 240 second sidebar 變 floating popover；null = 關閉
  const [popover, setPopover] = useState<SelectedTab | null>(null);
  // 鍵盤快捷鍵說明浮層（按 ? 切換、Esc 關）
  const [showShortcuts, setShowShortcuts] = useState(false);
  // 區段樣式 clipboard — localStorage 持久化，跨 reload / 跨 store / 跨 session 還能貼
  // 一開始 SSR 初值 null，mount 後從 localStorage 讀回；變動時寫回 localStorage
  const [styleClipboard, setStyleClipboard] = useState<{
    source: SectionKey;
    fields: EditorTheme["layout"]["sectionStyles"][string];
  } | null>(null);
  // 合法 SectionKey 白名單，過濾 localStorage 殘留的舊 key（schema 變化後保護）
  const SECTION_KEYS_SET = useMemo(
    () => new Set<SectionKey>([
      "hero", "collections", "featured", "journal", "promise",
      "testimonials", "faq", "stats", "partners", "gallery", "visit",
    ]),
    [],
  );
  const STYLE_CLIPBOARD_KEY = "sproutly:editor:style-clipboard:v1";
  // mount 時從 localStorage 讀回 clipboard
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STYLE_CLIPBOARD_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.source === "string" &&
        SECTION_KEYS_SET.has(parsed.source as SectionKey) &&
        parsed.fields &&
        typeof parsed.fields === "object"
      ) {
        setStyleClipboard({ source: parsed.source, fields: parsed.fields });
      }
    } catch {
      // localStorage / JSON parse 壞了忽略，clipboard 維持 null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 變動時寫回 localStorage（null 清空 key）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (styleClipboard) {
        window.localStorage.setItem(STYLE_CLIPBOARD_KEY, JSON.stringify(styleClipboard));
      } else {
        window.localStorage.removeItem(STYLE_CLIPBOARD_KEY);
      }
    } catch {
      // quota / private mode 寫不進去就算了，session 內 React state 仍可用
    }
  }, [styleClipboard]);
  // 修 dnd-kit hydration error：useSortable 用 counter 生 ID，SSR / client 不一致
  // → 只在 client mount 後才 render DndContext / SortableContext
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  // AssetPicker：null = closed；其他 = 開啟中對應目標
  const [assetPickerMode, setAssetPickerMode] = useState<
    | null
    | { kind: "gallery-add" }
    | { kind: "gallery-replace"; index: number }
    | { kind: "partner-logo"; index: number }
    | { kind: "hero" }
    | { kind: "logo" }
  >(null);

  // Undo / Redo state — past / future stacks of theme snapshots
  const pastRef = useRef<EditorTheme[]>([]);
  const futureRef = useRef<EditorTheme[]>([]);
  const [historyTick, setHistoryTick] = useState(0); // 觸發 re-render of undo/redo buttons

  // 連續編輯合併：同一個欄位在這段時間內的連續改動（打字、拉 slider）只算一步，
  // 這樣按復原是一次退掉整段編輯，而不是一個字、一格一格退。
  const COALESCE_MS = 700;
  const coalesceRef = useRef<{ key: string; t: number } | null>(null);

  // coalesceKey 有值時：若上一步也是改同一欄位且在 700ms 內，就不另存一個復原點
  //（之前那個快照已經是「這段編輯開始前」的狀態，留著它就好）。
  function pushHistory(prev: EditorTheme, coalesceKey?: string) {
    // 任何新編輯都讓「重做」失效
    futureRef.current = [];
    if (coalesceKey) {
      const last = coalesceRef.current;
      const now = Date.now();
      if (last && last.key === coalesceKey && now - last.t < COALESCE_MS) {
        coalesceRef.current = { key: coalesceKey, t: now }; // 延長合併視窗
        setHistoryTick((t) => t + 1);
        return;
      }
      coalesceRef.current = { key: coalesceKey, t: now };
    } else {
      coalesceRef.current = null; // 非連續編輯（toggle、拖動等）中斷合併
    }
    pastRef.current.push(prev);
    if (pastRef.current.length > 50) pastRef.current.shift();
    setHistoryTick((t) => t + 1);
  }

  function update<K extends keyof EditorTheme>(key: K, value: EditorTheme[K]) {
    setTheme((t) => {
      pushHistory(t, String(key));
      return { ...t, [key]: value };
    });
    setDirty(true);
  }
  // coalesce 參數：不傳 = 照 patch 欄位名合併（打字、拉 slider 用）；
  // 傳字串 = 用呼叫端給的更細 key 合併（list 類要分到第幾筆哪個欄位，
  // 不然改完第 1 張卡馬上改第 2 張會被當同一段編輯，復原一次退掉兩張）；
  // 傳 false = 完全不合併（新增/刪除/換順序這種一下就完成的動作，各自一步）。
  function updateLayout(
    patch: Partial<EditorTheme["layout"]>,
    coalesce?: string | false
  ) {
    setTheme((t) => {
      pushHistory(
        t,
        coalesce === false
          ? undefined
          : coalesce ?? "layout:" + Object.keys(patch).sort().join(",")
      );
      return { ...t, layout: { ...t.layout, ...patch } };
    });
    setDirty(true);
  }
  function updateHomepage(patch: Partial<EditorTheme["homepage"]>) {
    setTheme((t) => {
      pushHistory(t, "homepage:" + Object.keys(patch).sort().join(","));
      return { ...t, homepage: { ...t.homepage, ...patch } };
    });
    setDirty(true);
  }

  function undo() {
    const last = pastRef.current.pop();
    if (!last) return;
    coalesceRef.current = null; // 復原後是全新動作，別跟前一段編輯合併
    futureRef.current.push(theme);
    setTheme(last);
    setDirty(true);
    setHistoryTick((t) => t + 1);
    // 立即把 reverted theme 推進 iframe（顏色 / 文字 / position 即時 patch，不 reload）
    pushThemeToIframe(last);
    // 背景 silent save 到 DB，下次 reload 才會反映，但此刻 user 已看到效果
    handleSave({ reloadIframe: false, themeOverride: last });
  }
  function redo() {
    const next = futureRef.current.pop();
    if (!next) return;
    coalesceRef.current = null; // 重做後是全新動作，別跟前一段編輯合併
    pastRef.current.push(theme);
    setTheme(next);
    setDirty(true);
    setHistoryTick((t) => t + 1);
    pushThemeToIframe(next);
    handleSave({ reloadIframe: false, themeOverride: next });
  }

  // 接 iframe edit click + inline text edit postMessage
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (typeof e.data !== "object" || !e.data) return;
      const msg = e.data as { type?: string; target?: string; field?: string; value?: string; index?: number };
      if (msg.type === "sproutly-edit-click" && typeof msg.target === "string") {
        const validKeys = [
          "hero",
          "collections",
          "featured",
          "journal",
          "promise",
          "testimonials",
          "faq",
          "stats",
          "partners",
          "gallery",
          "visit",
        ] as const;
        if ((validKeys as readonly string[]).includes(msg.target)) {
          setSelectedSection(msg.target as SectionKey);
          setActiveTab("section");
          // 不自動開左邊 popover — user 多次說「擋住」。
          // 反過來：user 在 iframe 點 section 就「關掉」 popover，因為他在
          // 編輯 canvas 內容，popover 不需要擋著。右側屬性 panel 仍 update。
          setPopover(null);
        }
      } else if (
        msg.type === "sproutly-edit-position-update" &&
        typeof (msg as { element?: string }).element === "string" &&
        typeof (msg as { x?: number }).x === "number" &&
        typeof (msg as { y?: number }).y === "number"
      ) {
        const m = msg as unknown as { element: string; x: number; y: number };
        // unified freePositions Record（任何 element 都走這條路徑）
        setTheme((t) => {
          pushHistory(t);
          return {
            ...t,
            layout: {
              ...t.layout,
              freePositions: {
                ...t.layout.freePositions,
                [m.element]: { x: m.x, y: m.y },
              },
            },
          };
        });
        setDirty(true);
      } else if (
        msg.type === "sproutly-edit-text-update" &&
        typeof msg.field === "string" &&
        typeof msg.value === "string"
      ) {
        const value = msg.value;
        if (msg.field === "tagline") {
          update("tagline", value);
        } else if (msg.field === "promise") {
          updateHomepage({ promise: value });
        } else if (msg.field === "visitTitle") {
          updateHomepage({ visitTitle: value });
        } else if (msg.field === "visitEyebrow") {
          updateHomepage({ visitEyebrow: value });
        } else if (msg.field === "featuredTitle") {
          updateHomepage({ featuredTitle: value });
        } else if (msg.field === "featuredEyebrow") {
          updateHomepage({ featuredEyebrow: value });
        } else if (msg.field === "featuredCta") {
          updateHomepage({ featuredCta: value });
        } else if (msg.field === "collectionsIntro") {
          updateHomepage({ collectionsIntro: value });
        } else if (msg.field === "collectionsEyebrow") {
          updateHomepage({ collectionsEyebrow: value });
        } else if (msg.field === "heroEyebrow") {
          updateLayout({ heroEyebrow: value || null });
        } else if (msg.field === "heroSubtitle") {
          updateLayout({ heroSubtitle: value || null });
        } else if (msg.field === "galleryEyebrow") {
          updateHomepage({ galleryEyebrow: value });
        } else if (msg.field === "galleryTitle") {
          updateHomepage({ galleryTitle: value });
        } else if (msg.field === "partnersEyebrow") {
          updateHomepage({ partnersEyebrow: value });
        } else if (msg.field === "statsEyebrow") {
          updateHomepage({ statsEyebrow: value });
        } else if (msg.field === "statsTitle") {
          updateHomepage({ statsTitle: value });
        } else if (msg.field === "faqEyebrow") {
          updateHomepage({ faqEyebrow: value });
        } else if (msg.field === "faqTitle") {
          updateHomepage({ faqTitle: value });
        } else if (msg.field === "heroCta") {
          updateHomepage({ heroCta: value });
        } else if (msg.field === "heroSecondaryCta") {
          updateHomepage({ heroSecondaryCta: value });
        } else if (msg.field === "heroMagazineByline") {
          updateHomepage({ heroMagazineByline: value });
        } else if (msg.field === "collectionsCardCta") {
          updateHomepage({ collectionsCardCta: value });
        } else if (msg.field === "aboutEyebrow") {
          updateHomepage({ aboutEyebrow: value });
        } else if (msg.field === "aboutTitle") {
          updateHomepage({ aboutTitle: value });
        } else if (msg.field === "contactEyebrow") {
          updateHomepage({ contactEyebrow: value });
        } else if (msg.field === "contactTitle") {
          updateHomepage({ contactTitle: value });
        } else if (msg.field === "shopEyebrow") {
          updateHomepage({ shopEyebrow: value });
        } else if (msg.field === "shopTitle") {
          updateHomepage({ shopTitle: value });
        } else if (msg.field === "journalCardLabel") {
          updateHomepage({ journalCardLabel: value });
        } else if (msg.field === "journalEyebrow") {
          updateHomepage({ journalEyebrow: value });
        } else if (msg.field === "journalTitle") {
          updateHomepage({ journalTitle: value });
        } else if (msg.field === "journalSubtitle") {
          updateHomepage({ journalSubtitle: value });
        } else if (msg.field === "testimonialsEyebrow") {
          updateHomepage({ testimonialsEyebrow: value });
        } else if (msg.field === "testimonialsTitle") {
          updateHomepage({ testimonialsTitle: value });
        } else if (msg.field === "promiseEyebrow") {
          updateHomepage({ promiseEyebrow: value });
        } else if (msg.field === "footerWordsLabel") {
          updateHomepage({ footerWordsLabel: value });
        } else if (msg.field === "footerFollowLabel") {
          updateHomepage({ footerFollowLabel: value });
        } else if (msg.field === "footerTrackLabel") {
          updateHomepage({ footerTrackLabel: value });
        } else if (typeof msg.index === "number" && Number.isInteger(msg.index) && msg.index >= 0) {
          // 清單卡片欄位：訊息多帶 index 說是第幾筆。
          // 這個 effect deps 是 []，closure 裡的 theme 是掛載當下的舊值，
          // 所以不能走 updateTestimonial 那些讀 closure theme 的 helper，
          // 要照上面 position-update 分支同款：setTheme functional form 拿最新 state。
          // coalesce key 也對齊側欄同欄位的格式，雙擊改字跟側欄打字共用合併行為。
          const idx = msg.index;
          const patchListText = (
            field: "testimonials" | "faqItems" | "stats" | "gallery",
            key: string,
            // 公開頁 FAQ render 前有先濾掉空問空答，畫面上的第 i 條不一定是
            // 原始清單的第 i 筆；有給 isValid 就把畫面 index 對回原始 index
            isValid?: (item: Record<string, unknown>) => boolean
          ) => {
            setTheme((t) => {
              const list = t.layout[field] as Array<Record<string, unknown>>;
              let real = idx;
              if (isValid) {
                real = -1;
                let seen = -1;
                for (let j = 0; j < list.length; j++) {
                  if (isValid(list[j])) {
                    seen++;
                    if (seen === idx) {
                      real = j;
                      break;
                    }
                  }
                }
              }
              if (real < 0 || real >= list.length) return t;
              pushHistory(t, `layout:${field}:${real}:${key}`);
              const next = [...list];
              next[real] = { ...next[real], [key]: value };
              return { ...t, layout: { ...t.layout, [field]: next } };
            });
            setDirty(true);
          };
          const faqValid = (item: Record<string, unknown>) =>
            String(item.question ?? "").trim() !== "" && String(item.answer ?? "").trim() !== "";
          if (msg.field === "testimonialQuote") {
            patchListText("testimonials", "quote");
          } else if (msg.field === "testimonialAuthor") {
            patchListText("testimonials", "author");
          } else if (msg.field === "testimonialRole") {
            patchListText("testimonials", "role");
          } else if (msg.field === "faqQuestion") {
            patchListText("faqItems", "question", faqValid);
          } else if (msg.field === "faqAnswer") {
            patchListText("faqItems", "answer", faqValid);
          } else if (msg.field === "statValue") {
            patchListText("stats", "value");
          } else if (msg.field === "statLabel") {
            patchListText("stats", "label");
          } else if (msg.field === "galleryCaption") {
            patchListText("gallery", "caption");
          } else if (
            msg.field === "journalCardEyebrow" ||
            msg.field === "journalCardTitle" ||
            msg.field === "journalCardExcerpt"
          ) {
            const key =
              msg.field === "journalCardEyebrow"
                ? "eyebrow"
                : msg.field === "journalCardTitle"
                ? "title"
                : "excerpt";
            setTheme((t) => {
              // 慢讀卡沒存過內容時公開頁顯示預設三張，第一次雙擊改字
              // 要先把預設整組帶進來再改那一格（跟側欄同一招）
              const base =
                t.homepage.journalCards.length > 0
                  ? t.homepage.journalCards
                  : JOURNAL_CARD_DEFAULTS;
              if (idx >= base.length) return t;
              pushHistory(t, `homepage:journalCards:${idx}:${key}`);
              const next = base.map((c) => ({ ...c }));
              next[idx] = { ...next[idx], [key]: value };
              return { ...t, homepage: { ...t.homepage, journalCards: next } };
            });
            setDirty(true);
          } else if (
            msg.field === "collectionCardTitle" ||
            msg.field === "collectionCardSubtitle"
          ) {
            const key = msg.field === "collectionCardTitle" ? "title" : "subtitle";
            setTheme((t) => {
              // 沒存過選物卡時公開頁顯示預設六張，第一次雙擊改字
              // 要先把預設整組帶進來再改那一格（跟慢讀卡同一招）。
              // index 是公開頁濾掉沒圖的卡「之前」的原始位置，直接用不必重對。
              const base =
                t.homepage.collectionItems.length > 0
                  ? t.homepage.collectionItems
                  : COLLECTION_ITEM_DEFAULTS;
              if (idx >= base.length) return t;
              pushHistory(t, `homepage:collectionItems:${idx}:${key}`);
              const next = base.map((c) => ({ ...c }));
              next[idx] = { ...next[idx], [key]: value };
              return { ...t, homepage: { ...t.homepage, collectionItems: next } };
            });
            setDirty(true);
          }
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 滿版 hero 照片的主體邊界：換了照片（或舊店從沒存過）就在這裡偵測一次、存進
  // theme.layout.heroImageBounds。公開頁 SSR 拿到就能直接畫出正確比例，客人第一屏
  // 不用先頂著 2:1 的框等偵測、不會跳。這是系統自己算的不是商家按的，所以直接改
  // theme、不推復原點（不然商家按一下復原退掉的是一個看不見的東西）；只標 dirty 讓
  // auto-save 順手存。同一張圖只試一次：偵測失敗（CORS 拿不到像素）就放著，公開頁
  // 退回客人那邊自己偵測，跟以前一模一樣。
  // 量預覽畫布（iframe）現在的實際寬高。「照片最高佔多少螢幕」那格的上限是用
  // 螢幕高度的百分比算的，畫布多寬多高決定上限會裁到照片哪裡；Hero 面板的預覽框
  // 要標出「裁到這裡」就得知道畫布尺寸。iframe 換裝置（375 / 768 / 100%）、全螢幕
  // 切換、視窗拉大縮小都會變，用 ResizeObserver 跟著量；previewKey 換了 iframe 會
  // 重新掛，得重新觀察。
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setCanvasSize((prev) =>
        prev && prev.w === w && prev.h === h ? prev : w > 0 && h > 0 ? { w, h } : null
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewKey]);

  // 另外記一筆「這張圖現在算到哪」給 Hero 面板顯示：以前偵測失敗完全沒聲音，商家
  // 換了一張外站圖、公開頁第一屏還是跳，卻不知道是這張圖拿不到像素。算好了不用另外
  // 記——theme.layout.heroImageBounds.url 就是現在這張就代表算好了。
  const boundsAttemptRef = useRef<string | null>(null);
  const [boundsStatus, setBoundsStatus] = useState<{
    url: string;
    state: "detecting" | "failed";
  } | null>(null);
  // 「再算一次」按的是這個：把「同一張只試一次」的記號清掉，effect 就會再跑
  const [boundsRetryTick, setBoundsRetryTick] = useState(0);
  useEffect(() => {
    const url = theme.heroUrl;
    if (!url) return;
    if (theme.layout.heroImageBounds?.url === url) return;
    if (boundsAttemptRef.current === url) return;
    boundsAttemptRef.current = url;
    let cancelled = false;
    setBoundsStatus({ url, state: "detecting" });
    detectHeroImageBounds(url).then((b) => {
      if (cancelled) return;
      if (!b) {
        setBoundsStatus({ url, state: "failed" });
        return;
      }
      setBoundsStatus(null);
      setTheme((t) => {
        // 偵測期間商家又換了圖：這筆是舊圖的，丟掉（新圖那輪會自己再跑）
        if (t.heroUrl !== url) return t;
        return { ...t, layout: { ...t.layout, heroImageBounds: b } };
      });
      setDirty(true);
    });
    return () => {
      cancelled = true;
    };
  }, [theme.heroUrl, theme.layout.heroImageBounds, boundsRetryTick]);

  // Auto-save: 改動後 2 秒沒新動作就自動 save（silent，不 reload iframe）
  useEffect(() => {
    if (!dirty || !autoSaveEnabled) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave({ reloadIframe: false });
    }, 2000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, dirty, autoSaveEnabled]);

  // 還有改動沒存好時，關分頁/重整/跳外站前先跳瀏覽器原生「確定要離開？」
  // auto-save 有 2 秒空窗、自動儲存也可以手動關掉，沒這層防護改動會無聲消失
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // Chrome 要設 returnValue 才會跳提示
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Esc 關 floating popover
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 不要 hijack input / textarea — user 在輸入 ? 時不該誤觸
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "Escape") {
        if (showShortcuts) setShowShortcuts(false);
        else if (popover) setPopover(null);
        return;
      }
      if (e.key === "?" && !inField) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      // [ / ] 跳上一段 / 下一段（對齊 right panel 既有 button）
      // 只有 activeTab === "section" 時才生效，避免在 design / pages 等 tab 誤觸
      if ((e.key === "[" || e.key === "]") && !inField && activeTab === "section") {
        e.preventDefault();
        const navOrder: SectionKey[] = [
          "hero",
          ...theme.layout.sectionOrder.filter((k) => k !== "hero"),
        ];
        const idx = navOrder.indexOf(selectedSection);
        if (e.key === "[" && idx > 0) {
          setSelectedSection(navOrder[idx - 1]);
        } else if (e.key === "]" && idx >= 0 && idx < navOrder.length - 1) {
          setSelectedSection(navOrder[idx + 1]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover, showShortcuts, activeTab, selectedSection, theme.layout.sectionOrder]);

  // Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;
      // 不要 hijack input / textarea 內的 native undo
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // 按住 Shift 時 e.key 會變大寫的 "Z"，所以先轉小寫再比 —
      // 否則 Cmd+Shift+Z 重做永遠匹配不到（key 是 "Z" 不是 "z"），按了沒反應。
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  function moveSection(from: number, to: number) {
    if (to < 0 || to >= theme.layout.sectionOrder.length) return;
    const next = [...theme.layout.sectionOrder];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateLayout({ sectionOrder: next });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = theme.layout.sectionOrder.indexOf(active.id as SectionKey);
    const newIdx = theme.layout.sectionOrder.indexOf(over.id as SectionKey);
    if (oldIdx === -1 || newIdx === -1) return;
    updateLayout(
      { sectionOrder: arrayMove(theme.layout.sectionOrder, oldIdx, newIdx) },
      false
    );
  }

  function addBlock(blockKey: SectionKey) {
    if (theme.layout.sectionOrder.includes(blockKey)) return;
    const next = [...theme.layout.sectionOrder];
    // 預設加在 promise 後面（或末端）
    const promiseIdx = next.indexOf("promise");
    if (promiseIdx >= 0) {
      next.splice(promiseIdx + 1, 0, blockKey);
    } else {
      next.push(blockKey);
    }
    updateLayout({ sectionOrder: next }, false);
    setSelectedSection(blockKey);
  }

  function removeBlock(blockKey: SectionKey) {
    updateLayout(
      { sectionOrder: theme.layout.sectionOrder.filter((k) => k !== blockKey) },
      false
    );
    if (selectedSection === blockKey) setSelectedSection("hero");
  }

  function updateTestimonial(idx: number, patch: Partial<Testimonial>) {
    const next = [...theme.layout.testimonials];
    next[idx] = { ...next[idx], ...patch };
    updateLayout(
      { testimonials: next },
      `layout:testimonials:${idx}:` + Object.keys(patch).sort().join(",")
    );
  }
  function addTestimonial() {
    if (theme.layout.testimonials.length >= 6) return;
    updateLayout(
      {
        testimonials: [
          ...theme.layout.testimonials,
          { quote: "", author: "", role: null },
        ],
      },
      false
    );
  }
  function removeTestimonial(idx: number) {
    updateLayout(
      { testimonials: theme.layout.testimonials.filter((_, i) => i !== idx) },
      false
    );
  }

  function updateFaq(idx: number, patch: Partial<FaqItem>) {
    const next = [...theme.layout.faqItems];
    next[idx] = { ...next[idx], ...patch };
    updateLayout(
      { faqItems: next },
      `layout:faqItems:${idx}:` + Object.keys(patch).sort().join(",")
    );
  }
  function addFaq() {
    if (theme.layout.faqItems.length >= 20) return;
    updateLayout(
      { faqItems: [...theme.layout.faqItems, { question: "", answer: "" }] },
      false
    );
  }
  function removeFaq(idx: number) {
    updateLayout(
      { faqItems: theme.layout.faqItems.filter((_, i) => i !== idx) },
      false
    );
  }

  // Stats / Partners / Gallery 通用 list helpers
  function updateListItem<T>(field: "stats" | "partners" | "gallery", idx: number, patch: Partial<T>) {
    const list = theme.layout[field] as T[];
    const next = [...list];
    next[idx] = { ...next[idx], ...patch };
    updateLayout(
      { [field]: next } as Partial<EditorTheme["layout"]>,
      `layout:${field}:${idx}:` + Object.keys(patch).sort().join(",")
    );
  }
  function addListItem(field: "stats" | "partners" | "gallery") {
    const cur = theme.layout[field] as Array<unknown>;
    const max = field === "stats" ? 6 : 12;
    if (cur.length >= max) return;
    const blank: Record<string, unknown> = {
      stats: { value: "", label: "" },
      partners: { name: "", logoUrl: "", href: null },
      gallery: { url: "", caption: null },
    }[field] as Record<string, unknown>;
    updateLayout(
      { [field]: [...cur, blank] } as Partial<EditorTheme["layout"]>,
      false
    );
  }
  function removeListItem(field: "stats" | "partners" | "gallery", idx: number) {
    const cur = theme.layout[field] as Array<unknown>;
    updateLayout(
      { [field]: cur.filter((_, i) => i !== idx) } as Partial<EditorTheme["layout"]>,
      false
    );
  }

  function handleAssetSelected(url: string) {
    if (!assetPickerMode) return;
    if (assetPickerMode.kind === "gallery-add") {
      if (theme.layout.gallery.length >= 12) return;
      updateLayout({
        gallery: [...theme.layout.gallery, { url, caption: null }],
      });
    } else if (assetPickerMode.kind === "gallery-replace") {
      const next = [...theme.layout.gallery];
      next[assetPickerMode.index] = { ...next[assetPickerMode.index], url };
      updateLayout({ gallery: next });
    } else if (assetPickerMode.kind === "partner-logo") {
      const next = [...theme.layout.partners];
      next[assetPickerMode.index] = {
        ...next[assetPickerMode.index],
        logoUrl: url,
      };
      updateLayout({ partners: next });
    } else if (assetPickerMode.kind === "hero") {
      update("heroUrl", url);
    } else if (assetPickerMode.kind === "logo") {
      update("logoUrl", url);
    }
  }

  function handleSave(opts?: { reloadIframe?: boolean; themeOverride?: EditorTheme }) {
    const reload = opts?.reloadIframe ?? true;
    const t = opts?.themeOverride ?? theme;
    startTransition(async () => {
      const res = await saveEditorState(slug, {
        primary: t.primary,
        accent: t.accent,
        tagline: t.tagline,
        heroUrl: t.heroUrl,
        logoUrl: t.logoUrl,
        layout: {
          heroStyle: t.layout.heroStyle,
          heroEyebrow: t.layout.heroEyebrow ?? "",
          heroSubtitle: t.layout.heroSubtitle ?? "",
          heroImageSide: t.layout.heroImageSide,
          sectionOrder: t.layout.sectionOrder,
          testimonials: t.layout.testimonials
            .filter((x) => x.quote.trim() && x.author.trim())
            .map((x) => ({
              quote: x.quote,
              author: x.author,
              role: x.role ?? undefined,
            })),
          faqItems: t.layout.faqItems
            .filter((f) => f.question.trim() && f.answer.trim())
            .map((f) => ({ question: f.question, answer: f.answer })),
          stats: t.layout.stats
            .filter((s) => s.value.trim() && s.label.trim())
            .map((s) => ({ value: s.value, label: s.label })),
          partners: t.layout.partners
            .filter((p) => p.name.trim() && p.logoUrl.trim())
            .map((p) => ({ name: p.name, logoUrl: p.logoUrl, href: p.href })),
          gallery: t.layout.gallery
            .filter((g) => g.url.trim())
            .map((g) => ({ url: g.url, caption: g.caption })),
          mapEmbedUrl: t.layout.mapEmbedUrl,
          // 順手過濾停用世代的殘留 key，第一次存檔就把 DB 裡的垃圾座標掃掉
          freePositions: stripLegacyFreePositions(t.layout.freePositions),
          heroZoom: t.layout.heroZoom,
          heroZoomMobile: t.layout.heroZoomMobile,
          heroZoomTablet: t.layout.heroZoomTablet,
          heroZoomDesktop: t.layout.heroZoomDesktop,
          heroTaglineFontScale: t.layout.heroTaglineFontScale,
          heroTaglineColor: t.layout.heroTaglineColor,
          heroTaglineAlign: t.layout.heroTaglineAlign,
          heroTaglineWeight: t.layout.heroTaglineWeight,
          heroTaglineTracking: t.layout.heroTaglineTracking,
          heroTaglineLeading: t.layout.heroTaglineLeading,
          heroEyebrowFontScale: t.layout.heroEyebrowFontScale,
          heroEyebrowTracking: t.layout.heroEyebrowTracking,
          heroEyebrowColor: t.layout.heroEyebrowColor,
          heroEyebrowCase: t.layout.heroEyebrowCase,
          heroEyebrowWeight: t.layout.heroEyebrowWeight,
          heroSubtitleFontScale: t.layout.heroSubtitleFontScale,
          heroSubtitleColor: t.layout.heroSubtitleColor,
          heroSubtitleAlign: t.layout.heroSubtitleAlign,
          heroSubtitleWeight: t.layout.heroSubtitleWeight,
          heroSubtitleTracking: t.layout.heroSubtitleTracking,
          heroSubtitleLeading: t.layout.heroSubtitleLeading,
          heroCtaFontScale: t.layout.heroCtaFontScale,
          heroCtaTracking: t.layout.heroCtaTracking,
          heroCtaCase: t.layout.heroCtaCase,
          heroCtaWeight: t.layout.heroCtaWeight,
          heroCtaColor: t.layout.heroCtaColor,
          heroBylineFontScale: t.layout.heroBylineFontScale,
          heroBylineColor: t.layout.heroBylineColor,
          heroBylineTracking: t.layout.heroBylineTracking,
          heroBylineCase: t.layout.heroBylineCase,
          heroBylineWeight: t.layout.heroBylineWeight,
          heroSplitRatio: t.layout.heroSplitRatio,
          heroImageFocus: t.layout.heroImageFocus,
          heroImageFocusX: t.layout.heroImageFocusX,
          heroSplitImageFit: t.layout.heroSplitImageFit,
          heroSplitImageAspect: t.layout.heroSplitImageAspect,
          heroSplitTextAlign: t.layout.heroSplitTextAlign,
          heroSplitTextAlignX: t.layout.heroSplitTextAlignX,
          heroSplitTextPadding: t.layout.heroSplitTextPadding,
          heroSplitMobilePadY: t.layout.heroSplitMobilePadY,
          heroSplitGap: t.layout.heroSplitGap,
          heroSplitMobileOrder: t.layout.heroSplitMobileOrder,
          heroSplitHeight: t.layout.heroSplitHeight,
          heroSplitTextBg: t.layout.heroSplitTextBg,
          heroSplitImageBg: t.layout.heroSplitImageBg,
          heroSplitDivider: t.layout.heroSplitDivider,
          heroSplitDividerTone: t.layout.heroSplitDividerTone,
          heroMagazineRuleWeight: t.layout.heroMagazineRuleWeight,
          heroMagazineRuleTone: t.layout.heroMagazineRuleTone,
          heroMagazineGap: t.layout.heroMagazineGap,
          heroMagazineTextWidth: t.layout.heroMagazineTextWidth,
          heroMagazineRuleWidth: t.layout.heroMagazineRuleWidth,
          heroMagazinePadX: t.layout.heroMagazinePadX,
          heroMagazineSubtitleWidth: t.layout.heroMagazineSubtitleWidth,
          heroMagazineTextGap: t.layout.heroMagazineTextGap,
          heroMagazineBg: t.layout.heroMagazineBg,
          heroMinimalWidth: t.layout.heroMinimalWidth,
          heroMinimalPadding: t.layout.heroMinimalPadding,
          heroMinimalPadX: t.layout.heroMinimalPadX,
          heroMinimalRule: t.layout.heroMinimalRule,
          heroMinimalRuleColor: t.layout.heroMinimalRuleColor,
          heroMinimalAlign: t.layout.heroMinimalAlign,
          heroMinimalBg: t.layout.heroMinimalBg,
          heroMinimalGap: t.layout.heroMinimalGap,
          heroTextBg: t.layout.heroTextBg,
          heroTextPadding: t.layout.heroTextPadding,
          heroTextWidth: t.layout.heroTextWidth,
          heroTextAlignX: t.layout.heroTextAlignX,
          heroTextGap: t.layout.heroTextGap,
          heroImageMaxHeight: t.layout.heroImageMaxHeight,
          heroFullImageFit: t.layout.heroFullImageFit,
          heroFullImageBg: t.layout.heroFullImageBg,
          heroImageBounds: t.layout.heroImageBounds,
          heroHeight: t.layout.heroHeight,
          fontScale: t.layout.fontScale,
          sectionPaddingScale: t.layout.sectionPaddingScale,
          buttonRadius: t.layout.buttonRadius,
          footerBg: t.layout.footerBg,
          footerText: t.layout.footerText,
          featuredCount: t.layout.featuredCount,
          featuredColumns: t.layout.featuredColumns,
          collectionsColumns: t.layout.collectionsColumns,
          testimonialsColumns: t.layout.testimonialsColumns,
          statsColumns: t.layout.statsColumns,
          galleryColumns: t.layout.galleryColumns,
          journalColumns: t.layout.journalColumns,
          faqDefaultOpen: t.layout.faqDefaultOpen,
          sectionStyles: t.layout.sectionStyles,
        },
        homepage: t.homepage,
        sections: t.sections,
      });
      if (res && "ok" in res) {
        setDirty(false);
        setSavedAt(Date.now());
        // 只有手動儲存 / 手動 refresh 才 reload iframe。
        // auto-save 與 undo 後的 silent save 不 reload，避免 user 一按就「重新整理」的感覺。
        if (reload) setPreviewKey((k) => k + 1);
      } else {
        alert(res?.error ?? "儲存失敗");
      }
    });
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] bg-stone-50 -mx-8 -mb-16">
      {/* === Top header bar（對標 Wix Studio）=== */}
      <header className="flex items-center justify-between bg-white border-b border-stone-200 px-4 py-2.5 sticky top-0 z-30">
        {/* Left: 返回 + store name + 狀態 */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/dashboard/stores/${slug}`}
            onClick={(e) => {
              // client-side 導覽不會觸發 beforeunload，這裡自己擋
              if (dirty && !window.confirm("還有改動沒存好，現在離開會不見。確定要離開嗎？")) {
                e.preventDefault();
              }
            }}
            className="text-stone-500 hover:text-emerald-900 transition text-sm flex items-center gap-1"
            title="回到店面總覽"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </Link>
          <div className="h-5 w-px bg-stone-200" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-emerald-950 truncate max-w-48">
              {storeName}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                isPublished
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPublished ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {isPublished ? "已發布" : "草稿"}
            </span>
          </div>
        </div>

        {/* Center: undo/redo + viewport switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={undo}
              disabled={pastRef.current.length === 0}
              title="復原 (Cmd+Z)"
              aria-label="復原"
              className="h-9 px-3 rounded-md border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 hover:border-stone-400 active:bg-stone-100 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-stone-300 flex items-center gap-1.5 text-[12.5px] font-medium shadow-sm"
              data-history-tick={historyTick}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 00-15-6.7L3 13" />
              </svg>
              <span>復原</span>
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={futureRef.current.length === 0}
              title="重做 (Cmd+Shift+Z)"
              aria-label="重做"
              className="h-9 px-3 rounded-md border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 hover:border-stone-400 active:bg-stone-100 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-stone-300 flex items-center gap-1.5 text-[12.5px] font-medium shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0115-6.7L21 13" />
              </svg>
              <span>重做</span>
            </button>
          </div>

          <div className="h-5 w-px bg-stone-200" />

          <div className="flex items-center gap-0.5 bg-stone-100 rounded-md p-0.5">
            {(
              [
                { v: "desktop" as const, label: "桌機 1280", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="13" rx="1.5"/><path d="M8 20h8"/><path d="M12 17v3"/></svg> },
                { v: "tablet" as const, label: "平板 768", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18.5" r="0.5" fill="currentColor"/></svg> },
                { v: "mobile" as const, label: "手機 375", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg> },
              ]
            ).map(({ v, label, icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewport(v)}
                aria-pressed={viewport === v}
                className={`w-8 h-8 rounded flex items-center justify-center transition ${
                  viewport === v
                    ? "bg-white text-emerald-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-900"
                }`}
                title={label}
                aria-label={label}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Right: save status + 預覽 + 發佈 */}
        <div className="flex items-center gap-3">
          <span
            className={`text-[11px] hidden sm:inline ${
              pending
                ? "text-emerald-700"
                : dirty
                  ? autoSaveEnabled
                    ? "text-stone-500"
                    : "text-amber-700"
                  : savedAt
                    ? "text-emerald-700"
                    : "text-stone-400"
            }`}
            title={savedAt ? new Date(savedAt).toLocaleString("zh-TW") : ""}
          >
            {pending
              ? "● 儲存中"
              : dirty
                ? autoSaveEnabled
                  ? "● 2 秒後自動存"
                  : "● 未儲存"
                : savedAt
                  ? `● 已存 ${new Date(savedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`
                  : "—"}
          </span>
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            className="rounded-full w-7 h-7 text-xs font-semibold text-stone-500 hover:text-emerald-900 hover:bg-stone-100 border border-stone-200 transition flex items-center justify-center"
            title="鍵盤快捷鍵說明（按 ? 也可）"
            aria-label="鍵盤快捷鍵說明"
          >
            ?
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(!fullscreen)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              fullscreen
                ? "bg-emerald-100 text-emerald-900"
                : "text-emerald-900/80 hover:text-emerald-900 hover:bg-stone-100"
            }`}
            title={fullscreen ? "退出全螢幕（顯示編輯欄）" : "全螢幕預覽（藏編輯欄）"}
          >
            {fullscreen ? "編輯" : "全螢幕"}
          </button>
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-4 py-1.5 text-xs font-medium text-emerald-900/80 hover:text-emerald-900 hover:bg-stone-100 transition"
          >
            預覽 ↗
          </a>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={!dirty || pending}
            className="rounded-full bg-emerald-700 text-white text-xs font-medium px-5 py-1.5 hover:bg-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "儲存中…" : "儲存"}
          </button>
        </div>
      </header>

      {/* === 主編輯區（contextual：右 panel 跟 selectedSection 走，不跟 popover 走） === */}
      <div className={`grid flex-1 overflow-hidden relative ${
        fullscreen
          ? "grid-cols-1"
          : selectedSection
            ? "grid-cols-1 lg:grid-cols-[80px_1fr_320px]"
            : "grid-cols-1 lg:grid-cols-[80px_1fr]"
      }`}>
      {/* === Icon nav（最左；fullscreen 時隱藏）=== */}
      {!fullscreen && (
      <nav className="bg-white border-r border-stone-200 flex flex-col items-center py-4 gap-1">
        {(
          [
            { tab: "section" as const, label: "版面結構", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="5" rx="1"/><rect x="3" y="11" width="18" height="5" rx="1"/><rect x="3" y="19" width="18" height="2" rx="1"/></svg> },
            { tab: "design" as const, label: "視覺風格", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="18.5" cy="11.5" r="2.5"/><circle cx="11.5" cy="16.5" r="2.5"/><circle cx="5.5" cy="11.5" r="2.5"/><path d="M12 22a10 10 0 110-20 10 10 0 010 20z"/></svg> },
            { tab: "content" as const, label: "文案", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
            { tab: "ai" as const, label: "AI 助手", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" /><circle cx="19" cy="5" r="1.5"/><circle cx="6" cy="19" r="1"/></svg> },
          ]
        ).map(({ tab, label, icon }) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setPopover((cur) => (cur === tab ? null : tab));
            }}
            className={`w-12 h-12 rounded-lg flex items-center justify-center transition group relative ${
              popover === tab
                ? "bg-emerald-50 text-emerald-900"
                : "text-stone-500 hover:text-emerald-900 hover:bg-stone-50"
            }`}
            title={label}
            aria-label={label}
          >
            {icon}
            {popover === tab && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-emerald-600 rounded-r" />
            )}
          </button>
        ))}

        <div className="flex-1" />

        {/* AutoSave toggle in bottom of icon nav */}
        <button
          type="button"
          onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
          className={`w-12 h-12 rounded-lg flex items-center justify-center transition text-[10px] ${
            autoSaveEnabled
              ? "text-emerald-700 hover:bg-emerald-50"
              : "text-stone-400 hover:bg-stone-50"
          }`}
          title={autoSaveEnabled ? "自動儲存開啟" : "自動儲存關閉"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </button>
      </nav>
      )}

      {/* === Floating popover sidebar（從 icon nav 滑出）=== */}
      {!fullscreen && popover && (
      <aside
        className="absolute top-0 bottom-0 left-[80px] w-[240px] z-30 bg-white border-r border-stone-200 flex flex-col overflow-y-auto shadow-2xl shadow-stone-300/60"
        style={{ animation: "sproutly-popover-slide 0.25s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <style>{`
          @keyframes sproutly-popover-slide {
            from { opacity: 0; transform: translateX(-12px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>
        <div className="p-4 border-b border-stone-100 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-emerald-950">
            {activeTab === "section"
              ? "版面結構"
              : activeTab === "design"
                ? "視覺風格"
                : activeTab === "ai"
                  ? "AI 助手"
                  : "文案內容"}
          </h2>
          <p className="text-[11px] text-stone-500 mt-0.5">
            {activeTab === "section"
              ? "拖曳排序 / 點選編輯"
              : activeTab === "design"
                ? "色彩 / Logo"
                : activeTab === "ai"
                  ? "用自然語言改設計"
                  : "Tagline / 子頁開關"}
          </p>
          </div>
          <button
            type="button"
            onClick={() => setPopover(null)}
            className="shrink-0 -mt-1 -mr-1 w-7 h-7 rounded hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-900 transition"
            aria-label="關閉"
            title="關閉（Esc）"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {activeTab === "ai" && (
          <EditorAIChat
            theme={{
              primary: theme.primary,
              accent: theme.accent,
              tagline: theme.tagline,
              layout: theme.layout,
              homepage: theme.homepage,
            }}
            onPatch={(patch) => {
              // AI 一個指令常常同時改好幾個欄位（配色 + 文案 + layout）。
              // 若逐欄位走 update()，每個欄位各推一筆復原點，按一次「復原」
              // 只退掉其中一個欄位 — user 看起來就是「復原只復原某些動作」。
              // 所以整包合成一個 theme、只推一筆復原點：復原一次退掉整個 AI 指令。
              const next: EditorTheme = { ...theme };
              let changed = false;
              if (patch.primary) {
                next.primary = patch.primary;
                changed = true;
              }
              if (patch.accent) {
                next.accent = patch.accent;
                changed = true;
              }
              if (patch.tagline !== undefined) {
                next.tagline = patch.tagline;
                changed = true;
              }
              if (patch.layout) {
                const l = patch.layout;
                const patchObj: Partial<EditorTheme["layout"]> = {};
                if (l.heroStyle) patchObj.heroStyle = l.heroStyle as HeroStyle;
                if (l.heroEyebrow !== undefined) patchObj.heroEyebrow = l.heroEyebrow;
                if (l.heroSubtitle !== undefined) patchObj.heroSubtitle = l.heroSubtitle;
                if (l.heroImageSide) patchObj.heroImageSide = l.heroImageSide as "left" | "right";
                if (l.sectionOrder && Array.isArray(l.sectionOrder)) {
                  patchObj.sectionOrder = l.sectionOrder as SectionKey[];
                }
                if (Object.keys(patchObj).length) {
                  next.layout = { ...theme.layout, ...patchObj };
                  changed = true;
                }
              }
              if (patch.homepage) {
                const hpPatch: Partial<EditorTheme["homepage"]> = {};
                if (patch.homepage.promise !== undefined) hpPatch.promise = patch.homepage.promise;
                if (patch.homepage.collectionsIntro !== undefined) hpPatch.collectionsIntro = patch.homepage.collectionsIntro;
                if (patch.homepage.visitTitle !== undefined) hpPatch.visitTitle = patch.homepage.visitTitle;
                if (Object.keys(hpPatch).length) {
                  next.homepage = { ...theme.homepage, ...hpPatch };
                  changed = true;
                }
              }
              if (!changed) return;
              pushHistory(theme); // 不帶 coalesceKey：每個 AI 指令是獨立的一步
              setTheme(next);
              setDirty(true);
            }}
          />
        )}

        {activeTab === "section" && (
          <div className="px-3 pb-3 flex-1 overflow-y-auto border-t border-stone-100 pt-3">
            <p className="px-2 mb-2 text-[10px] tracking-wider uppercase text-emerald-900/45">
              首頁 Sections（拖曳排序）
            </p>
            {mounted ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={theme.layout.sectionOrder}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-1">
                    {theme.layout.sectionOrder.map((key) => {
                      const removable = ADDABLE_BLOCKS.some((b) => b.key === key);
                      return (
                        <SortableSectionItem
                          key={key}
                          sectionKey={key}
                          label={sectionLabels[key]}
                          selected={selectedSection === key}
                          onSelect={() => setSelectedSection(key)}
                          removable={removable}
                          onRemove={removable ? () => removeBlock(key) : undefined}
                        />
                      );
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
            ) : (
              <ul className="space-y-1">
                {theme.layout.sectionOrder.map((key) => (
                  <li
                    key={key}
                    className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-emerald-950 opacity-50"
                  >
                    {sectionLabels[key]}
                  </li>
                ))}
              </ul>
            )}

            {ADDABLE_BLOCKS.filter(
              (b) => !theme.layout.sectionOrder.includes(b.key)
            ).length > 0 && (
              <div className="mt-5 pt-4 border-t border-stone-100">
                <p className="px-2 mb-2 text-[10px] tracking-wider uppercase text-emerald-900/45">
                  + 加新區段
                </p>
                <div className="space-y-1.5">
                  {ADDABLE_BLOCKS.filter(
                    (b) => !theme.layout.sectionOrder.includes(b.key)
                  ).map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => addBlock(b.key)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/50 transition group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-emerald-950 font-medium">
                          {b.label}
                        </span>
                        <span className="text-emerald-700 group-hover:translate-x-0.5 transition text-sm">
                          +
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {b.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </aside>
      )}

      {/* === 中央 canvas: 公開頁 preview === */}
      <main
        className={`bg-stone-100 overflow-hidden flex flex-col ${fullscreen ? "p-0" : "p-4 lg:p-6"}`}
        onClick={() => {
          // 點 canvas 空白處（iframe 外）關閉 popover
          if (popover) setPopover(null);
        }}
      >
        <div className={`flex-1 overflow-hidden bg-white flex flex-col ${fullscreen ? "" : "rounded-xl shadow-lg shadow-stone-200/60 border border-stone-200"}`}>
          {/* Canvas URL bar（簡化、wix-like） */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-stone-200 bg-stone-50">
            <span className="text-[11px] font-mono text-stone-500 truncate">
              sproutly.app/{slug}
            </span>
            <button
              type="button"
              onClick={() => setPreviewKey((k) => k + 1)}
              className="text-xs text-emerald-700 hover:text-emerald-900"
              title="重新載入預覽"
            >
              ↻
            </button>
          </div>

          {/* iframe container - iframe 明確 calc(100vh - header) 高度，避免 h-screen collapse */}
          <div className="flex-1 bg-stone-200/40 overflow-auto p-0 sm:p-4 flex items-start justify-center min-h-0">
            <iframe
              key={previewKey}
              ref={iframeRef}
              src={`/${slug}?edit=1`}
              title="店面預覽"
              className="bg-white border-0 block shadow-md shadow-stone-300/50 transition-[width] duration-500"
              style={{
                width:
                  viewport === "desktop"
                    ? "100%"
                    : viewport === "tablet"
                      ? "768px"
                      : "375px",
                maxWidth: "100%",
                height: fullscreen
                  ? "calc(100vh - 49px)"
                  : "calc(100vh - 49px - 65px - 64px)",
                // 49 = top header height; 65 = dashboard layout 上方店面 chrome 高（非 fullscreen 才扣）; 64 = canvas + url-bar padding
              }}
            />
          </div>
        </div>
      </main>

      {/* === 右 panel: 屬性編輯（contextual：選了 section 才出現，跟 popover 分開）=== */}
      {!fullscreen && selectedSection && (
      <aside className="bg-white border-l border-stone-200 overflow-y-auto relative">
        {/* 關閉按鈕（清除 selectedSection 讓 panel 收回） */}
        <button
          type="button"
          onClick={() => setSelectedSection("hero")}
          className="absolute top-3 right-3 w-7 h-7 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition flex items-center justify-center z-10"
          title="清除選取"
          aria-label="清除選取"
        >
          ×
        </button>
        {/* 上一段 / 下一段 nav — iframe 不用回點，panel 直接穿梭 sections
            完整順序：hero 為首 + sectionOrder（body sections）；可跨「visible / hidden」段（user 可能想跳去 hidden 改回開）*/}
        {activeTab === "section" && selectedSection && (() => {
          const navOrder: SectionKey[] = [
            "hero",
            ...theme.layout.sectionOrder.filter((k) => k !== "hero"),
          ];
          const idx = navOrder.indexOf(selectedSection);
          const prev = idx > 0 ? navOrder[idx - 1] : null;
          const next = idx >= 0 && idx < navOrder.length - 1 ? navOrder[idx + 1] : null;
          return (
            <div className="flex items-center justify-between gap-2 px-3 pt-12 pb-3 border-b border-stone-100">
              <button
                type="button"
                onClick={() => prev && setSelectedSection(prev)}
                disabled={!prev}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                  prev
                    ? "border-stone-200 text-stone-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900"
                    : "border-stone-100 text-stone-300 cursor-not-allowed"
                }`}
                title={prev ? `上一段：${sectionLabels[prev]}（按 [）` : "已經是第一段"}
                aria-label={prev ? `上一段：${sectionLabels[prev]}` : "已經是第一段"}
              >
                <span aria-hidden>←</span>
                <span className="hidden sm:inline">上一段</span>
              </button>
              <div className="flex-1 text-center min-w-0">
                <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-stone-400">
                  Section {idx + 1} / {navOrder.length}
                </p>
                <p className="mt-0.5 text-sm font-medium text-stone-800 truncate">
                  {sectionLabels[selectedSection]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => next && setSelectedSection(next)}
                disabled={!next}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                  next
                    ? "border-stone-200 text-stone-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900"
                    : "border-stone-100 text-stone-300 cursor-not-allowed"
                }`}
                title={next ? `下一段：${sectionLabels[next]}（按 ]）` : "已經是最後一段"}
                aria-label={next ? `下一段：${sectionLabels[next]}` : "已經是最後一段"}
              >
                <span className="hidden sm:inline">下一段</span>
                <span aria-hidden>→</span>
              </button>
            </div>
          );
        })()}
        {activeTab === "section" && selectedSection === "hero" && (
          <PanelSection title="Hero 區段">
            <Field label="樣式">
              <select
                value={theme.layout.heroStyle}
                onChange={(e) =>
                  updateLayout({ heroStyle: e.target.value as HeroStyle })
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                {(["full-image", "split", "minimal", "magazine"] as HeroStyle[]).map(
                  (k) => (
                    <option key={k} value={k}>
                      {HERO_STYLE_LABELS[k]}
                    </option>
                  )
                )}
              </select>
            </Field>
            {/* Hero 圖片 */}
            <Field label="Hero 圖片">
              {theme.heroUrl ? (
                <div className="space-y-2">
                  {(() => {
                    // 滿版版型且主體邊界已經算好：預覽框直接畫成公開頁 banner 會用的
                    // 主體比例（跟 HeroAdaptiveBanner 同一條算式：整檔寬高比 ÷ 主體佔的
                    // 高度比例），照片也對到同一個主體中點。以前這格固定 16:9 裁中央，
                    // 商家在面板看到的框跟客人看到的框不是同一個，直式照片在這裡被
                    // 砍掉上下、橫式照片多露出一截，得開預覽才知道系統框到哪。
                    // 比例夾在 3:4 到 3:1 之間：面板窄，太直的照片會把整欄撐得很長。
                    // 其他版型、還沒算好的照片維持 16:9。
                    const b = theme.layout.heroImageBounds;
                    const subject =
                      theme.layout.heroStyle === "full-image" && b && b.url === theme.heroUrl
                        ? b
                        : null;
                    let aspectRatio: string | undefined;
                    let objectPosition: string | undefined;
                    // 「照片最高佔多少螢幕」設了上限之後，公開頁的框會比主體比例矮，
                    // 可是這格預覽以前只畫主體比例，商家看不出上限會把照片收到哪。
                    // 照現在預覽畫布的寬高算一次（跟 HeroAdaptiveBanner 同一套：框寬 ÷
                    // 主體比例 = 沒上限時的高度，超過畫布高度 × 上限比例才會被收）：
                    //   裁上下  → 在預覽框上下各壓一層暗色，暗掉的就是客人第一屏看不到的，
                    //             分法照主體中點（object-position 就是這樣切的）
                    //   整張顯示 → 預覽框改畫成收過上限的那個框（畫布寬 ÷ 上限高），主體
                    //             縮在中間，左右露出框底色，就是客人會看到的樣子
                    // 沒設上限、沒被收到、畫布還沒量到、比例被夾過（太直的照片預覽框本
                    // 來就不是完整主體）都不畫，跟以前一樣。
                    let capTopPct: number | null = null;
                    let capBottomPct: number | null = null;
                    let capCroppedPct: number | null = null;
                    let containFrame: { aspectRatio: string; innerWidthPct: number } | null = null;
                    if (subject) {
                      const contentH = subject.bottomPct - subject.topPct;
                      const mid = (subject.topPct + subject.bottomPct) / 2;
                      const ar = subject.fileAspect / (contentH / 100);
                      const clamped = Math.min(3, Math.max(0.75, ar));
                      aspectRatio = String(clamped);
                      objectPosition = `50% ${mid.toFixed(2)}%`;
                      const capRatio =
                        theme.layout.heroImageMaxHeight === "screen"
                          ? 1
                          : theme.layout.heroImageMaxHeight === "short"
                            ? 0.68
                            : null;
                      if (capRatio !== null && canvasSize && clamped === ar) {
                        const bannerH = canvasSize.w / ar;
                        const capH = canvasSize.h * capRatio;
                        if (bannerH > capH + 0.5) {
                          const visible = capH / bannerH; // 0-1，上限留下來的那一截
                          capCroppedPct = Math.round((1 - visible) * 100);
                          if (theme.layout.heroFullImageFit === "contain") {
                            containFrame = {
                              aspectRatio: String(
                                Math.min(3, Math.max(0.75, canvasSize.w / capH))
                              ),
                              innerWidthPct: visible * 100,
                            };
                          } else {
                            capTopPct = (mid / 100) * (1 - visible) * 100;
                            capBottomPct = capTopPct + visible * 100;
                          }
                        }
                      }
                    }
                    const canvasLabel =
                      viewport === "mobile"
                        ? "手機 375 寬"
                        : viewport === "tablet"
                          ? "平板 768 寬"
                          : "桌機";
                    if (containFrame) {
                      return (
                        <div className="space-y-1">
                          <div
                            className="relative rounded-lg overflow-hidden border border-stone-200"
                            style={{
                              aspectRatio: containFrame.aspectRatio,
                              backgroundColor: theme.layout.heroFullImageBg ?? theme.bg,
                            }}
                          >
                            <div
                              className="absolute inset-y-0 left-1/2 -translate-x-1/2"
                              style={{ width: `${containFrame.innerWidthPct}%` }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={theme.heroUrl}
                                alt="Hero"
                                className="w-full h-full object-cover"
                                style={objectPosition ? { objectPosition } : undefined}
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-stone-500">
                            照現在的預覽畫布（{canvasLabel}）算，這張照片會被上限收掉約 {capCroppedPct}%
                            的高度；選了整張顯示，主體整個縮進框裡、左右露出框底色，上面就是客人第一屏看到的樣子。換裝置或客人的螢幕比例不同，露出的多少會跟著變
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-1">
                        <div
                          className={`relative rounded-lg overflow-hidden bg-stone-100 border border-stone-200 ${
                            subject ? "" : "aspect-video"
                          }`}
                          style={subject ? { aspectRatio } : undefined}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={theme.heroUrl}
                            alt="Hero"
                            className="w-full h-full object-cover"
                            style={objectPosition ? { objectPosition } : undefined}
                          />
                          {capTopPct !== null && capBottomPct !== null && (
                            <>
                              <div
                                className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-white/90 bg-stone-900/55"
                                style={{ height: `${capTopPct}%` }}
                              />
                              <div
                                className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-white/90 bg-stone-900/55"
                                style={{ height: `${100 - capBottomPct}%` }}
                              />
                              <span
                                className="pointer-events-none absolute left-1.5 rounded bg-white/90 px-1 py-0.5 text-[9px] leading-none text-stone-700"
                                style={{ top: `calc(${capTopPct}% + 4px)` }}
                              >
                                上限裁到這裡
                              </span>
                            </>
                          )}
                        </div>
                        {capCroppedPct !== null && (
                          <p className="text-[10px] text-stone-500">
                            照現在的預覽畫布（{canvasLabel}）算，這張照片會被上限收掉約 {capCroppedPct}%
                            的高度，暗掉的部分客人第一屏看不到（照主體中點分上下）。換裝置或客人的螢幕比例不同，裁的多少會跟著變；不想裁可以在下面「照片完整度」選整張顯示
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAssetPickerMode({ kind: "hero" })}
                      className="flex-1 rounded-lg bg-emerald-700 text-white text-xs py-2 hover:bg-emerald-800 transition"
                    >
                      ✦ 換一張
                    </button>
                    <button
                      type="button"
                      onClick={() => update("heroUrl", null)}
                      className="rounded-lg border border-stone-200 text-stone-600 text-xs px-3 hover:bg-stone-50 transition"
                      title="移除 hero 圖（minimal 樣式不需要）"
                    >
                      移除
                    </button>
                  </div>
                  {/* 滿版版型會先算這張照片的主體邊界存起來（客人第一屏才不會跳）。
                      算中、算好、算不出來各講一句，不然商家換了外站圖公開頁還是跳，
                      卻不知道是這張圖拿不到像素 */}
                  {theme.layout.heroStyle === "full-image" &&
                    (() => {
                      const url = theme.heroUrl;
                      const ready = theme.layout.heroImageBounds?.url === url;
                      const st =
                        boundsStatus && boundsStatus.url === url ? boundsStatus.state : null;
                      if (ready) {
                        return (
                          <p className="text-[10px] text-stone-500">
                            這張照片的比例已經算好，上面的預覽框就是客人第一屏看到的範圍，不會跳
                          </p>
                        );
                      }
                      if (st === "failed") {
                        return (
                          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                            <p className="flex-1 text-[10px] leading-relaxed text-amber-900">
                              這張照片的比例還沒算好：圖是從別的網站拿的，瀏覽器不讓我們讀它的
                              像素。店面照樣能開，只是客人第一屏會等照片載完才長成該有的高度、
                              會跳一下。把圖上傳到圖庫再挑一次就能算
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                boundsAttemptRef.current = null;
                                setBoundsRetryTick((n) => n + 1);
                              }}
                              className="shrink-0 rounded border border-amber-300 px-2 py-1 text-[10px] text-amber-900 hover:bg-amber-100 transition"
                            >
                              再算一次
                            </button>
                          </div>
                        );
                      }
                      return (
                        <p className="text-[10px] text-stone-500">
                          {st === "detecting"
                            ? "正在算這張照片的比例⋯"
                            : "這張照片的比例還沒算，開著編輯器就會自己算"}
                        </p>
                      );
                    })()}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAssetPickerMode({ kind: "hero" })}
                  className="w-full aspect-video rounded-lg border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/30 transition flex flex-col items-center justify-center text-stone-500"
                >
                  <span className="text-2xl mb-1">✦</span>
                  <span className="text-xs">從圖庫挑張 Hero 圖</span>
                </button>
              )}
            </Field>
            <Field label="Eyebrow（小標）">
              <input
                type="text"
                value={theme.layout.heroEyebrow ?? ""}
                onChange={(e) => updateLayout({ heroEyebrow: e.target.value })}
                placeholder="Est. 2019 / Issue 03..."
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label={`小標字體大小（${theme.layout.heroEyebrowFontScale.toFixed(2)}x）`}>
              <input
                type="range"
                min={HERO_FONT_SCALE_MIN}
                max={HERO_FONT_SCALE_MAX}
                step="0.05"
                value={theme.layout.heroEyebrowFontScale}
                onChange={(e) =>
                  updateLayout({ heroEyebrowFontScale: parseFloat(e.target.value) })
                }
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>小</span>
                <span>標準 1.0x</span>
                <span>大</span>
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                四種版型都會套用。原本一律 10px，那是照英文大寫字挑的——中文小標在 10px
                上只剩一團墨，手機看更明顯
              </p>
            </Field>
            <Field label="小標字距">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "tight", label: "收緊" },
                  { v: "normal", label: "預設" },
                  { v: "wide", label: "撐開" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroEyebrowTracking: opt.v })}
                    aria-pressed={theme.layout.heroEyebrowTracking === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroEyebrowTracking === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                    style={{
                      letterSpacing:
                        opt.v === "tight" ? "0.05em" : opt.v === "wide" ? "0.3em" : "0.18em",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                原本每個字之間空 0.4em，那是給英文全大寫用的；中文方塊字本來就自帶留白，
                四個字的小標會散成四個不相干的字，選收緊會靠回來
              </p>
            </Field>
            <Field label="小標顏色">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.layout.heroEyebrowColor ?? theme.accent}
                  onChange={(e) => updateLayout({ heroEyebrowColor: e.target.value })}
                  className="h-8 w-12 rounded border border-stone-200"
                />
                <input
                  type="text"
                  value={theme.layout.heroEyebrowColor ?? ""}
                  onChange={(e) =>
                    updateLayout({ heroEyebrowColor: e.target.value || null })
                  }
                  placeholder="預設用主色"
                  className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                />
                {theme.layout.heroEyebrowColor && (
                  <button
                    type="button"
                    onClick={() => updateLayout({ heroEyebrowColor: null })}
                    className="text-xs text-stone-500 hover:text-stone-800 underline"
                  >
                    清除
                  </button>
                )}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                原本用店的主色，那是整頁最搶眼的顏色押在最小的一行字上，壓在照片上容易糊；
                雜誌版型原本用淡文字色，設了以後兩種版型一起走這個色
              </p>
            </Field>
            <Field label="小標大小寫">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "upper", label: "全大寫", tt: "uppercase" },
                  { v: "capitalize", label: "字首大寫", tt: "capitalize" },
                  { v: "none", label: "照原樣", tt: "none" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroEyebrowCase: opt.v })}
                    aria-pressed={theme.layout.heroEyebrowCase === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroEyebrowCase === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                小標打中文的話這格沒有作用（中文沒有大小寫）。打英文才看得出來：原本一律轉成
                全大寫，「Est. 2019」會變 EST. 2019、英文店名也會被拉大寫，選照原樣就照你打的顯示
              </p>
            </Field>
            <Field label="小標粗細">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "normal", label: "原樣" },
                  { v: "medium", label: "稍重" },
                  { v: "bold", label: "重" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroEyebrowWeight: opt.v })}
                    aria-pressed={theme.layout.heroEyebrowWeight === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroEyebrowWeight === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                客人由上往下讀到的第一行字有多重。它原本是全站最小的字級配最鬆的字距再配最輕的
                字重，三個往淡的方向疊在一起，壓在照片上就像浮在圖上的一排灰點。想讓它讀得出來，
                上面只有拉深顏色（那行字會變成跟主標搶的一塊深色）或放大字級（一放大就不是小標
                是第二個標題）兩條路，這格是「一樣小、一樣淡，但看得出是一行字」
              </p>
            </Field>
            <Field label="Tagline（主標）">
              <textarea
                value={theme.tagline}
                onChange={(e) => update("tagline", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none"
              />
            </Field>
            <Field label="副標 / 引文">
              <textarea
                value={theme.layout.heroSubtitle ?? ""}
                onChange={(e) => updateLayout({ heroSubtitle: e.target.value })}
                rows={2}
                placeholder="主標下面那行說明，四種版型都會顯示"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none"
              />
            </Field>
            {(
              <>
                <Field label={`副標字體大小（${theme.layout.heroSubtitleFontScale.toFixed(2)}x）`}>
                  <input
                    type="range"
                    min={HERO_FONT_SCALE_MIN}
                    max={HERO_FONT_SCALE_MAX}
                    step="0.05"
                    value={theme.layout.heroSubtitleFontScale}
                    onChange={(e) => updateLayout({ heroSubtitleFontScale: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-stone-500">
                    <span>小</span>
                    <span>標準 1.0x</span>
                    <span>大</span>
                  </div>
                </Field>
                <Field label="副標顏色">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.layout.heroSubtitleColor ?? "#6B6B6B"}
                      onChange={(e) => updateLayout({ heroSubtitleColor: e.target.value })}
                      className="h-8 w-12 rounded border border-stone-200"
                    />
                    <input
                      type="text"
                      value={theme.layout.heroSubtitleColor ?? ""}
                      onChange={(e) => updateLayout({ heroSubtitleColor: e.target.value || null })}
                      placeholder="預設用淡文字色"
                      className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                    />
                    {theme.layout.heroSubtitleColor && (
                      <button
                        type="button"
                        onClick={() => updateLayout({ heroSubtitleColor: null })}
                        className="text-xs text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
                <Field label="副標對齊">
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { v: "inherit", label: "預設" },
                      { v: "left", label: "左" },
                      { v: "center", label: "置中" },
                      { v: "right", label: "右" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => updateLayout({ heroSubtitleAlign: opt.v })}
                        aria-pressed={theme.layout.heroSubtitleAlign === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          theme.layout.heroSubtitleAlign === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    預設跟版型走（Split 靠左 / Magazine · Minimal 置中 / 滿版圖跟主標）
                  </p>
                </Field>
                <Field label="副標粗細">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "normal", label: "常規" },
                      { v: "medium", label: "中黑" },
                      { v: "bold", label: "粗" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => updateLayout({ heroSubtitleWeight: opt.v })}
                        aria-pressed={theme.layout.heroSubtitleWeight === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          theme.layout.heroSubtitleWeight === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                        style={{
                          fontWeight:
                            opt.v === "bold" ? 700 : opt.v === "medium" ? 500 : undefined,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    四種版型都會套用。副標壓在 hero 照片上時，淡文字色配常規字重讀起來很吃力，
                    加一點重量比把顏色調深不傷版面
                  </p>
                </Field>
                <Field label="副標字距">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "tight", label: "收緊" },
                      { v: "normal", label: "預設" },
                      { v: "wide", label: "撐開" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => updateLayout({ heroSubtitleTracking: opt.v })}
                        aria-pressed={theme.layout.heroSubtitleTracking === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          theme.layout.heroSubtitleTracking === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                        style={{
                          letterSpacing:
                            opt.v === "tight" ? "-0.02em" : opt.v === "wide" ? "0.06em" : undefined,
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    雜誌 / 極簡版型的副標是斜體引文，撐開字距會更像引文、更不像一般內文
                  </p>
                </Field>
                <Field label="副標行距">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "tight", label: "收緊" },
                      { v: "normal", label: "預設" },
                      { v: "relaxed", label: "舒展" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => updateLayout({ heroSubtitleLeading: opt.v })}
                        aria-pressed={theme.layout.heroSubtitleLeading === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          theme.layout.heroSubtitleLeading === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1">
                    四種版型的副標原本都用內文段落的行距，套在只有兩三行的副標上偏鬆，
                    那幾行會散開成一整塊灰色反而搶了主標。收緊會讓副標更像主標底下的一句話
                  </p>
                </Field>
              </>
            )}
            <Field label="按鈕文字">
              <input
                type="text"
                value={theme.homepage.heroCta}
                onChange={(e) =>
                  updateHomepage({ heroCta: e.target.value })
                }
                placeholder="看商品"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-stone-500 mt-1">
                Hero 區段大按鈕的文字，預設「看商品」
              </p>
            </Field>
            <Field label="次要按鈕文字">
              <input
                type="text"
                value={theme.homepage.heroSecondaryCta}
                onChange={(e) =>
                  updateHomepage({ heroSecondaryCta: e.target.value })
                }
                placeholder="關於我們"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-stone-500 mt-1">
                Split 版型 Hero 區段的次要按鈕（連到關於頁），預設「關於我們」
              </p>
            </Field>
            <Field label={`按鈕文字大小（${theme.layout.heroCtaFontScale.toFixed(2)}x）`}>
              <input
                type="range"
                min={HERO_FONT_SCALE_MIN}
                max={HERO_FONT_SCALE_MAX}
                step="0.05"
                value={theme.layout.heroCtaFontScale}
                onChange={(e) => updateLayout({ heroCtaFontScale: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>小</span>
                <span>標準 1.0x</span>
                <span>大</span>
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                四種版型的按鈕（含次要按鈕）一起套。按鈕是 hero 上唯一可以按的東西，
                但原本的字級固定不動——主標拉大之後，按鈕會被主標壓成最不起眼的一行；
                雜誌版型那條更小（跟下面 byline 同一個字級），手機上不容易看出來可以按。
                放大時按鈕的內距會跟著長，形狀不會被字撐爆
              </p>
            </Field>
            <Field label="按鈕字距">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "tight", label: "收緊" },
                  { v: "normal", label: "預設" },
                  { v: "wide", label: "撐開" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroCtaTracking: opt.v })}
                    aria-pressed={theme.layout.heroCtaTracking === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroCtaTracking === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                按鈕上每個字之間的空隙。原本空 0.18em，那是給英文全大寫用的；中文的
                「立即選購」四個字會散開，而且上面那格把字放大以後空隙也跟著變大，散得更開。
                選收緊會靠回來
              </p>
            </Field>
            <Field label="按鈕大小寫">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "default", label: "照版型預設" },
                  { v: "capitalize", label: "字首大寫" },
                  { v: "none", label: "照原樣" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroCtaCase: opt.v })}
                    aria-pressed={theme.layout.heroCtaCase === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroCtaCase === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                按鈕打中文的話這格沒有作用（中文沒有大小寫）。打英文才看得出來：左右分割、
                極簡、雜誌三種版型會把按鈕字一律轉成全大寫，「Shop Now」變 SHOP NOW，
                選照原樣就照你打的顯示（全屏沉浸那顆本來就沒轉，維持原樣）
              </p>
            </Field>
            <Field label="按鈕粗細">
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { v: "default", label: "照版型預設" },
                  { v: "normal", label: "細" },
                  { v: "medium", label: "中" },
                  { v: "bold", label: "粗" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroCtaWeight: opt.v })}
                    aria-pressed={theme.layout.heroCtaWeight === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroCtaWeight === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                按鈕文字有多重。原本兩種：實心／描邊那種按鈕是中等，帶底線的連結型是
                跟內文一樣細——連結型的字放大之後容易看起來像一行普通的字，加粗會更像
                可以按的；反過來整個 hero 走輕盈路線時，也可以把按鈕退細一點
              </p>
            </Field>
            <Field label="按鈕顏色">
              <div className="flex items-center gap-2">
                {/* 取色器需要一個具體的 hex 當初始值；沒設的時候公開頁走的還是各版型
                    原本的顏色（連結型跟主標同色、實心那種是全站文字色反白） */}
                <input
                  type="color"
                  value={theme.layout.heroCtaColor ?? theme.accent}
                  onChange={(e) => updateLayout({ heroCtaColor: e.target.value })}
                  className="h-8 w-12 rounded border border-stone-200"
                />
                <input
                  type="text"
                  value={theme.layout.heroCtaColor ?? ""}
                  onChange={(e) =>
                    updateLayout({ heroCtaColor: e.target.value || null })
                  }
                  placeholder="預設用版型原本的顏色"
                  className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                />
                {theme.layout.heroCtaColor && (
                  <button
                    type="button"
                    onClick={() => updateLayout({ heroCtaColor: null })}
                    className="text-xs text-stone-500 hover:text-stone-800 underline"
                  >
                    清除
                  </button>
                )}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                前面幾格只能把按鈕的字弄大弄粗，弄到最後那顆還是跟主標同一個顏色。
                挑一個顏色就整顆換掉：帶底線的連結型換的是字（底線跟著換），
                實心那種換的是底色、上面的字會自動挑讀得清楚的那個，
                描邊那種換的是框線跟字
              </p>
            </Field>
            <Field label="雜誌版型下方 byline">
              <input
                type="text"
                value={theme.homepage.heroMagazineByline}
                onChange={(e) =>
                  updateHomepage({ heroMagazineByline: e.target.value })
                }
                placeholder={`Curated by 店名`}
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-stone-500 mt-1">
                Magazine 版型 Hero 底部那行小字，預設「Curated by 店名」
              </p>
            </Field>
            <Field label={`byline 文字大小（${theme.layout.heroBylineFontScale.toFixed(2)}x）`}>
              <input
                type="range"
                min={HERO_FONT_SCALE_MIN}
                max={HERO_FONT_SCALE_MAX}
                step="0.05"
                value={theme.layout.heroBylineFontScale}
                onChange={(e) =>
                  updateLayout({ heroBylineFontScale: parseFloat(e.target.value) })
                }
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>小</span>
                <span>標準 1.0x</span>
                <span>大</span>
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                只動上面那行 byline，右邊的按鈕不跟（按鈕有自己的那格）。原本固定 10px，
                那個大小是照英文大寫字母挑的，byline 打中文的話在 10px 幾乎糊成一團，
                而全網站字級那格也動不到它
              </p>
            </Field>
            <Field label="byline 顏色">
              <div className="flex items-center gap-2">
                {/* 取色器需要一個具體的 hex 當初始值（EditorTheme 沒帶 textMuted）；
                    沒設的時候公開頁走的還是各 preset 自己的淡文字色 */}
                <input
                  type="color"
                  value={theme.layout.heroBylineColor ?? "#6B6B6B"}
                  onChange={(e) => updateLayout({ heroBylineColor: e.target.value })}
                  className="h-8 w-12 rounded border border-stone-200"
                />
                <input
                  type="text"
                  value={theme.layout.heroBylineColor ?? ""}
                  onChange={(e) =>
                    updateLayout({ heroBylineColor: e.target.value || null })
                  }
                  placeholder="預設用淡文字色"
                  className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                />
                {theme.layout.heroBylineColor && (
                  <button
                    type="button"
                    onClick={() => updateLayout({ heroBylineColor: null })}
                    className="text-xs text-stone-500 hover:text-stone-800 underline"
                  >
                    清除
                  </button>
                )}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                原本用淡文字色，是整個雜誌版型最淡的一行。想讓它退成純裝飾、或反過來讓
                客人讀得清楚都從這裡調，右邊的按鈕不跟
              </p>
            </Field>
            <Field label="byline 字距">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "tight", label: "收緊" },
                  { v: "normal", label: "預設" },
                  { v: "wide", label: "撐開" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroBylineTracking: opt.v })}
                    aria-pressed={theme.layout.heroBylineTracking === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroBylineTracking === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                那行 byline 每個字之間的空隙，原本空 0.32em、是全站最寬的一格。那個寬度
                跟 10px 一樣是照英文全大寫挑的，byline 打中文（「由 XX 選件」）七八個字會
                散成七八個不相干的字，而上面那格把字放大以後空隙也跟著等比例變大、散得更開。
                選收緊會靠回來，右邊的按鈕不跟
              </p>
            </Field>
            <Field label="byline 大小寫">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "upper", label: "全大寫" },
                  { v: "capitalize", label: "字首大寫" },
                  { v: "none", label: "照原樣" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroBylineCase: opt.v })}
                    aria-pressed={theme.layout.heroBylineCase === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroBylineCase === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                byline 打中文的話這格沒有作用（中文沒有大小寫）。打英文才看得出來：那行字
                一律被轉成全大寫，「Photography by Wang」變 PHOTOGRAPHY BY WANG，打 IG
                帳號也會被改掉。選照原樣就照你打的顯示（改上面輸入框的字沒有用，大寫是
                顯示的時候才轉的），右邊的按鈕不跟
              </p>
            </Field>
            <Field label="byline 粗細">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "normal", label: "原樣" },
                  { v: "medium", label: "稍重" },
                  { v: "bold", label: "重" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroBylineWeight: opt.v })}
                    aria-pressed={theme.layout.heroBylineWeight === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroBylineWeight === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                那行字有多重。原本跟內文一樣輕，是整個版面最不明顯的一行——想讓客人真的
                讀到它，上面的顏色那格只能拉深，拉深了又會跟同一行的其他字打架。這格是
                「一樣的淡，但看得出是一行字」。反過來當落款用的話，選稍重配收緊的字距，
                那幾個字會結成一塊像印章。右邊的按鈕不跟
              </p>
            </Field>
            <Field label={`主標字體大小（${theme.layout.heroTaglineFontScale.toFixed(2)}x）`}>
              <input
                type="range"
                min={HERO_FONT_SCALE_MIN}
                max={HERO_FONT_SCALE_MAX}
                step="0.05"
                value={theme.layout.heroTaglineFontScale}
                onChange={(e) => updateLayout({ heroTaglineFontScale: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>小</span>
                <span>標準 1.0x</span>
                <span>大</span>
              </div>
            </Field>
            <Field label="主標顏色">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.layout.heroTaglineColor ?? "#1A1A1A"}
                  onChange={(e) => updateLayout({ heroTaglineColor: e.target.value })}
                  className="h-8 w-12 rounded border border-stone-200"
                />
                <input
                  type="text"
                  value={theme.layout.heroTaglineColor ?? ""}
                  onChange={(e) => updateLayout({ heroTaglineColor: e.target.value || null })}
                  placeholder="預設用文字色"
                  className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                />
                {theme.layout.heroTaglineColor && (
                  <button
                    type="button"
                    onClick={() => updateLayout({ heroTaglineColor: null })}
                    className="text-xs text-stone-500 hover:text-stone-800 underline"
                  >
                    清除
                  </button>
                )}
              </div>
            </Field>
            <Field label="主標對齊">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "left", label: "左" },
                  { v: "center", label: "置中" },
                  { v: "right", label: "右" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroTaglineAlign: opt.v })}
                    aria-pressed={theme.layout.heroTaglineAlign === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroTaglineAlign === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                對齊只有「整版圖片」版型會套用；其他版型的主標位置是版型設計的一部分，先跟著版型走
              </p>
            </Field>
            <Field label="主標粗細">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "normal", label: "常規" },
                  { v: "medium", label: "中黑" },
                  { v: "bold", label: "粗" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroTaglineWeight: opt.v })}
                    aria-pressed={theme.layout.heroTaglineWeight === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroTaglineWeight === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                四種版型都會套用。字最大的那一句原本一律是最輕的常規，短主標容易撐不起整頁
              </p>
            </Field>
            <Field label="主標字距">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "tight", label: "收緊" },
                  { v: "normal", label: "預設" },
                  { v: "wide", label: "撐開" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroTaglineTracking: opt.v })}
                    aria-pressed={theme.layout.heroTaglineTracking === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroTaglineTracking === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                    style={{
                      letterSpacing:
                        opt.v === "tight" ? "-0.05em" : opt.v === "wide" ? "0.08em" : undefined,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                同一行裡字跟字之間的距離。四種版型原本的字距都是照英文主標調的，中文主標的
                筆畫會黏在一起，選撐開拉開；主標只有四五個字時撐開也能把那一行拉滿版面
              </p>
            </Field>
            <Field label="主標行距">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "tight", label: "收緊" },
                  { v: "normal", label: "預設" },
                  { v: "relaxed", label: "舒展" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroTaglineLeading: opt.v })}
                    aria-pressed={theme.layout.heroTaglineLeading === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroTaglineLeading === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                上下兩行之間隔多遠（字距是左右、行距是上下）。中文沒有空格，一句十幾個字的
                標語在手機上會直接斷成三行；四種版型原本的行距是照英文主標挑的，中文方塊字
                排起來上下容易貼太近，選舒展分開。收緊則是把換行的主標收成一整塊
              </p>
            </Field>
            <Field label="Hero 高度">
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { v: "auto", label: "自適應", hint: "跟著照片比例" },
                  { v: "short", label: "矮", hint: "60vh" },
                  { v: "tall", label: "高", hint: "80vh" },
                  { v: "full", label: "全屏", hint: "100vh" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ heroHeight: opt.v })}
                    aria-pressed={theme.layout.heroHeight === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.heroHeight === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                    title={opt.hint}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">
                高度只有「整版圖片」版型會套用；其他版型的高度是版型設計的一部分，先跟著版型走
              </p>
            </Field>
            {theme.layout.heroStyle === "full-image" && (() => {
              // Per-viewport zoom：依當前預覽裝置決定編哪個欄位
              const zoomKey =
                viewport === "mobile"
                  ? ("heroZoomMobile" as const)
                  : viewport === "tablet"
                  ? ("heroZoomTablet" as const)
                  : ("heroZoomDesktop" as const);
              const zoomValue = theme.layout[zoomKey];
              const viewportLabel =
                viewport === "mobile" ? "手機" : viewport === "tablet" ? "平板" : "桌機";
              return (
                <Field label={`圖片縮放（${viewportLabel}）`}>
                  <div className="space-y-1.5">
                    <input
                      type="range"
                      min={HERO_ZOOM_MIN}
                      max={HERO_ZOOM_MAX}
                      step="0.05"
                      value={zoomValue}
                      onChange={(e) =>
                        updateLayout({ [zoomKey]: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-stone-500">
                      <span>{HERO_ZOOM_MIN.toFixed(1)}x（原始）</span>
                      <span>{zoomValue.toFixed(2)}x</span>
                      <span>{HERO_ZOOM_MAX.toFixed(1)}x</span>
                    </div>
                    <p className="text-[10px] text-stone-500 leading-relaxed pt-1">
                      手機 / 平板 / 桌機 各自一個值。切上面預覽裝置調對應的。
                      <br />
                      手機 {theme.layout.heroZoomMobile.toFixed(2)}x · 平板 {theme.layout.heroZoomTablet.toFixed(2)}x · 桌機 {theme.layout.heroZoomDesktop.toFixed(2)}x
                    </p>
                  </div>
                </Field>
              );
            })()}
            {theme.layout.heroStyle === "full-image" && (
              <Field label="Free Positioning（Phase 5）">
                {(() => {
                  // 主標 / 副標 / 按鈕 / 小標各自一個 key，哪個拖過就列哪個的重設
                  const dragables = [
                    { key: FREE_POS_KEYS.heroTagline, label: "主標" },
                    { key: FREE_POS_KEYS.heroSubtitle, label: "副標" },
                    { key: FREE_POS_KEYS.heroCta, label: "按鈕" },
                    { key: FREE_POS_KEYS.heroEyebrow, label: "小標" },
                  ];
                  const dragged = dragables.filter(
                    (d) => theme.layout.freePositions[d.key]
                  );
                  if (dragged.length > 0) {
                    return (
                      <div className="space-y-3">
                        {dragged.map(({ key, label }) => {
                          const pos = theme.layout.freePositions[key];
                          return (
                            <div key={key} className="space-y-2">
                              <p className="text-[11px] text-stone-600">
                                {label}自訂位置：X={Math.round(pos.x * 100)}% Y={Math.round(pos.y * 100)}%
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const { [key]: _, ...rest } =
                                    theme.layout.freePositions;
                                  updateLayout({ freePositions: rest });
                                }}
                                className="w-full rounded-lg border border-stone-200 text-stone-700 text-xs py-2 hover:bg-stone-50 transition"
                              >
                                {label}重設為預設位置
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  return (
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      在預覽內拖主標、副標、按鈕或小標到任何位置 → 自動儲存位置。
                    </p>
                  );
                })()}
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="圖位置">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateLayout({ heroImageSide: "left" })}
                    className={`px-3 py-2 rounded-lg text-sm border transition ${
                      theme.layout.heroImageSide === "left"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    圖在左
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLayout({ heroImageSide: "right" })}
                    className={`px-3 py-2 rounded-lg text-sm border transition ${
                      theme.layout.heroImageSide === "right"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    圖在右
                  </button>
                </div>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="圖文比例">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "image-narrow", label: "圖窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "image-wide", label: "圖寬" },
                    { v: "photo", label: "跟照片" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitRatio: opt.v })}
                      aria-pressed={theme.layout.heroSplitRatio === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitRatio === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  圖跟文字各占多寬。原本剛好一半一半，那個比例是配「方形的圖 + 一行主標」
                  的——放直式商品照的話左右兩邊會被裁掉一大塊，選圖寬（六成）就少裁一點；
                  反過來主標長、又有副標跟兩顆按鈕的話，文字那半會擠到一直換行，選圖窄
                  （四成）把空間讓給字。「跟照片」是圖那欄的寬度直接照這張照片的比例算
                  （欄有多高、照片就配多寬），照片剛好放滿整欄，鋪滿不會裁、整張顯示也不會
                  左右露出框底色；欄寬會收在整段的三成到六成半之間。「這一段有多高」選跟著
                  內容時反過來：欄寬維持一半，整段的高度照這張照片撐出來。手機上是圖在上文字
                  在下的單欄，這格只影響平板以上
                </p>
                {theme.layout.heroSplitRatio === "photo" &&
                  theme.heroUrl &&
                  theme.layout.heroImageBounds?.url !== theme.heroUrl && (
                    <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-1.5">
                      {boundsStatus?.url === theme.heroUrl && boundsStatus.state === "detecting"
                        ? "正在算這張照片的比例，算好會自動套上。"
                        : "這張照片的比例還沒算出來（圖是外站的、瀏覽器不讓讀），平板以上先照一半一半顯示。把照片上傳到圖庫再挑一次就能算。"}
                    </p>
                  )}
                {theme.layout.heroSplitRatio === "photo" &&
                  theme.layout.heroSplitHeight === "content" && (
                    <p className="text-[10px] text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5 mt-1.5">
                      「這一段有多高」選了跟著內容，平板以上圖那欄維持一半寬、整段的高度照這張照片撐出來，照片剛好放滿。文字比照片高的話圖欄會跟著拉高，那時候鋪滿還是會裁一點、整張顯示會上下露底色。
                    </p>
                  )}
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="照片取景">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "top", label: "留上緣" },
                    { v: "center", label: "跟預設" },
                    { v: "bottom", label: "留下緣" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroImageFocus: opt.v })}
                      aria-pressed={theme.layout.heroImageFocus === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroImageFocus === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  照片鋪滿圖框、比例對不上時要切掉一邊，原本一律從正中間切。直式的商品照
                  被切掉的上面（葉冠、瓶口）跟下面（盆器、落款）常常就是想給人看的地方——
                  選留上緣就往下切，選留下緣就往上切。上一格「圖文比例」讓的是寬度，這格
                  管的是切在哪
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="照片左右取景">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "left", label: "留左緣" },
                    { v: "center", label: "跟預設" },
                    { v: "right", label: "留右緣" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroImageFocusX: opt.v })}
                      aria-pressed={theme.layout.heroImageFocusX === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroImageFocusX === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上一格管上下，這格管左右。平板以上這張圖的框是整屏高、半屏寬的直式框，
                  橫式照片（店面外觀、桌上一排商品）放進去被切掉的是左右兩邊——主體站在
                  畫面左邊的照片，從正中間切下去主體只剩半個。選留左緣就往右切，留右緣就
                  往左切；跟上一格可以疊著用，留上緣加留左緣就是保留左上角
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="照片完整度">
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: "cover", label: "鋪滿框" },
                    { v: "contain", label: "整張顯示" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitImageFit: opt.v })}
                      aria-pressed={theme.layout.heroSplitImageFit === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitImageFit === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上面兩格取景挑的是切哪一邊，前提是照片一定會被切。有些照片哪邊都不能切
                  ——整株連盆的植物、四邊帶留白的商品棚拍——選整張顯示就一點都不裁，放不滿
                  的地方露出這一段的底色；取景那兩格照樣有用，變成整張圖往框的哪一邊靠。
                  照片本身就是滿版店面照、想要撐滿整個半屏的店維持鋪滿框
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="手機上圖片的形狀">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "tall", label: "直式" },
                    { v: "square", label: "跟預設" },
                    { v: "wide", label: "橫式" },
                    { v: "photo", label: "跟照片" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitImageAspect: opt.v })}
                      aria-pressed={theme.layout.heroSplitImageAspect === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitImageAspect === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上面兩格只管平板跟桌機。手機上這個版型是圖在上、文字在下，圖框永遠是正方形，
                  跟你上傳什麼圖無關——一株連盆兩尺高的植物、一支細長的水壺，要從上下各切掉
                  快三分之一才塞得進去，「照片取景」那格只能決定犧牲葉冠還是犧牲盆器。選直式
                  就讓圖高一點、上下都留得住；橫幅的店面照或桌面陳列照則選橫式，不然撐開畫面
                  的那些留白會被左右切掉。「跟照片」是圖框直接照這張照片的比例來，一點都不裁、
                  也不會多出留白（太直或太扁的照片會收在 1:2 到 3:1 之間）。手機是客人幾乎唯一的入口
                </p>
                {theme.layout.heroSplitImageAspect === "photo" &&
                  theme.heroUrl &&
                  theme.layout.heroImageBounds?.url !== theme.heroUrl && (
                    <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-1.5">
                      {boundsStatus?.url === theme.heroUrl && boundsStatus.state === "detecting"
                        ? "正在算這張照片的比例，算好會自動套上。"
                        : "這張照片的比例還沒算出來（圖是外站的、瀏覽器不讓讀），手機上先照正方形顯示。把照片上傳到圖庫再挑一次就能算。"}
                    </p>
                  )}
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="文字靠哪">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "top", label: "靠上" },
                    { v: "center", label: "跟預設" },
                    { v: "bottom", label: "靠下" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitTextAlign: opt.v })}
                      aria-pressed={theme.layout.heroSplitTextAlign === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitTextAlign === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上面三格動的都是照片那半，文字那半的字則是一律擺在正中間。這一段在平板
                  以上是整個螢幕高，所以只放一行店名的店，那行字會孤零零浮在中央、照片
                  上緣到字之間空掉半個螢幕；反過來主標兩三行加副標加按鈕的店，字團本來
                  就快撐滿，擺中間跟照片的上下緣對不起來。選靠上就讓第一行字對齊照片
                  上緣，靠下就讓最後一顆按鈕對齊照片下緣。手機是圖上文下，這格沒作用
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="文字靠左右哪邊">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "left", label: "靠左" },
                    { v: "center", label: "置中" },
                    { v: "right", label: "靠右" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitTextAlignX: opt.v })}
                      aria-pressed={theme.layout.heroSplitTextAlignX === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitTextAlignX === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上一格是這欄的字擺多高，這格是同一欄的另一個方向。左右那半是一張整欄高
                  的照片，兩邊都切得筆直；文字這半的字全部靠左，右邊那側就是一條長短不齊
                  的邊，跟旁邊那張照片擺在一起看起來不像一組的。置中讓兩半各自對稱、中軸
                  對上照片的中軸；靠右讓字的右緣貼著欄的內緣，圖在左的時候兩半會朝中間
                  互相靠攏。副標跟那排按鈕會一起跟著移，不會上面置中下面還留在左邊
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="文字欄左右留白">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "roomy", label: "寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitTextPadding: opt.v })}
                      aria-pressed={theme.layout.heroSplitTextPadding === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitTextPadding === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  「圖文比例」讓的是文字那半有多寬，這格管的是那一半裡面兩邊再空多少。
                  桌機原本左右各空一大截——選了圖寬之後文字只剩四成，還照樣空這麼多，
                  一行常常只排得下四五個字，整段變成一條細長的字柱，這時候選窄；反過來
                  只放一行短主標的店選寬，留白本身就是版面。手機上那個左右邊界要跟導覽列
                  對齊，所以這格只影響平板以上
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="手機上文字段上下留白">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "roomy", label: "寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitMobilePadY: opt.v })}
                      aria-pressed={theme.layout.heroSplitMobilePadY === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitMobilePadY === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上一格管的是左右、而且只影響平板以上；這格剛好相反，只影響手機的上下。
                  手機上文字那段的上下各空一截，那個空白是配正方形照片、字只有店名加
                  一句話挑的。照片改成直式之後，光那張圖就超過一個螢幕高，底下再接一塊
                  上下都很空的字，整段拉得很長、客人得一直滑，這時候選窄；反過來把文字
                  排到照片上面當第一屏的店選寬，開頭才不會貼著上面那條導覽列
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="這段字裡面的行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "鬆" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitGap: opt.v })}
                      aria-pressed={theme.layout.heroSplitGap === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitGap === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  小標、主標、副標、那排按鈕，這四樣東西彼此之間隔多遠。上面兩格管的是
                  這一欄的邊界離字有多遠，這格管的是欄裡面各行之間的疏密。原本那組間距
                  是配預設主標字級挑的：字級拉大之後，一行大字跟下一行之間只剩原本那點空，
                  而這一欄又只有半個螢幕寬、字換行更早行數更多，整團字容易糊成一塊；反過來
                  「圖文比例」選了圖窄、文字那半變寬的店，字排得開了行距卻沒跟著開，上下
                  會比左右擠。四樣東西一起縮放，副標貼主標近、按鈕離得遠的層次不會跑掉
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="手機上誰排在上面">
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: "image-first", label: "跟預設（照片）" },
                    { v: "text-first", label: "文字" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitMobileOrder: opt.v })}
                      aria-pressed={theme.layout.heroSplitMobileOrder === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitMobileOrder === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  「圖片靠左 / 靠右」只管平板以上的左右。手機是上下堆疊，永遠是照片先——
                  滿寬的照片光自己就吃掉一個螢幕寬的高度，客人從 IG 點進來第一屏只看得到
                  那張圖，店名、那句話、兩顆按鈕全在下面，要滑一下才出現。照片本身就是招牌
                  的店（店面照、一整面植物牆）維持預設；想讓客人先知道這是誰、賣什麼的店選
                  文字，照片接在下面
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="這一段有多高">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "content", label: "跟著內容" },
                    { v: "compact", label: "稍矮" },
                    { v: "normal", label: "跟預設" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitHeight: opt.v })}
                      aria-pressed={theme.layout.heroSplitHeight === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitHeight === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上面幾格動的都是這一段裡面怎麼分，這一段本身多高是寫死的整屏（上面那格
                  「Hero 高度」只有整版圖片版型會套用）。右半只放店名一行加一句話的店，
                  那半欄會空一大片，客人得再滑一整個螢幕才碰得到下一段——選跟著內容，整段
                  收成文字那欄的高度（字的上下會自動留一小截空，不會貼著段的邊），但照片
                  那欄至少留半個螢幕高，字再少照片也不會被壓成一條（圖文比例選了跟照片的
                  話改照照片比例撐）；稍矮是比一個螢幕短一截、
                  還留得住開頭的份量。照片直式又寫了三四行字的店維持跟預設。只影響平板
                  以上，手機是圖上文下堆疊
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="文字那半的底色">
                <div className="flex items-center gap-2">
                  {/* 沒設的時候公開頁透出來的是整段的底色（等於全站底色），
                      所以取色器拿全站底色當初始值 */}
                  <input
                    type="color"
                    value={theme.layout.heroSplitTextBg ?? theme.bg}
                    onChange={(e) => updateLayout({ heroSplitTextBg: e.target.value })}
                    className="h-8 w-12 rounded border border-stone-200"
                  />
                  <input
                    type="text"
                    value={theme.layout.heroSplitTextBg ?? ""}
                    onChange={(e) =>
                      updateLayout({ heroSplitTextBg: e.target.value || null })
                    }
                    placeholder="預設跟全站底色一樣"
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                  />
                  {theme.layout.heroSplitTextBg && (
                    <button
                      type="button"
                      onClick={() => updateLayout({ heroSplitTextBg: null })}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  照片旁邊那半欄。它原本跟後面每一段同一個顏色，所以往下捲是一整片同色，
                  開頭在哪裡結束看不出來；手機上圖上文下，照片以下到頁尾也全是同一塊色。
                  換個顏色就能把開頭這段跟後面分開。照片那半不會受影響
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" &&
              theme.layout.heroSplitImageFit === "contain" && (
              <Field label="照片那半的底色">
                <div className="flex items-center gap-2">
                  {/* 沒設的時候露出來的是整段的底色（等於全站底色），取色器拿它當初始值 */}
                  <input
                    type="color"
                    value={theme.layout.heroSplitImageBg ?? theme.bg}
                    onChange={(e) => updateLayout({ heroSplitImageBg: e.target.value })}
                    className="h-8 w-12 rounded border border-stone-200"
                  />
                  <input
                    type="text"
                    value={theme.layout.heroSplitImageBg ?? ""}
                    onChange={(e) =>
                      updateLayout({ heroSplitImageBg: e.target.value || null })
                    }
                    placeholder="預設跟全站底色一樣"
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                  />
                  {theme.layout.heroSplitImageBg && (
                    <button
                      type="button"
                      onClick={() => updateLayout({ heroSplitImageBg: null })}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  「照片完整度」選了整張顯示，照片放不滿的那兩條邊露出來的是全站底色。
                  白底的商品棚拍放進米色的框會接成兩截、設了文字那半的底色之後照片那半又
                  是另一個顏色。填照片自己的底色（白底就填 #ffffff）讓邊跟照片接成一片，
                  或填跟文字那半一樣的色讓整段是一塊。鋪滿框時這格看不到，所以只在整張
                  顯示時出現
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "split" && (
              <Field label="圖文之間的線">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "none", label: "沒有" },
                    { v: "thin", label: "細" },
                    { v: "medium", label: "中" },
                    { v: "thick", label: "粗" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroSplitDivider: opt.v })}
                      aria-pressed={theme.layout.heroSplitDivider === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroSplitDivider === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {theme.layout.heroSplitDivider !== "none" && (
                  <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                    {([
                      { v: "normal", label: "淡" },
                      { v: "strong", label: "深" },
                      { v: "accent", label: "主色" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => updateLayout({ heroSplitDividerTone: opt.v })}
                        aria-pressed={theme.layout.heroSplitDividerTone === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          theme.layout.heroSplitDividerTone === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-stone-500 mt-1">
                  照片跟文字那半相接的地方原本什麼都沒有，兩邊底色只差一階的店看起來像
                  照片下面糊了一塊。開一條線把兩塊分清楚：桌機畫在兩欄中間、手機畫在照片
                  跟文字之間，照片靠哪一邊、手機誰在上面都會自己跟著換邊。淡是全站分隔線
                  的顏色，深跟字同色（深底淺字的店會自動變淺線），主色跟按鈕同色
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "magazine" && (
              <Field label="上下橫線粗細">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "normal", label: "跟預設" },
                    { v: "medium", label: "稍粗" },
                    { v: "thick", label: "粗" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMagazineRuleWeight: opt.v })}
                      aria-pressed={theme.layout.heroMagazineRuleWeight === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMagazineRuleWeight === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  雜誌版型上面那條（框住小標跟店名）跟下面那條（框住落款跟按鈕）的粗細。
                  兩條一起動——它們是上下對稱的一對，只加粗一條會變成沒關係的兩條線。
                  原本是最細的那種，旁邊擺著超大的主標時常常細到像沒對齊的痕跡
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "magazine" && (
              <Field label="上下橫線深淺">
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: "normal", label: "跟預設" },
                    { v: "faint", label: "更淡" },
                    { v: "strong", label: "同文字" },
                    { v: "accent", label: "主色" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMagazineRuleTone: opt.v })}
                      aria-pressed={theme.layout.heroMagazineRuleTone === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMagazineRuleTone === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  那兩條線的顏色。原本用的是全站畫卡片邊界的那階淡色，底色深一點的店根本
                  看不見，等於整個版型的骨架不見了、只剩中間一團字。選同文字就跟字一樣深
                  （深底淺字的店會自動變成淺線，不用自己挑色），選主色可以把它當開章的
                  裝飾線，選更淡是想留骨架但不想它出聲
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "magazine" && (
              <Field label="大字離上下橫線多遠">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "貼著" },
                    { v: "medium", label: "中等" },
                    { v: "normal", label: "跟預設" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMagazineGap: opt.v })}
                      aria-pressed={theme.layout.heroMagazineGap === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMagazineGap === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  這一段本來一定佔滿一整個螢幕，上下兩條線被推到螢幕的最上跟最下、中間浮
                  著主標，螢幕越大三塊離得越開，看起來像三件沒關係的東西——可是雜誌封面
                  的樣子就是靠那兩條線框住中間的字。只放一行主標的店選貼著或中等會收回來
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "magazine" && (
              <Field label="大字排多寬">
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: "narrow", label: "窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "rule", label: "跟橫線切齊" },
                    { v: "full", label: "滿版" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMagazineTextWidth: opt.v })}
                      aria-pressed={theme.layout.heroMagazineTextWidth === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMagazineTextWidth === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上下那兩條線的長度跟中間主標的寬度本來就不一樣，主標長一點就會排到比線
                  更外面去，看起來像字撐破了框。選跟橫線切齊，字的左右兩端會跟兩條線的頭
                  尾對齊；只放兩三個字的店選窄，那行字才不會散在中間
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "magazine" && (
              <Field label="上下那兩條線排多寬">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "narrow", label: "窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "full", label: "滿版" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMagazineRuleWidth: opt.v })}
                      aria-pressed={theme.layout.heroMagazineRuleWidth === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMagazineRuleWidth === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  這格動的是上下那兩條線，連同貼著線的小標、店名、落款跟按鈕一起。前面兩
                  格放寬的都是中間的字，兩條線一直停在原來的長度，所以中間選滿版之後，字
                  會排到比線更外面、看起來像撐破了框；中間選窄則反過來，線比字長出一大截。
                  想讓字剛好被框住，這格挑跟中間那格配成一對的檔位。上下兩條一起動，不會
                  變成一長一短
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "magazine" && (
              <Field label="這一段離螢幕邊多遠">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "narrow", label: "窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMagazinePadX: opt.v })}
                      aria-pressed={theme.layout.heroMagazinePadX === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMagazinePadX === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  前面幾格挑的是字跟線排多寬，這格挑的是外面那一圈留白。中間選滿版之後，
                  大字的左右兩端就停在這道留白上，整段到底離螢幕邊多遠就由這格決定。窄是
                  字幾乎頂到紙邊的那種大版面，寬是四周留一大片白、中間一小團字的那種。
                  上下兩條線跟中間的字一起移，不會有一層對不齊
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "magazine" && (
              <Field label="第二行小字排多寬">
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: "narrow", label: "窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "寬" },
                    { v: "title", label: "跟主標一樣寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() =>
                        updateLayout({ heroMagazineSubtitleWidth: opt.v })
                      }
                      aria-pressed={
                        theme.layout.heroMagazineSubtitleWidth === opt.v
                      }
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMagazineSubtitleWidth === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上一格放寬的只有主標，主標下面那行小字是另外一條寫死的窄欄，所以主標拉
                  寬之後會變成上面一行很寬、下面一條很窄，中間對齊但左右差一大截。選跟主
                  標一樣寬，兩行字的左右兩端才會切齊
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "magazine" && (
              <Field label="這段字裡面的行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "鬆" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMagazineTextGap: opt.v })}
                      aria-pressed={theme.layout.heroMagazineTextGap === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMagazineTextGap === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上面那行小字離線多近、主標跟下面那行小字離多近、下面那條線離落款多近。
                  前面「大字跟上下橫線的距離」那格動的是三塊之間被撐開多遠，這格動的
                  是每一塊自己裡面。主標字級拉大之後，主標跟副標只剩原本那點空、兩行
                  黏成一塊，而上下那兩條線離小字還是原本那麼近，中間那團越大、線那
                  兩端越顯得薄。三處一起縮放，線貼著小字、大字自己站開的層次不會跑掉
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "magazine" && (
              <Field label="整段底色">
                <div className="flex items-center gap-2">
                  {/* 沒設的時候公開頁走的還是全站底色，所以取色器拿全站底色當初始值 */}
                  <input
                    type="color"
                    value={theme.layout.heroMagazineBg ?? theme.bg}
                    onChange={(e) => updateLayout({ heroMagazineBg: e.target.value })}
                    className="h-8 w-12 rounded border border-stone-200"
                  />
                  <input
                    type="text"
                    value={theme.layout.heroMagazineBg ?? ""}
                    onChange={(e) =>
                      updateLayout({ heroMagazineBg: e.target.value || null })
                    }
                    placeholder="預設跟全站底色一樣"
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                  />
                  {theme.layout.heroMagazineBg && (
                    <button
                      type="button"
                      onClick={() => updateLayout({ heroMagazineBg: null })}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  這個版型沒有圖，畫面上只有上下兩條細線跟中間一段大字，其餘全是這片底色。
                  它原本跟底下的商品、慢讀、頁尾同一個顏色，往下捲是一整片同色，那兩條線
                  看起來就像頁面中間兩條沒來由的橫線。換個顏色，封面才有一個自己的色塊。
                  底色會鋪滿整個螢幕寬；挑深色的話，主標 / 副標 / 小標 / 落款 / 橫線的顏色
                  各有自己那一格可以跟著換
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "minimal" && (
              <Field label="文字欄寬">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "narrow", label: "窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMinimalWidth: opt.v })}
                      aria-pressed={theme.layout.heroMinimalWidth === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMinimalWidth === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  這個版型沒有圖也沒有線，只有中間一段字，所以字排多寬幾乎就是它的全部。
                  主標只有兩三個字時，原本的寬度會讓字左右各空一大塊、像沒排完；
                  主標長或副標寫了三四行時，每一行會拖得很長，置中的長行讀起來要一直找行頭
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "minimal" && (
              <Field label="上下留白">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "compact", label: "少" },
                    { v: "normal", label: "跟預設" },
                    { v: "spacious", label: "多" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMinimalPadding: opt.v })}
                      aria-pressed={theme.layout.heroMinimalPadding === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMinimalPadding === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  字上下各留多少空。原本那個留白是配「只有一行大主標」挑的，加了副標跟按鈕
                  之後整段變高，上下再各留那麼多會把後面的段落推到要捲一頁才看得到；
                  反過來只放一行短主標時，留白不夠這個版型就不成立，它靠的就是空
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "minimal" && (
              <Field label="這段字離螢幕邊多遠">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "narrow", label: "窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMinimalPadX: opt.v })}
                      aria-pressed={theme.layout.heroMinimalPadX === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMinimalPadX === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  「排多寬」那格給的是上限，電腦上才碰得到；手機螢幕比最窄那檔還窄，字離
                  螢幕邊多遠其實只由這格決定。窄是字幾乎貼到邊的那種大版面，寬是四周留一
                  大片白、中間一小團字的那種。整段連同短橫線、按鈕一起移，不會有一層對不齊
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "minimal" && (
              <Field label="這段字裡面的行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "鬆" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMinimalGap: opt.v })}
                      aria-pressed={theme.layout.heroMinimalGap === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMinimalGap === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  小標、主標、副標、那條短橫線、按鈕，這五樣東西彼此之間隔多遠。上面那格
                  「上下留白」管的是整段字離前後段多遠，這格管的是這段字自己內部的疏密，
                  兩件事一直只有前者能動。原本那組間距是配預設主標字級挑的：主標字級拉大
                  之後，一行大字跟下一行之間只剩原本那點空，整段擠成一團；反過來選了
                  「上下留白：少」想把整段收緊，外圈收了內部沒收，比例反而比預設還鬆。
                  五樣東西一起縮放，副標貼主標近、按鈕離得遠的那個層次不會跑掉
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "minimal" && (
              <Field label="文字對齊">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "left", label: "靠左" },
                    { v: "center", label: "置中" },
                    { v: "right", label: "靠右" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMinimalAlign: opt.v })}
                      aria-pressed={theme.layout.heroMinimalAlign === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMinimalAlign === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  整段字靠哪一邊。上面幾格調的都是這段字的框有多大，字在框裡面一直是
                  置中的。這個版型沒有圖，一進站就是一片空白配中間一段字：置中那版像
                  海報、像開場白；靠左那版像信紙、像店主自己寫的一段話。上面那格「主標
                  對齊」只管滿版圖的版型，這格才管得到這裡，而且副標跟那條短橫線會跟著
                  一起靠過去，三個東西對到同一條邊
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "minimal" && (
              <Field label="短橫線長度">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "none", label: "不顯示" },
                    { v: "short", label: "短" },
                    { v: "normal", label: "跟預設" },
                    { v: "long", label: "長" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroMinimalRule: opt.v })}
                      aria-pressed={theme.layout.heroMinimalRule === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroMinimalRule === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  主標跟按鈕中間那條短橫線。它是這個版型唯一的圖形，作用是把上面的字跟
                  下面的按鈕斷開。主標拉大或欄寬選寬的店，原本的長度在一整排大字底下細到
                  像沒擦乾淨的痕跡；主標只有兩三個字又選窄欄的店，它幾乎跟主標一樣長，
                  看起來像把字劃掉。只放一行店名、連按鈕都不要的話就選不顯示
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "minimal" &&
              theme.layout.heroMinimalRule !== "none" && (
              <Field label="短橫線顏色">
                <div className="flex items-center gap-2">
                  {/* 沒挑的時候公開頁畫的是全站主色壓半透明，所以取色器拿主色當初始值 */}
                  <input
                    type="color"
                    value={theme.layout.heroMinimalRuleColor ?? theme.accent}
                    onChange={(e) =>
                      updateLayout({ heroMinimalRuleColor: e.target.value })
                    }
                    className="h-8 w-12 rounded border border-stone-200"
                  />
                  <input
                    type="text"
                    value={theme.layout.heroMinimalRuleColor ?? ""}
                    onChange={(e) =>
                      updateLayout({ heroMinimalRuleColor: e.target.value || null })
                    }
                    placeholder="預設是全站主色的淡版"
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                  />
                  {theme.layout.heroMinimalRuleColor && (
                    <button
                      type="button"
                      onClick={() => updateLayout({ heroMinimalRuleColor: null })}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  它原本畫的是全站主色的淡版，在淺底的店看起來只是一條灰痕。挑了顏色就
                  照挑的畫、不再壓淡，所以挑深一點的可以讓它真的看得見，挑跟底色相近的
                  可以讓它幾乎消失、但字跟按鈕之間的距離還留著
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "minimal" && (
              <Field label="整段底色">
                <div className="flex items-center gap-2">
                  {/* 沒設的時候公開頁走的還是全站底色，所以取色器拿全站底色當初始值 */}
                  <input
                    type="color"
                    value={theme.layout.heroMinimalBg ?? theme.bg}
                    onChange={(e) => updateLayout({ heroMinimalBg: e.target.value })}
                    className="h-8 w-12 rounded border border-stone-200"
                  />
                  <input
                    type="text"
                    value={theme.layout.heroMinimalBg ?? ""}
                    onChange={(e) =>
                      updateLayout({ heroMinimalBg: e.target.value || null })
                    }
                    placeholder="預設跟全站底色一樣"
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                  />
                  {theme.layout.heroMinimalBg && (
                    <button
                      type="button"
                      onClick={() => updateLayout({ heroMinimalBg: null })}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  這個版型沒有圖也沒有色塊，一進站看到的就是這一片底色配中間一段字，
                  可是它原本跟底下的商品、慢讀、頁尾同一個顏色，客人往下捲是一整片同色，
                  開頭這段在哪裡結束看不出來。換個顏色就能把它跟後面分開。
                  底色會鋪滿整個螢幕寬，字還是照上面那格的欄寬排
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "full-image" && (
              <Field label="文字段底色">
                <div className="flex items-center gap-2">
                  {/* 沒設的時候公開頁走的還是全站底色，所以取色器拿全站底色當初始值 */}
                  <input
                    type="color"
                    value={theme.layout.heroTextBg ?? theme.bg}
                    onChange={(e) => updateLayout({ heroTextBg: e.target.value })}
                    className="h-8 w-12 rounded border border-stone-200"
                  />
                  <input
                    type="text"
                    value={theme.layout.heroTextBg ?? ""}
                    onChange={(e) =>
                      updateLayout({ heroTextBg: e.target.value || null })
                    }
                    placeholder="預設跟全站底色一樣"
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                  />
                  {theme.layout.heroTextBg && (
                    <button
                      type="button"
                      onClick={() => updateLayout({ heroTextBg: null })}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  照片底下裝主標跟按鈕的那一塊。它原本跟後面每一段同一個顏色，
                  所以照片以下整頁變成一長條同色，開頭那段跟下一段之間沒有任何界線。
                  換個顏色就能把開頭這段跟後面分開
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "full-image" && (
              <Field label="文字段上下留白">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "compact", label: "少" },
                    { v: "normal", label: "跟預設" },
                    { v: "spacious", label: "多" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroTextPadding: opt.v })}
                      aria-pressed={theme.layout.heroTextPadding === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroTextPadding === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  那一塊上下各留多少空。只放一行主標時，原本的留白會讓那塊顯得空；
                  主標加副標加小標加按鈕全開的店，同樣的留白會讓那塊拖得很長，
                  照片跟後面的商品之間隔了一大段。左右的邊界不動，那是跟導覽列對齊用的
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "full-image" && (
              <Field label="文字段欄寬">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "narrow", label: "窄" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "寬" },
                    { v: "full", label: "滿版" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroTextWidth: opt.v })}
                      aria-pressed={theme.layout.heroTextWidth === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroTextWidth === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上面那格動的是那塊色塊有多高，這格動的是裡面的字排多寬。色塊本身是
                  滿版的，字被關在中間一道看不見的欄裡：主標拉大或副標寫成兩三句的店，
                  每一行會拖得很長，置中的長行讀起來每行都要重新找行頭；只放店名兩三個
                  字的店則會左右各空一大片。要字跟照片同寬就選滿版
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "full-image" && (
              <Field label="文字段擺哪邊">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "left", label: "靠左" },
                    { v: "center", label: "置中" },
                    { v: "right", label: "靠右" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroTextAlignX: opt.v })}
                      aria-pressed={theme.layout.heroTextAlignX === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroTextAlignX === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上面那格決定那道欄有多寬，這格決定那道欄擺在照片的哪一邊。欄選窄之後
                  整塊停在正中間，裡面的字再靠左，左緣就落在一個誰也對不到的位置——不是
                  照片的左緣，也不是導覽列跟底下商品那道邊界。要做「照片下面一段字貼著
                  左邊起排」就選靠左，照片重心在右的話字挪到右邊配重。跟「主標對齊」是
                  兩件事：那格動的是每一行字各自靠哪邊，這格動的是整道欄擺哪
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "full-image" && (
              <Field label="這段字裡面的行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "鬆" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroTextGap: opt.v })}
                      aria-pressed={theme.layout.heroTextGap === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroTextGap === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  小標、主標、副標、按鈕，這四樣東西彼此之間隔多遠。上面兩格管的是那塊
                  色塊的邊界離字有多遠，這格管的是字跟字之間。原本那組間距是配預設主標
                  字級挑的：字級拉大之後，一行大字跟下一行之間只剩原本那點空，而這段字
                  上面就是一張滿版照片、本身已經很滿，底下再擠成一團整個開頭都沒有喘息
                  的地方；反過來欄寬選了滿版、字排到跟照片同寬的店，一行拉得很長行距卻
                  沒跟著開，上下會比左右擠。四樣東西一起縮放，副標貼主標近、按鈕離得遠
                  的層次不會跑掉。主標拖過位置的店這格不生效
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "full-image" && (
              <Field label="照片最高佔多少螢幕">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "不限" },
                    { v: "screen", label: "一個螢幕" },
                    { v: "short", label: "七成螢幕" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroImageMaxHeight: opt.v })}
                      aria-pressed={theme.layout.heroImageMaxHeight === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroImageMaxHeight === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  這個版型的照片會自己算高度：系統看那張圖四周留了多少白邊，把版位調成
                  剛好框住主體，所以不管上傳哪種圖都不會把主體切掉。代價是照片有多高完全
                  由那張圖的形狀決定——手機直拍那種長圖算出來會比一個螢幕還高，客人一進站
                  只看到照片中間一塊，得先滑過整張圖才碰得到店名跟按鈕。上面「Hero 高度」
                  那格說的是這一段至少多高，只撐得開、壓不下來。這格是「最高不超過」：
                  圖本來就矮的店選了也不會變，只有太高的才被收回來，收的方式是照原本
                  對齊主體的位置裁上下，主體不會偏掉
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "full-image" &&
              theme.layout.heroImageMaxHeight !== "none" && (
              <Field label="照片完整度">
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: "cover", label: "裁上下" },
                    { v: "contain", label: "整張顯示" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateLayout({ heroFullImageFit: opt.v })}
                      aria-pressed={theme.layout.heroFullImageFit === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.heroFullImageFit === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上一格把太高的照片收到上限之後，多出來的那截怎麼辦。裁上下是照原本對齊
                  主體的位置切掉頭尾，店面照、桌面照這樣就對；有些照片哪一截都不能切——
                  整株連盆的植物、上下都有字的海報——選整張顯示就把主體整個縮進那個框裡
                 （圖自帶的留白會先裁掉），一點都不裁，放不滿的邊露出全站底色。沒設上限時照片本來就不會被切，這格不會出現
                </p>
              </Field>
            )}
            {theme.layout.heroStyle === "full-image" &&
              theme.layout.heroImageMaxHeight !== "none" &&
              theme.layout.heroFullImageFit === "contain" && (
              <Field label="照片框的底色">
                <div className="flex items-center gap-2">
                  {/* 沒設的時候露出來的是整段的底色（等於全站底色），取色器拿它當初始值 */}
                  <input
                    type="color"
                    value={theme.layout.heroFullImageBg ?? theme.bg}
                    onChange={(e) => updateLayout({ heroFullImageBg: e.target.value })}
                    className="h-8 w-12 rounded border border-stone-200"
                  />
                  <input
                    type="text"
                    value={theme.layout.heroFullImageBg ?? ""}
                    onChange={(e) =>
                      updateLayout({ heroFullImageBg: e.target.value || null })
                    }
                    placeholder="預設跟全站底色一樣"
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                  />
                  {theme.layout.heroFullImageBg && (
                    <button
                      type="button"
                      onClick={() => updateLayout({ heroFullImageBg: null })}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  上一格選了整張顯示，照片放不滿的那兩條邊露出來的是全站底色。白底的商品
                  棚拍放進米色底會接成兩截、深色構圖配淺底邊界整個跳出來。填照片自己的
                  底色（白底就填 #ffffff）讓邊跟照片接成一片，或填深色讓整張像放在相框裡。
                  裁上下時這格看不到，所以只在整張顯示時出現
                </p>
              </Field>
            )}
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "collections" && (
          <PanelSection title="選物提案區段">
            <Field label="Eyebrow">
              <input
                type="text"
                value={theme.homepage.collectionsEyebrow}
                onChange={(e) =>
                  updateHomepage({ collectionsEyebrow: e.target.value })
                }
                placeholder="留空 = 不顯示"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Intro 文案上方那行小字，例如「Collections」或「選物提案」。
                留空 = 不顯示。
              </p>
            </Field>
            <Field label="Intro 文案">
              <textarea
                value={theme.homepage.collectionsIntro}
                onChange={(e) =>
                  updateHomepage({ collectionsIntro: e.target.value })
                }
                rows={3}
                placeholder="告訴我們你的空間，我們幫你選對的那一株..."
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none"
              />
            </Field>
            <Field label="排幾欄">
              <div className="grid grid-cols-3 gap-1.5">
                {([2, 3, 4] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateLayout({ collectionsColumns: n })}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.collectionsColumns === n
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {n} 欄
                  </button>
                ))}
              </div>
            </Field>
            <Field label="卡片按鈕文字">
              <input
                type="text"
                value={theme.homepage.collectionsCardCta}
                onChange={(e) =>
                  updateHomepage({ collectionsCardCta: e.target.value })
                }
                placeholder="看這個 →"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-stone-500 mt-1">
                每張選物提案卡片底部的小字行動按鈕，預設「看這個 →」
              </p>
            </Field>
            <p className="text-xs text-stone-500 leading-relaxed">
              個別選物提案的標題、副標、情境照在「傳統設定頁」編輯。
            </p>
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "promise" && (
          <PanelSection title="Promise 區段">
            <Field label="Eyebrow（小標）">
              <input
                type="text"
                value={theme.homepage.promiseEyebrow}
                onChange={(e) =>
                  updateHomepage({ promiseEyebrow: e.target.value })
                }
                placeholder="Our Promise"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Promise 卡片上方那行小字，預設「Our Promise」。
              </p>
            </Field>
            <Field label="Promise 文字">
              <textarea
                value={theme.homepage.promise}
                onChange={(e) => updateHomepage({ promise: e.target.value })}
                rows={5}
                placeholder="多行直接 enter 換行"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none"
              />
            </Field>
            <p className="text-xs text-stone-500 leading-relaxed">
              會以 quote card 形式顯示，自動加大引號。
            </p>
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "visit" && (
          <PanelSection title="Visit 區段">
            <Field label="Eyebrow（小標）">
              <input
                type="text"
                value={theme.homepage.visitEyebrow}
                onChange={(e) =>
                  updateHomepage({ visitEyebrow: e.target.value })
                }
                placeholder="Visit"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Visit 區段標題上方那行小字，預設「Visit」。
              </p>
            </Field>
            <Field label="標題">
              <input
                type="text"
                value={theme.homepage.visitTitle}
                onChange={(e) => updateHomepage({ visitTitle: e.target.value })}
                placeholder="來店裡走走"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Google Maps embed URL">
              <input
                type="text"
                value={theme.layout.mapEmbedUrl ?? ""}
                onChange={(e) =>
                  updateLayout({
                    mapEmbedUrl: e.target.value.trim() || null,
                  })
                }
                placeholder="https://www.google.com/maps/embed?pb=..."
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs font-mono"
              />
              <p className="mt-2 text-[11px] text-stone-500 leading-relaxed">
                Google Maps 找你的店面 → 分享 → 嵌入地圖 → 複製{" "}
                <code className="px-1 bg-stone-100 rounded">src=</code>{" "}
                內的 URL（必須是 google.com/maps/embed 開頭）
              </p>
            </Field>
            <p className="text-xs text-stone-500 leading-relaxed pt-2 border-t border-stone-100">
              地址 / 營業時間 / 電話 / Email 在「傳統設定頁」改。
            </p>
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "stats" && (
          <PanelSection title="數字 / 成就">
            <Field label="Eyebrow（小標）">
              <input
                type="text"
                value={theme.homepage.statsEyebrow}
                onChange={(e) =>
                  updateHomepage({ statsEyebrow: e.target.value })
                }
                placeholder="例如：By the Numbers"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Stats 區段上方那行小字，預設不顯示。填了才會出現。
              </p>
            </Field>
            <Field label="標題">
              <input
                type="text"
                value={theme.homepage.statsTitle}
                onChange={(e) =>
                  updateHomepage({ statsTitle: e.target.value })
                }
                placeholder="例如：這間店的小成就"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Stats 區段上方那行大字，預設不顯示。填了才會出現。
              </p>
            </Field>
            {theme.layout.stats.length === 0 ? (
              <p className="text-sm text-stone-600">還沒填，先加一筆數字。</p>
            ) : (
              <div className="space-y-3">
                {theme.layout.stats.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-stone-200 p-3 space-y-2 bg-stone-50/50"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] uppercase tracking-wider text-stone-500">
                        #{i + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeListItem("stats", i)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        移除
                      </button>
                    </div>
                    <input
                      type="text"
                      value={s.value}
                      onChange={(e) =>
                        updateListItem<StatItem>("stats", i, { value: e.target.value })
                      }
                      placeholder="2019 / 250+ / 1500"
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm font-medium font-mono"
                    />
                    <input
                      type="text"
                      value={s.label}
                      onChange={(e) =>
                        updateListItem<StatItem>("stats", i, { label: e.target.value })
                      }
                      placeholder="標籤（成立年份 / 植物種數 / 客人累計）"
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => addListItem("stats")}
              disabled={theme.layout.stats.length >= 6}
              className="w-full mt-3 rounded-lg border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/50 py-2.5 text-sm text-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + 加一筆數字{" "}
              <span className="text-stone-400 text-xs">
                ({theme.layout.stats.length}/6)
              </span>
            </button>
            <Field label="排幾欄">
              <div className="grid grid-cols-3 gap-1.5">
                {([2, 3, 4] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateLayout({ statsColumns: n })}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.statsColumns === n
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {n} 欄
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                桌機排幾欄。手機一律 2 欄不受影響。
              </p>
            </Field>
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "partners" && (
          <PanelSection title="合作夥伴 / 媒體 logos">
            <Field label="Eyebrow（小標）">
              <input
                type="text"
                value={theme.homepage.partnersEyebrow}
                onChange={(e) =>
                  updateHomepage({ partnersEyebrow: e.target.value })
                }
                placeholder="As featured in"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Partners 區段上方那行小字，預設「As featured in」。
              </p>
            </Field>
            {theme.layout.partners.length === 0 ? (
              <p className="text-sm text-stone-600">
                還沒加 partner，先加一個 logo。Logo URL 用任何公開 HTTPS 圖片。
              </p>
            ) : (
              <div className="space-y-3">
                {theme.layout.partners.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-stone-200 p-3 space-y-2 bg-stone-50/50"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] uppercase tracking-wider text-stone-500">
                        #{i + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeListItem("partners", i)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        移除
                      </button>
                    </div>
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) =>
                        updateListItem<PartnerItem>("partners", i, { name: e.target.value })
                      }
                      placeholder="名稱（給無障礙 alt 用）"
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={p.logoUrl}
                        onChange={(e) =>
                          updateListItem<PartnerItem>("partners", i, { logoUrl: e.target.value })
                        }
                        placeholder="Logo URL（https://...）"
                        className="flex-1 rounded border border-stone-200 px-2 py-1.5 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setAssetPickerMode({ kind: "partner-logo", index: i })
                        }
                        title="從圖庫挑"
                        className="px-2 rounded bg-emerald-700 text-white text-xs hover:bg-emerald-800 transition"
                      >
                        ✦
                      </button>
                    </div>
                    <input
                      type="text"
                      value={p.href ?? ""}
                      onChange={(e) =>
                        updateListItem<PartnerItem>("partners", i, {
                          href: e.target.value || null,
                        })
                      }
                      placeholder="連結（選填）"
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => addListItem("partners")}
              disabled={theme.layout.partners.length >= 12}
              className="w-full mt-3 rounded-lg border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/50 py-2.5 text-sm text-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + 加一個 logo{" "}
              <span className="text-stone-400 text-xs">
                ({theme.layout.partners.length}/12)
              </span>
            </button>
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "gallery" && (
          <PanelSection title="圖片相簿">
            <Field label="Eyebrow（小標）">
              <input
                type="text"
                value={theme.homepage.galleryEyebrow}
                onChange={(e) =>
                  updateHomepage({ galleryEyebrow: e.target.value })
                }
                placeholder="Gallery"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Gallery 區段上方那行小字，預設「Gallery」。
              </p>
            </Field>
            <Field label="標題">
              <input
                type="text"
                value={theme.homepage.galleryTitle}
                onChange={(e) =>
                  updateHomepage({ galleryTitle: e.target.value })
                }
                placeholder="相片紀錄"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Gallery 區段大字，預設「相片紀錄」。
              </p>
            </Field>
            {theme.layout.gallery.length === 0 ? (
              <p className="text-sm text-stone-600">
                還沒加圖，先加一張。URL 用任何公開 HTTPS 圖片。
              </p>
            ) : (
              <div className="space-y-3">
                {theme.layout.gallery.map((g, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-stone-200 p-3 space-y-2 bg-stone-50/50"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] uppercase tracking-wider text-stone-500">
                        #{i + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeListItem("gallery", i)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        移除
                      </button>
                    </div>
                    <input
                      type="text"
                      value={g.url}
                      onChange={(e) =>
                        updateListItem<GalleryItem>("gallery", i, { url: e.target.value })
                      }
                      placeholder="圖片 URL（https://...）"
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={g.caption ?? ""}
                      onChange={(e) =>
                        updateListItem<GalleryItem>("gallery", i, {
                          caption: e.target.value || null,
                        })
                      }
                      placeholder="圖說 / caption（選填）"
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => addListItem("gallery")}
                disabled={theme.layout.gallery.length >= 12}
                className="rounded-lg border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/50 py-2.5 text-xs text-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + 貼 URL
              </button>
              <button
                type="button"
                onClick={() => setAssetPickerMode({ kind: "gallery-add" })}
                disabled={theme.layout.gallery.length >= 12}
                className="rounded-lg bg-emerald-700 text-white py-2.5 text-xs hover:bg-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✦ 從圖庫挑
              </button>
            </div>
            <p className="mt-2 text-[10px] text-stone-500 text-center">
              {theme.layout.gallery.length}/12 張 · 圖庫由 Pexels 提供商用免費
            </p>
            <Field label="排幾欄">
              <div className="grid grid-cols-3 gap-1.5">
                {([2, 3, 4] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateLayout({ galleryColumns: n })}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.galleryColumns === n
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {n} 欄
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                桌機排幾欄。手機一律 2 欄不受影響。
              </p>
            </Field>
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "faq" && (
          <PanelSection title="常見問題（FAQ）區段">
            <Field label="Eyebrow（小標）">
              <input
                type="text"
                value={theme.homepage.faqEyebrow}
                onChange={(e) =>
                  updateHomepage({ faqEyebrow: e.target.value })
                }
                placeholder="FAQ"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                FAQ 區段上方那行小字，預設「FAQ」。
              </p>
            </Field>
            <Field label="標題">
              <input
                type="text"
                value={theme.homepage.faqTitle}
                onChange={(e) =>
                  updateHomepage({ faqTitle: e.target.value })
                }
                placeholder="常見問題"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                FAQ 區段大字，預設「常見問題」。
              </p>
            </Field>
            {theme.layout.faqItems.length === 0 ? (
              <p className="text-sm text-stone-600 leading-relaxed">
                還沒有 FAQ，先加一筆。
              </p>
            ) : (
              <div className="space-y-3">
                {theme.layout.faqItems.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-stone-200 p-3 space-y-2 bg-stone-50/50"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] uppercase tracking-wider text-stone-500">
                        FAQ #{i + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFaq(i)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        移除
                      </button>
                    </div>
                    <input
                      type="text"
                      value={f.question}
                      onChange={(e) =>
                        updateFaq(i, { question: e.target.value })
                      }
                      placeholder="問題..."
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm font-medium"
                    />
                    <textarea
                      value={f.answer}
                      onChange={(e) =>
                        updateFaq(i, { answer: e.target.value })
                      }
                      rows={3}
                      placeholder="答案... 換行用 Enter"
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm resize-none"
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addFaq}
              disabled={theme.layout.faqItems.length >= 20}
              className="w-full mt-3 rounded-lg border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/50 py-2.5 text-sm text-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + 加一筆 FAQ{" "}
              <span className="text-stone-400 text-xs">
                ({theme.layout.faqItems.length}/20)
              </span>
            </button>
            <Field label="一進來先攤開">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "none", label: "都收起來" },
                  { v: "first", label: "第一題" },
                  { v: "all", label: "全部" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ faqDefaultOpen: opt.v })}
                    aria-pressed={theme.layout.faqDefaultOpen === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.faqDefaultOpen === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                你寫這一段的理由就是少回一次「幾點開」「怎麼去」。可是每題都收起來的話，
                客人看到的是一排短句加一個加號，答案一個字都沒露出來——願意一題一題點的人
                才讀得到，滑過去的人照樣去 IG 私訊問。題目只有三五題就選全部，整段變成一頁
                滑得完的說明；題目多就選第一題，最多人問的那題先給答案，順便讓客人看懂
                下面那幾行是點得開的。選了攤開，客人一樣可以自己收起來。
              </p>
            </Field>
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "testimonials" && (
          <PanelSection title="顧客評語區段">
            <Field label="Eyebrow（小標）">
              <input
                type="text"
                value={theme.homepage.testimonialsEyebrow}
                onChange={(e) =>
                  updateHomepage({ testimonialsEyebrow: e.target.value })
                }
                placeholder="Testimonials"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                顧客評語區段上方那行小字，預設「Testimonials」。
              </p>
            </Field>
            <Field label="標題">
              <input
                type="text"
                value={theme.homepage.testimonialsTitle}
                onChange={(e) =>
                  updateHomepage({ testimonialsTitle: e.target.value })
                }
                placeholder="顧客的話"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                顧客評語區段大字，預設「顧客的話」。
              </p>
            </Field>
            {theme.layout.testimonials.length === 0 ? (
              <p className="text-sm text-stone-600 leading-relaxed">
                還沒有評語，先加一筆。
              </p>
            ) : (
              <div className="space-y-4">
                {theme.layout.testimonials.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-stone-200 p-3 space-y-2 bg-stone-50/50"
                  >
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] uppercase tracking-wider text-stone-500">
                        評語 #{i + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeTestimonial(i)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        移除
                      </button>
                    </div>
                    <textarea
                      value={t.quote}
                      onChange={(e) =>
                        updateTestimonial(i, { quote: e.target.value })
                      }
                      rows={3}
                      placeholder="顧客評語..."
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm resize-none"
                    />
                    <input
                      type="text"
                      value={t.author}
                      onChange={(e) =>
                        updateTestimonial(i, { author: e.target.value })
                      }
                      placeholder="顧客名字"
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      value={t.role ?? ""}
                      onChange={(e) =>
                        updateTestimonial(i, {
                          role: e.target.value || null,
                        })
                      }
                      placeholder="頭銜或描述（選填）"
                      className="w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addTestimonial}
              disabled={theme.layout.testimonials.length >= 6}
              className="w-full mt-3 rounded-lg border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/50 py-2.5 text-sm text-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + 加一筆評語{" "}
              <span className="text-stone-400 text-xs">
                ({theme.layout.testimonials.length}/6)
              </span>
            </button>
            <Field label="排幾欄">
              <div className="grid grid-cols-3 gap-1.5">
                {([2, 3, 4] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateLayout({ testimonialsColumns: n })}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.testimonialsColumns === n
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {n} 欄
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                桌機排幾欄。手機一律 1 欄不受影響。
              </p>
            </Field>
          </PanelSection>
        )}

        {activeTab === "section" &&
          selectedSection === "featured" && (
            <PanelSection title={sectionLabels.featured}>
              <Field label="Eyebrow">
                <input
                  type="text"
                  value={theme.homepage.featuredEyebrow}
                  onChange={(e) =>
                    updateHomepage({ featuredEyebrow: e.target.value })
                  }
                  placeholder="留空 = 不顯示"
                  maxLength={60}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                  標題上方那行小字，例如「Featured」或「本月精選」。
                  留空 = 不顯示。
                </p>
              </Field>
              <Field label="標題">
                <input
                  type="text"
                  value={theme.homepage.featuredTitle}
                  onChange={(e) =>
                    updateHomepage({ featuredTitle: e.target.value })
                  }
                  placeholder="本月選物"
                  maxLength={60}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                  Featured 區段上方那行大字，預設「本月選物」。
                </p>
              </Field>
              <Field label="看更多按鈕文字">
                <input
                  type="text"
                  value={theme.homepage.featuredCta}
                  onChange={(e) =>
                    updateHomepage({ featuredCta: e.target.value })
                  }
                  placeholder="看所有的植物"
                  maxLength={60}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                  區段底部跳到 /shop 的連結文字。預設「看所有的植物」，
                  非盆栽店家可改成「看所有商品 / 逛全部 / 看更多選品」。
                </p>
              </Field>
              <Field label={`顯示幾個商品（${theme.layout.featuredCount}）`}>
                <input
                  type="range"
                  min={FEATURED_COUNT_MIN}
                  max={FEATURED_COUNT_MAX}
                  step="1"
                  value={theme.layout.featuredCount}
                  onChange={(e) => updateLayout({ featuredCount: parseInt(e.target.value, 10) })}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-stone-500">
                  <span>3</span>
                  <span>12</span>
                </div>
              </Field>
              <Field label="排幾欄">
                <div className="grid grid-cols-3 gap-1.5">
                  {([2, 3, 4] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateLayout({ featuredColumns: n })}
                      className={`rounded-lg border py-2 text-xs transition ${
                        theme.layout.featuredColumns === n
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {n} 欄
                    </button>
                  ))}
                </div>
              </Field>
              <p className="text-xs text-stone-500 leading-relaxed">
                商品本身在「商品」頁編輯，這裡只控制首頁顯示幾個 / 怎麼排。
              </p>
            </PanelSection>
          )}

        {activeTab === "section" && selectedSection === "journal" && (
          <PanelSection title={sectionLabels.journal}>
            <Field label="Eyebrow（小標）">
              <input
                type="text"
                value={theme.homepage.journalEyebrow}
                onChange={(e) =>
                  updateHomepage({ journalEyebrow: e.target.value })
                }
                placeholder="Journal"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Journal 區段上方那行小字，預設「Journal」。
              </p>
            </Field>
            <Field label="標題">
              <input
                type="text"
                value={theme.homepage.journalTitle}
                onChange={(e) =>
                  updateHomepage({ journalTitle: e.target.value })
                }
                placeholder="慢讀"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                Journal 區段大字，預設「慢讀」。
              </p>
            </Field>
            <Field label="副題">
              <textarea
                value={theme.homepage.journalSubtitle}
                onChange={(e) =>
                  updateHomepage({ journalSubtitle: e.target.value })
                }
                rows={3}
                placeholder="關於植物、空間，與這間店的日常筆記。"
                maxLength={160}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                標題下方那段短說明。
              </p>
            </Field>
            <Field label="卡片底部標籤">
              <input
                type="text"
                value={theme.homepage.journalCardLabel}
                onChange={(e) =>
                  updateHomepage({ journalCardLabel: e.target.value })
                }
                placeholder="Coming soon"
                maxLength={60}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                每張 Journal 卡片底部那行小字，預設「Coming soon」。
              </p>
            </Field>
            <div className="pt-2 mt-2 border-t border-stone-100">
              <p className="text-xs font-medium text-stone-600 mb-1">下方三張卡片</p>
              <p className="text-[11px] text-stone-500 leading-relaxed mb-3">
                改成你自己的內容。留白就會顯示預設的 Care / Space / Story 範例。
              </p>
              {(() => {
                const cards = theme.homepage.journalCards.length > 0
                  ? theme.homepage.journalCards
                  : JOURNAL_CARD_DEFAULTS;
                function patchCard(i: number, key: "eyebrow" | "title" | "excerpt", value: string) {
                  const base = theme.homepage.journalCards.length > 0
                    ? theme.homepage.journalCards
                    : JOURNAL_CARD_DEFAULTS;
                  const next = [0, 1, 2].map((j) => ({
                    eyebrow: base[j]?.eyebrow ?? "",
                    title: base[j]?.title ?? "",
                    excerpt: base[j]?.excerpt ?? "",
                  }));
                  next[i] = { ...next[i], [key]: value };
                  updateHomepage({ journalCards: next });
                }
                return [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="mb-3 rounded-lg border border-stone-200 p-3 space-y-2"
                  >
                    <p className="text-[11px] font-medium text-stone-500">第 {i + 1} 張</p>
                    <input
                      type="text"
                      value={cards[i]?.eyebrow ?? ""}
                      onChange={(e) => patchCard(i, "eyebrow", e.target.value)}
                      placeholder="小標（如 Care）"
                      maxLength={40}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={cards[i]?.title ?? ""}
                      onChange={(e) => patchCard(i, "title", e.target.value)}
                      placeholder="標題"
                      maxLength={80}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    />
                    <textarea
                      value={cards[i]?.excerpt ?? ""}
                      onChange={(e) => patchCard(i, "excerpt", e.target.value)}
                      rows={2}
                      placeholder="一兩句說明"
                      maxLength={200}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none"
                    />
                  </div>
                ));
              })()}
            </div>
            <Field label="排幾欄">
              <div className="grid grid-cols-2 gap-1.5">
                {([2, 3] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateLayout({ journalColumns: n })}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.journalColumns === n
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {n} 欄
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                桌機排幾欄。固定三張卡，4 欄一定留空格所以不開。手機一律 1 欄不受影響。
              </p>
            </Field>
          </PanelSection>
        )}

        {/* === 共用「區段樣式」block — 出現在每個 section panel 底部 ===
            北極星：超越 Wix 的元素級控制覆蓋率。每個 section 都該有對齊 + 背景色覆寫。 */}
        {activeTab === "section" && selectedSection && selectedSection !== "hero" && (() => {
          const cur = theme.layout.sectionStyles[selectedSection] ?? {};
          const align = cur.headingAlign ?? "center";
          const bodyAlign = cur.bodyAlign ?? null;
          const bodyMeasure = cur.bodyMeasure ?? null;
          const bodyScale = cur.bodyScale ?? null;
          const bodyTone = cur.bodyTone ?? null;
          const bodyWeight = cur.bodyWeight ?? null;
          const bodyTracking = cur.bodyTracking ?? null;
          const headingTone = cur.headingTone ?? null;
          const bg = cur.bgColor ?? null;
          const textCol = cur.textColor ?? null;
          const pad = cur.paddingScale ?? null;
          const divider = cur.divider ?? "none";
          const dividerWeight = cur.dividerWeight ?? null;
          const dividerTone = cur.dividerTone ?? null;
          const dividerStyle = cur.dividerStyle ?? null;
          const headingScale = cur.headingScale ?? null;
          const minHeight = cur.minHeight ?? null;
          const contentAlign = cur.contentAlign ?? null;
          const headingGap = cur.headingGap ?? null;
          const headingInnerGap = cur.headingInnerGap ?? null;
          const eyebrowTracking = cur.eyebrowTracking ?? null;
          const eyebrowScale = cur.eyebrowScale ?? null;
          const eyebrowWeight = cur.eyebrowWeight ?? null;
          const eyebrowTone = cur.eyebrowTone ?? null;
          const eyebrowLeading = cur.eyebrowLeading ?? null;
          const eyebrowCase = cur.eyebrowCase ?? null;
          const hideOn = cur.hideOn ?? null;
          const outline = cur.outline ?? null;
          const outlineTone = cur.outlineTone ?? null;
          const outlineStyle = cur.outlineStyle ?? null;
          const shadow = cur.shadow ?? null;
          const borderRadius = cur.borderRadius ?? null;
          const mediaRadius = cur.mediaRadius ?? null;
          const mediaAspect = cur.mediaAspect ?? null;
          const mediaFocus = cur.mediaFocus ?? null;
          const mediaFocusX = cur.mediaFocusX ?? null;
          const mediaFit = cur.mediaFit ?? null;
          const mediaFrameBg = cur.mediaFrameBg ?? null;
          const mediaFrameColor = cur.mediaFrameColor ?? null;
          const partnerLogoScale = cur.partnerLogoScale ?? null;
          const partnerLogoOpacity = cur.partnerLogoOpacity ?? null;
          const gridGap = cur.gridGap ?? null;
          const cardHover = cur.cardHover ?? null;
          const cardText = cur.cardText ?? null;
          const cardSurface = cur.cardSurface ?? null;
          const cardPadding = cur.cardPadding ?? null;
          const cardLayout = cur.cardLayout ?? null;
          const cardMediaWidth = cur.cardMediaWidth ?? null;
          const mobileColumns = cur.mobileColumns ?? null;
          const cardTitleLines = cur.cardTitleLines ?? null;
          const cardDescLines = cur.cardDescLines ?? null;
          const cardTitleScale = cur.cardTitleScale ?? null;
          const cardTitleWeight = cur.cardTitleWeight ?? null;
          const cardTitleLeading = cur.cardTitleLeading ?? null;
          const cardTitleTracking = cur.cardTitleTracking ?? null;
          const cardTitleTone = cur.cardTitleTone ?? null;
          const cardDescScale = cur.cardDescScale ?? null;
          const cardDescLeading = cur.cardDescLeading ?? null;
          const cardDescWeight = cur.cardDescWeight ?? null;
          const cardDescTracking = cur.cardDescTracking ?? null;
          const cardDescTone = cur.cardDescTone ?? null;
          const cardMicroScale = cur.cardMicroScale ?? null;
          const cardMicroTracking = cur.cardMicroTracking ?? null;
          const cardMicroLeading = cur.cardMicroLeading ?? null;
          const cardMicroWeight = cur.cardMicroWeight ?? null;
          const cardMicroTone = cur.cardMicroTone ?? null;
          const cardMicroCase = cur.cardMicroCase ?? null;
          const cardPriceScale = cur.cardPriceScale ?? null;
          const cardPriceWeight = cur.cardPriceWeight ?? null;
          const cardPriceTracking = cur.cardPriceTracking ?? null;
          const cardPriceTone = cur.cardPriceTone ?? null;
          const cardRowGap = cur.cardRowGap ?? null;
          const cardMetaTone = cur.cardMetaTone ?? null;
          const entrance = cur.entrance ?? null;
          const fontFamily = cur.fontFamily ?? null;
          const letterSpacing = cur.letterSpacing ?? null;
          const lineHeight = cur.lineHeight ?? null;
          const opacity = cur.opacity ?? null;
          const filter = cur.filter ?? null;
          const sectionWidth = cur.sectionWidth ?? null;
          const sectionGap = cur.sectionGap ?? null;
          const contentWidth = cur.contentWidth ?? null;
          const contentAlignX = cur.contentAlignX ?? null;
          const contentPadX = cur.contentPadX ?? null;
          const headingWeight = cur.headingWeight ?? null;
          const headingLeading = cur.headingLeading ?? null;
          const headingTracking = cur.headingTracking ?? null;
          const headingRule = cur.headingRule ?? null;
          const headingRuleWeight = cur.headingRuleWeight ?? null;
          const headingRuleTone = cur.headingRuleTone ?? null;
          const headingRuleStyle = cur.headingRuleStyle ?? null;
          const accentBar = cur.accentBar ?? null;
          const accentBarWeight = cur.accentBarWeight ?? null;
          const accentBarTone = cur.accentBarTone ?? null;
          const accentBarStyle = cur.accentBarStyle ?? null;
          const texture = cur.texture ?? null;
          const textureTone = cur.textureTone ?? null;
          const textureScale = cur.textureScale ?? null;
          const textureColor = cur.textureColor ?? null;
          const bgGradient = cur.bgGradient ?? null;
          const bgGradientTone = cur.bgGradientTone ?? null;
          // 色票快選：全站主色 + 中性白/奶油/淺灰/近黑，省得每次自己對色碼
          const bgSwatches = [
            { c: "#FFFFFF", label: "白" },
            { c: "#F7F4ED", label: "奶油" },
            { c: "#FAFAF9", label: "淺灰" },
            { c: theme.primary, label: "主色" },
            { c: theme.accent, label: "Accent" },
            { c: "#1A1A1A", label: "近黑" },
          ];
          const textSwatches = [
            { c: "#1A1A1A", label: "近黑" },
            { c: "#FFFFFF", label: "白" },
            { c: "#6B6B6B", label: "灰" },
            { c: theme.primary, label: "主色" },
            { c: theme.accent, label: "Accent" },
          ];
          // 這支以前是「每欄一段 if、每欄自己手打一次合法值」的長鏈，加一個控制就要在型別與
          // 判斷各補一段。實際規則全欄一致（給 null 或選到等同預設的那個值就清掉整欄），
          // 已經連同欄位表收進 lib/section-style-schema，這裡只負責把結果交給 undo history。
          function patch(p: SectionStylePatch) {
            const next = applySectionStylePatch(cur, p);
            updateLayout({
              sectionStyles: {
                ...theme.layout.sectionStyles,
                [selectedSection!]: next,
              },
            });
          }
          const hasCustom = Object.keys(cur).length > 0;
          function resetAll() {
            const nextStyles = { ...theme.layout.sectionStyles };
            delete nextStyles[selectedSection!];
            updateLayout({ sectionStyles: nextStyles });
          }
          // group 分兩組：section = 動段落外圍（字體、呼吸、底色、外框），card = 動卡片自己。
          // 兩組各自獨立，一段可以同時套「雜誌風 + 整齊格子」；同組換另一個風格才會互相取代。
          //
          // 下面八個段落層風格原本只設六七個欄位（字體、標題大小、上下空白、字距、行高、
          // 底色外框那幾件），那是這些風格剛做出來時面板上就只有那幾格。後來一格一格補上的
          // 段落層控制——小標字距與字級、標題塊裡面的距離、標題與內容的距離、一行字數、
          // 內文字級、照片圓角、卡片間距、滑過卡片的動作——沒有一個進到風格裡，結果是套完
          // 「雜誌風」的段落，大標換成宋體放大了、上面那行小標還撐著照英文挑的 0.4em 與
          // 10px，跟大標黏成一團；套完「現代簡潔」的段落字距收緊了，段落最上面那塊裡面的
          // 距離還是原本那組寬鬆值，看起來不現代也不簡潔。商家得自己在四五格之間按對，
          // 那正是快速風格本來要省掉的事（跟上一輪三個卡片版型補字級與行距同一個理由）。
          //
          // 這一輪補的是最近三格「字自己怎麼排」的控制：段落大標的行距與字距、那行小標的
          // 行距。三格都是在字被風格改大改小、字距被撐開之後才浮出來的問題，所以正好是
          // 快速風格自己製造出來的——「雜誌風」把大標放大、小標撐開 0.4em，兩個都直接提高
          // 換行的機率，而換行之後的行距還是各段從字級 class 附帶來的那個值（照英文標題挑
          // 的 1.1-1.2，中文兩行的筆畫貼在一起）；「戲劇感」把小標放大三成又撐開，是所有
          // 風格裡最會把那行擠成兩行的一組，而那兩行之間繼承的是整段內文的行高（1.7 到 2），
          // 10px 的標籤上下空得比字本身還高，看起來是兩個沒關係的小標。商家套完風格看到的
          // 是「字換對了、排版散了」，還是得自己再按三格。
          // 沒有每一組都補：段落大標字距只補到整段字距沒設、大標會停在寫死 -0.01em 的那幾
          // 組（設了整段字距的組，大標本來就跟著整段走，再設一次只是把 0.1em 換成 0.08em，
          // 商家看不出差別、卻多一欄存進 DB）；「卡片浮起」那組動的是段落的底色與外框，
          // 一個字的設定都沒有，硬塞三格排版進去會變成按了底色順便被改字。
          const presets: {
            key: string;
            group: "section" | "card";
            label: string;
            hint: string;
            fields: typeof cur;
          }[] = [
            {
              key: "editorial",
              group: "section",
              label: "雜誌風",
              hint: "宋體 + 大標（行距拉開）+ 寬呼吸 + 小標撐開（行距收緊）+ 標題各段拉開 + 內文收成窄欄（適合 promise / journal）",
              fields: {
                fontFamily: "serif",
                headingScale: "large",
                paddingScale: "spacious",
                letterSpacing: "wide",
                lineHeight: "relaxed",
                divider: "top",
                // 「字距」那欄設的是整段，小標自己帶著 0.4em 反而動都不動——雜誌風的重點
                // 就是那行小標，得單獨撐開才跟得上大標放大後的重量。
                eyebrowTracking: "wide",
                // 上一欄把那行小標每個字之間塞進 0.4 個字寬，四個中文字佔的寬度接近六個字，
                // 手機上一行放不下是常態。而它換行之後靠的是整段內文的行高，這組又剛好把
                // 行高設成舒展（2.0）——那是給一整段要讀的字挑的值，套在 10px 的標籤上，
                // 兩行之間空得比字還高，看起來不是一行換到第二行，是上下兩個小標。
                eyebrowLeading: "tight",
                // 大標放大（上面 headingScale）又是宋體，一整句中文在手機上換行是常態，
                // 而各段大標的行距是字級 class 附帶的 1.1-1.2（照英文標題挑的，字母沒有
                // 中文那種上下佔滿的筆畫）——雜誌版面的大標本來就是靠行與行之間的留白撐
                // 起來的，收在 1.1 裡兩行會糊成一塊。
                headingLeading: "loose",
                // 大標字距這組不設：整段字距已經是撐開（上面 letterSpacing: wide），大標
                // 繼承得到，再設一次只是把 0.1em 換成 0.08em。
                // 大標放大之後，小標與大標之間、大標與引言之間還是原本照一行小標配一行
                // 大標挑的距離，三行字擠成一團；雜誌版面靠的就是那幾段留白。
                headingInnerGap: "loose",
                headingGap: "loose",
                // 寬呼吸的段落內文一行會拉到整個螢幕寬，眼睛換行找不到行首。
                bodyMeasure: "normal",
              },
            },
            {
              key: "modern",
              group: "section",
              label: "現代簡潔",
              hint: "黑體 + 緊字距 + 微圓角 + 小標收緊（行距一起收）+ 大標行距收緊 + 標題貼近內容 + 卡片品名加中黑 + 照片跟著圓 + 滑過只輕輕浮起（Stripe / Linear 風）",
              fields: {
                fontFamily: "sans",
                paddingScale: "default",
                letterSpacing: "tight",
                borderRadius: "soft",
                // 整段字距收緊了、小標還撐著 0.4em，那行字看起來像從別的風格剩下來的。
                eyebrowTracking: "tight",
                // 那行小標的字距收緊了，換行之後上下兩行還是隔著整段內文的行高（1.7 上下），
                // 一行 10px 的字上下留出將近兩行的空——這組把段落裡每一截距離都收掉了，
                // 只剩那行小標自己散著，看起來像從別的風格剩下來的。
                eyebrowLeading: "tight",
                // 同一件事落在大標上：這組不放大標題、靠字重與距離分層級，而大標的行距是
                // 字級 class 附帶的一個比例，商家打了長標題換行之後，兩行之間的空隙比這組
                // 段落裡任何一截距離都大，整塊標題看起來不屬於這個版面。
                headingLeading: "tight",
                // 大標字距這組不設：整段字距已經收緊（上面 letterSpacing: tight），大標
                // 繼承得到；大標專屬那格的收緊是 -0.05em，套在字級最大的一行中文上筆畫
                // 會真的疊到隔壁，反而是這個風格最不能出的錯。
                // 這類介面風格的特徵是資訊之間貼得近、靠字重與大小分層級，不是靠留白。
                headingInnerGap: "tight",
                headingGap: "tight",
                // 段落的四角圓了、裡面的照片還是方的，兩個圓角對不起來反而像沒做完。
                mediaRadius: "soft",
                // 這個風格靠字重分層級（上面那行註解就是這個意思），但卡片上的品名一直是
                // 寫死的 400，跟底下的描述只差在顏色淡一點——整段字距收緊、留白也收掉之後，
                // 那點差別撐不住，一張卡看起來是三行沒有主次的字。
                cardTitleWeight: "medium",
                // 站上滑過卡片一次做四件事（浮起、照片放大、壓暗、標題撐開），在克制的
                // 介面風格裡太吵。
                cardHover: "calm",
              },
            },
            {
              key: "dramatic",
              group: "section",
              label: "戲劇感",
              hint: "滿屏 + 大標（加粗、行距收緊、字距撐開）+ 深陰影 + 上滑進場 + 小標放大撐開（行距收緊）+ 內文收成窄欄",
              fields: {
                minHeight: "fullscreen",
                // 滿屏撐出來的空高原本一律留在內容下面，套完是一小塊內容黏在上緣、下面一大片
                // 空白，看起來像沒排完。這個 preset 要的就是一整螢幕的段落，內容置中才成立。
                contentAlign: "middle",
                headingScale: "large",
                paddingScale: "spacious",
                shadow: "deep",
                entrance: "slide-up",
                // 一整螢幕高的段落裡只有一小塊內容，10px 的小標在那個尺度下等於不存在；
                // 這個風格是要那塊內容撐得住整個畫面，小標與大標都得跟著長。
                eyebrowScale: "large",
                eyebrowTracking: "wide",
                // 放大三成又撐開 0.4em，是八組風格裡最會把那行小標擠成兩行的一組（兩個
                // 設定都在往寬的方向推）。而它換行之後隔的是整段內文的行高，字放大之後
                // 那個比例撐出來的空隙也跟著長——一整螢幕的段落上，那塊本來要當主角的
                // 標題會先被一行拆成兩截的小標破掉。
                eyebrowLeading: "tight",
                headingWeight: "bold",
                // 海報式的大標題行距本來就比內文緊，一整螢幕高的段落更是靠那塊字的份量
                // 撐住畫面；大標放大又加粗之後，字級 class 附帶的那個比例撐出來的空隙會
                // 讓兩行標題散成兩句沒關係的話。
                headingLeading: "tight",
                // 這組沒設整段字距，大標停在寫死的 -0.01em（照英文標題挑的：英文收一點
                // 字距，單字之間的空格還在）。中文沒有那個空格，加粗之後筆畫更厚，往內
                // 收 0.01 個字寬會黏在一起，而這組的大標是整頁最大最粗的一行。
                headingTracking: "wide",
                // 滿屏段落的內文一行橫跨整個螢幕，是所有版型裡最難讀的一種。
                bodyMeasure: "normal",
              },
            },
            {
              key: "floating",
              group: "section",
              label: "卡片浮起",
              hint: "淺底 + 邊框 + 圓角 + 陰影 + 照片跟著圓 + 滑過只輕輕浮起（適合 testimonial）",
              fields: {
                bgColor: "#fafaf9",
                shadow: "soft",
                borderRadius: "soft",
                outline: "subtle",
                paddingScale: "default",
                // 整段變成一張浮起的卡片之後，裡面的照片還是直角的，兩層形狀對不起來。
                mediaRadius: "soft",
                // 段落自己已經浮起來了，裡面每張卡滑過去再浮一次是兩層在動。
                cardHover: "calm",
              },
            },
            {
              key: "recede",
              group: "section",
              label: "低調襯底",
              hint: "淡化 + 緊湊 + 小標（連同上面那行小標、內文一起縮，行距也收）+ 卡片靠攏 + 滑過不動（次要區段退到後面，襯托 hero / 選物。適合 partners / stats / faq）",
              fields: {
                opacity: "muted",
                paddingScale: "compact",
                headingScale: "small",
                letterSpacing: "wide",
                // 大標縮小了、上面那行小標還是 10px，兩行變成同一級，反而看不出誰是標題。
                eyebrowScale: "small",
                // 縮小之後那行字更小，換行時上下之間隔的卻還是整段內文的行高（1.7 上下，
                // 而這組又把整段字距設成撐開，那行小標更容易換行）——一段本來要退到後面
                // 的區段，反而因為那行小標散成兩截而多佔一截高度，跟「緊湊」是反的。
                eyebrowLeading: "tight",
                // 大標行距這組不設：標題已經縮成小（上面 headingScale: small），一行放得
                // 下是常態，收緊行距在畫面上看不出差別，卻會讓這組多一欄存進 DB。
                bodyScale: "small",
                // 退到後面的段落還佔著跟主打段落一樣的格線間距，等於沒退。
                gridGap: "tight",
                // 這一段本來就不是要客人停下來的地方，滑過去整片在動會把注意力抓回來。
                cardHover: "none",
              },
            },
            {
              key: "mono",
              group: "section",
              label: "黑白雜誌",
              hint: "黑白濾鏡 + 宋體 + 寬字距（小標也撐開、行距收緊）+ 大標行距拉開 + 寬呼吸 + 照片緊貼成一片 + 滑過只輕輕浮起（攝影感雜誌調，適合 gallery / partners）",
              fields: {
                filter: "grayscale",
                fontFamily: "serif",
                letterSpacing: "wide",
                paddingScale: "spacious",
                eyebrowTracking: "wide",
                // 跟雜誌風同一件事：撐開 0.4em 的小標在手機上很容易變兩行，而兩行之間繼承
                // 的是整段內文的行高，10px 的標籤上下空得比字還高。
                eyebrowLeading: "tight",
                // 這組是宋體大標配一整片照片，標題是照片以外唯一的排版元素——字級 class
                // 附帶的 1.1-1.2 是照英文標題挑的，中文兩行的筆畫會貼在一起，跟底下那片
                // 留了寬呼吸的版面對不起來。
                headingLeading: "loose",
                // 大標字距不設，理由同雜誌風：整段字距已經撐開，大標繼承得到。
                // 攝影雜誌的整頁照片是緊貼成一片看的，中間留白會把那片拆回一張一張。
                gridGap: "tight",
                // 黑白照片滑過去被放大又壓暗，剛調好的灰階層次會糊掉。
                cardHover: "calm",
              },
            },
            {
              key: "boxed-card",
              group: "section",
              label: "置中卡片",
              hint: "窄版置中 + 上下拉開 + 淺底圓角陰影 + 照片跟著圓 + 標題貼近內容（大標與小標行距一起收）+ 滑過只輕輕浮起（整段縮成一張浮起的卡片，適合 promise / testimonial / faq）",
              fields: {
                sectionWidth: "boxed",
                sectionGap: "large",
                bgColor: "#fafaf9",
                borderRadius: "soft",
                shadow: "soft",
                outline: "subtle",
                paddingScale: "default",
                mediaRadius: "soft",
                // 整段已經收成一張卡片，裡面還照原本滿版段落那個距離留白的話，卡片會被
                // 撐得很高、內容散在中間。
                headingGap: "tight",
                // 同一個理由往裡面走一層：整段收成 1100px 的卡片之後，同一句大標比滿版時
                // 更容易換行，而換行之後那截空隙是這張卡片被撐高的另一個來源——上一欄收的
                // 是標題塊跟內容之間，這欄收的是標題自己兩行之間。
                headingLeading: "tight",
                // 那行小標同理，而且它自己還帶著 0.4em 的字距（等於每個字後面多塞半個字寬），
                // 在收窄的卡片裡是最先換行的一行，換行後隔的又是整段內文的行高。
                eyebrowLeading: "tight",
                cardHover: "calm",
              },
            },
            {
              key: "left-story",
              group: "section",
              label: "靠左敘事",
              hint: "標題靠左 + 宋體 + 寬行高 + 寬呼吸 + 內文放大 + 小標撐開（行距收緊）+ 大標行距與字距一起拉開 + 標題各段拉開（左對齊的雜誌敘事感，適合 about / story / journal）",
              fields: {
                headingAlign: "left",
                fontFamily: "serif",
                lineHeight: "relaxed",
                paddingScale: "spacious",
                sectionWidth: "narrow",
                // 這個風格的主角是那段字，不是標題——段落收窄之後內文還停在原本的大小，
                // 一整片留白中間一行小字，看起來像沒排完。
                bodyScale: "large",
                eyebrowTracking: "wide",
                // 這組把整段收成 760px 的窄欄，是八組裡最窄的一個——撐開 0.4em 的小標在
                // 那個寬度上幾乎一定換行，而換行之後隔的是整段內文的行高，這組又設成舒展
                // （2.0）：一行 10px 的小標會拉出兩行之間空一整行的樣子。
                eyebrowLeading: "tight",
                // 大標也一樣，窄欄裡一句中文標題換行是常態，而字級 class 附帶的行距是照
                // 英文標題挑的 1.1-1.2。這組整段的行高已經設成舒展，內文有呼吸、標題卻
                // 貼成一塊，兩者對不起來——標題那格的規則不碰 h2，得靠這一欄。
                headingLeading: "loose",
                // 這組沒設整段字距，大標停在寫死的 -0.01em；靠左的宋體敘事標題撐開一點才
                // 有雜誌那種留白，而中文每個字本來就佔滿方框，往內收只會讓筆畫多的字黏住。
                headingTracking: "wide",
                headingInnerGap: "loose",
              },
            },
            // 下面三個動的是卡片自己，上面八個動的都是段落外圍（字體、呼吸、底色、外框）。
            // 分開列是因為這一批卡片級的控制（卡片排法 / 卡片外觀 / 卡片文字 / 標題與描述
            // 行數 / 手機一列幾張）是後來一格一格補上的，快速風格一直停在只設段落那層——
            // 商家想要「網購站那種清單」或「邊界清楚的格子牆」，得自己在六七個控制之間
            // 一格一格按對，那正是快速風格本來要省掉的事。
            // 後來又補的那批（卡片標題 / 描述 / 價錢字級、卡片行距、副文字深淺、品名與描述
            // 各自的行距）同樣要跟上：
            // 三個版型改的是卡片的形狀（橫排、寬窄、加底），卡片裡那四行字的大小與距離卻
            // 停在照直排小卡挑的值，套完風格還是得再手動調三四格才對得起來。
            {
              key: "product-list",
              group: "card",
              label: "商品清單",
              hint: "照片在左（佔窄）+ 卡片文字靠左 + 品名兩行（中黑）+ 描述兩行 + 品名與描述行距一起收緊 + 價錢放大加深加粗 + 手機一列一張（一般網購站的清單模式，同一個螢幕看得到的品項多；適合 選物 / 精選 / 慢讀）",
              fields: {
                cardLayout: "side",
                // 橫排的照片佔寬預設是 38%，清單這種一行只有品名跟價錢的內容，字沒幾個
                // 卻分到快四成寬。收到 narrow（25%）才是網購站清單的樣子。
                cardMediaWidth: "narrow",
                cardText: "left",
                cardTitleLines: "two",
                // 這個版型主動把品名放成兩行（上一欄），而兩行之間的距離是跟著字級 class
                // 附帶的（1.5 那種，照一行字挑的）——照片收到 25% 之後右邊那欄本來就窄，
                // 品名幾乎一定換行，兩行中間再空著就把一列的高度拉高，清單「一個螢幕看得到
                // 幾個品項」的意義先被吃掉。行距那格收緊的是行與行之間，同一行字自己換行
                // 不歸它管，這格才是。
                cardTitleLeading: "tight",
                cardDescLines: "two",
                // 描述限成兩行了，但那兩行之間空多少還是各段各寫各的（選物那段的副標約
                // 1.43、慢讀那段的摘要 1.85）。清單模式下這兩行幾乎一定是滿的——照片收到
                // 25%、右邊那欄本來就窄——同一個「商品清單」套到慢讀那段，光是描述那兩行
                // 就比選物那段高出快半行，一列一列疊起來就是一個螢幕少看到一兩個品項。
                cardDescLeading: "tight",
                // 清單的重點是一個螢幕看得到幾個品項，行與行之間的距離是照直排卡片挑的
                // （品名離照片 24px 那種），橫排之後四行字散在右邊一片空白裡。
                cardRowGap: "tight",
                // 清單模式下客人是一行一行掃過去比價，價錢寫死比品名還小一級、又被淡到
                // 五成，正好是這種版型最該看得到的那行。放大與調深都做過了還差粗細——
                // 網購站的價錢幾乎都是粗的，而且粗不佔空間，橫排卡片右邊那欄本來就窄。
                cardPriceScale: "large",
                cardMetaTone: "strong",
                cardPriceWeight: "bold",
                // 深淺那格還原的只是卡片外面那層 0.7，顏色本身還是文字色的七成——放大、
                // 加粗、還原透明度三件都做了，價錢在清單裡還是比品名淡一階。跟品名同深才
                // 收得掉最後那點落差（不用主色：清單一行一個品項，一整排彩色數字太吵）。
                cardPriceTone: "text",
                // 價錢一粗，400 的品名反而被壓過去，客人先看到的是數字不是商品；品名跟著
                // 上一階（不到 700）才留得住「品名是主角、價錢是重點」的順序。
                cardTitleWeight: "medium",
                // 橫排之後右邊那欄本來就窄，「剩 3 件」「看更多」那行還帶著 0.3em 的字距
                // （照英文短詞挑的），在窄欄裡直接被撐到換行，一行小字變兩行貼著價錢。
                cardMicroTracking: "tight",
                mobileColumns: "one",
              },
            },
            {
              key: "tidy-grid",
              group: "card",
              label: "整齊格子",
              hint: "卡片加淡底 + 文字靠左 + 品名兩行（收小加中黑）+ 描述兩行 + 品名與描述行距一起收緊 + 照片正方（每張卡有自己的邊界、同一列下緣切齊；適合欄數調到 3、4 欄的 選物 / 精選）",
              fields: {
                cardSurface: "panel",
                cardText: "left",
                cardTitleLines: "two",
                cardDescLines: "two",
                // 這個版型是給一列 3、4 張的小卡用的，品名寫死的 18px（桌機 20px）在那種
                // 寬度上佔掉卡片下半整整兩行，照片被擠小；連著行距一起收，四行字才不會
                // 把加了淡底的卡片撐得比照片還高。
                cardTitleScale: "small",
                // 品名收小、行距也收緊之後，那行字跟底下的描述變成同一個大小級距，一整片
                // 小卡看起來是每張卡兩行灰字。這個版型的重點是「一列掃下來整齊」，靠的就是
                // 每張卡上都認得出哪行是品名——收小之後補回來的只能是粗細（再放大就違背版型）。
                cardTitleWeight: "medium",
                // 品名收小了、也限成兩行，但兩行之間還照原本那個比例空著——這個版型要的是
                // 同一列每張卡下緣切齊，而卡片高度就是被那截空隙一張一張撐得不一樣高的
                // （一行的卡矮、兩行的卡高，差的正是這一截）。收緊之後兩行品名佔的高度接近
                // 一行半，加了淡底的卡片才不會比照片還高。
                cardTitleLeading: "tight",
                // 品名那兩行收緊了，底下的描述也限成兩行、行距卻沒動。這個版型要的是同一列
                // 每張卡的下緣切齊，而卡片高度是品名兩行加描述兩行一起撐出來的——只收上面
                // 那半截，加了淡底的卡片還是被下面那半截撐得一張一張不一樣高。
                cardDescLeading: "tight",
                cardRowGap: "tight",
                // 一列 3、4 張的小卡上，「看更多」那行撐開的字距佔掉的比例比大卡大得多，
                // 常常是那張卡上唯一換行的東西，同一列的下緣就是被它拉歪的。
                cardMicroTracking: "tight",
                mediaAspect: "square",
              },
            },
            {
              key: "story-right",
              group: "card",
              label: "圖右敘事",
              hint: "照片在右（佔寬）+ 卡片文字靠左 + 品名兩行（放大）+ 描述不截（放大、行距一起放寬）+ 行距放寬 + 宋體寬行高 + 手機一列一張（先讀到字再看照片，適合 慢讀 / 品牌故事）",
              fields: {
                cardLayout: "side-reverse",
                cardMediaWidth: "wide",
                cardText: "left",
                cardTitleLines: "two",
                // 敘事段落的重點就是那段字，截行等於把要講的話砍掉；上面兩組是清單、
                // 要的是同一列下緣切齊，這組反過來。
                cardDescLines: "full",
                // 字級與行距也跟著反過來：這種卡片一列只放一兩張、右邊那段是要被讀完的
                // 文章，標題該像標題（現在跟商品品名同一級）、摘要 14px 在寬卡上像圖說，
                // 行與行擠在一起也不像一段可以讀的文字。
                cardTitleScale: "large",
                cardDescScale: "large",
                // 這組刻意不設粗細，另外兩組卡片版型都設了：那兩組是把字收小、靠粗細補回
                // 層級，這組是宋體大標配一整段摘要，標題已經放大兩成半、又有寬行距撐著，
                // 再加粗會變成賣場標題，把「先讀到字」的敘事感壓掉。想加粗的店自己按那一格。
                // 卡片小字字距同理不設：另外兩組收緊是因為窄欄、小卡會被那行撐到換行，
                // 這組的卡片一列只放一兩張、右邊那欄很寬，那行分類標籤撐開的字距正是這種
                // 雜誌版型要的東西，收緊反而把它變成一行普通小字。
                cardRowGap: "loose",
                // 標題放大兩成半又限成兩行，換行是這個版型的常態；宋體大標兩行擠在照一行
                // 字挑的 1.4 裡，看起來是兩行黏著的字不是一個標題。另外兩組卡片版型收緊是
                // 為了同一列切齊、一個螢幕看得多，這組反過來——一列只放一兩張，右邊那段
                // 本來就是要被讀完的文章，標題有呼吸才接得上底下那段寬行高的摘要。
                cardTitleLeading: "loose",
                // 標題有呼吸了，底下那段摘要卻還照原本的密度排——這組刻意不截行、又把摘要
                // 放大兩成，選物那段的副標本來就只跟著 text-sm 走（約 1.43，英文短句的密度），
                // 放大之後就是一整段中文擠在一起的樣子，正好是這個版型唯一要人讀完的東西。
                // 段落上那格「行高」管不到（它的規則只落在 p 那類元素，卡片裡的描述整組跳過），
                // 所以這一行跟上面的 lineHeight: relaxed 不重複，是同一件事的另外半邊。
                cardDescLeading: "loose",
                fontFamily: "serif",
                lineHeight: "relaxed",
                mobileColumns: "one",
              },
            },
          ];
          // 判斷目前這段是不是還套著某個快速風格（套完後又微調過就不算）。
          // 一個 preset 算「套用中」= 它的每個欄位都還在這段樣式裡、值也相同。
          // 多個同時符合時挑欄位最多的那個（最具體，通常是最後套的）。
          function presetMatches(fields: typeof cur) {
            return (Object.keys(fields) as Array<keyof typeof cur>).every((k) => {
              const want = fields[k];
              if (want === undefined) return true;
              const have = cur[k];
              if (typeof want === "string" && typeof have === "string" && want.startsWith("#")) {
                return want.toLowerCase() === have.toLowerCase();
              }
              return want === have;
            });
          }
          // 兩組各自算一個「目前」：段落那組跟卡片那組本來就能疊著用，以前只標欄位最多的
          // 那一個，套了「雜誌風 + 整齊格子」畫面上只有一顆亮著，看起來像另一個沒生效。
          const activePresetByGroup: Record<"section" | "card", string | null> = {
            section: null,
            card: null,
          };
          const activeFieldCountByGroup: Record<"section" | "card", number> = {
            section: 0,
            card: 0,
          };
          for (const p of presets) {
            if (presetMatches(p.fields)) {
              const n = Object.keys(p.fields).length;
              if (n > activeFieldCountByGroup[p.group]) {
                activeFieldCountByGroup[p.group] = n;
                activePresetByGroup[p.group] = p.key;
              }
            }
          }
          // 換同組的另一個風格時，要先把上一個風格設過、而新風格沒設的欄位清掉。
          // 不清的話會疊出四不像：「商品清單」換「整齊格子」，格子沒設 cardLayout，
          // 清單的照片在左就留著，商家看到的是橫排卡片加淡底，不是他按的格子牆。
          // 只清「這段的值就是那個風格設的值」的欄位——商家自己動過的值，我們不知道他是
          // 想留還是想換，留著比清掉安全。
          //
          // 判斷「上一個是哪個風格」不能直接用上面那個嚴格的「目前」：風格本身會長大
          // （這一輪就往三個風格裡各加了卡片粗細），去年套過舊版商品清單的段落少了新加的
          // 那兩欄，嚴格比對算它沒套任何風格，切換時就一格都不清——照片在左會留下來，
          // 正是這段註解開頭那個已經修過一次的四不像。所以這裡改成「值相同或這段根本沒設」
          // 都算數，而且同組每個符合的風格都清一遍（不只挑一個）。沒設的欄位刪了是空操作，
          // 值不一樣的風格一開始就不符合、碰不到，兩種情況都不會誤刪商家自己按的東西。
          function applyPreset(p: (typeof presets)[number]) {
            const merged: typeof cur = { ...cur, ...p.fields };
            for (const prev of presets) {
              if (prev.group !== p.group || prev.key === p.key) continue;
              const wasApplied = (Object.keys(prev.fields) as Array<keyof typeof cur>).every((k) => {
                const want = prev.fields[k];
                if (want === undefined) return true;
                const have = cur[k];
                if (have === undefined) return true;
                if (typeof want === "string" && typeof have === "string" && want.startsWith("#")) {
                  return want.toLowerCase() === have.toLowerCase();
                }
                return want === have;
              });
              if (!wasApplied) continue;
              (Object.keys(prev.fields) as Array<keyof typeof cur>).forEach((k) => {
                if (!(k in p.fields)) delete merged[k];
              });
            }
            (Object.keys(merged) as Array<keyof typeof merged>).forEach((k) => {
              if (merged[k] === undefined) delete merged[k];
            });
            updateLayout({
              sectionStyles: {
                ...theme.layout.sectionStyles,
                [selectedSection!]: merged,
              },
            });
          }
          function copyStyle() {
            setStyleClipboard({ source: selectedSection!, fields: { ...cur } });
          }
          function pasteStyle() {
            if (!styleClipboard) return;
            const fields: typeof cur = { ...styleClipboard.fields };
            (Object.keys(fields) as Array<keyof typeof fields>).forEach((k) => {
              if (fields[k] === undefined) delete fields[k];
            });
            updateLayout({
              sectionStyles: {
                ...theme.layout.sectionStyles,
                [selectedSection!]: fields,
              },
            });
          }
          const canPaste = styleClipboard !== null && styleClipboard.source !== selectedSection;
          const clipboardCount = styleClipboard ? Object.keys(styleClipboard.fields).length : 0;
          // 「套到全部」：把這段調好的樣式一次鋪到其他所有區段（hero 不吃區段樣式，排除）。
          const otherSections = theme.layout.sectionOrder.filter(
            (k) => k !== "hero" && k !== selectedSection,
          );
          function applyToAll() {
            if (!hasCustom || otherSections.length === 0) return;
            if (
              !window.confirm(
                `要把這段的 ${Object.keys(cur).length} 項樣式套到其他 ${otherSections.length} 個區段嗎？那些區段原本的自訂樣式會被蓋掉（可⌘Z 復原）。`,
              )
            )
              return;
            const nextStyles = { ...theme.layout.sectionStyles };
            for (const k of otherSections) {
              nextStyles[k] = { ...cur };
            }
            updateLayout({ sectionStyles: nextStyles });
          }
          return (
            <PanelSection title="區段樣式">
              {hasCustom && (
                <div className="-mt-2 flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <span className="text-[11px] text-stone-600 leading-relaxed">
                    這段已自訂 {Object.keys(cur).length} 項樣式
                  </span>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="shrink-0 text-[11px] font-medium text-stone-700 underline-offset-2 hover:underline hover:text-stone-900 transition"
                    title="把這段所有樣式清回預設（可用 ⌘Z 復原）"
                  >
                    全部重置
                  </button>
                </div>
              )}
              {(() => {
                const drag = SECTION_DRAG_ELEMENT[selectedSection!];
                if (!drag) return null;
                const pos = theme.layout.freePositions[drag.key];
                return (
                  <Field label="版位">
                    {pos ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-stone-600">
                          {drag.label}拖到了自訂位置：X={Math.round(pos.x * 100)}% · Y={Math.round(pos.y * 100)}%
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const { [drag.key]: _removed, ...rest } =
                              theme.layout.freePositions;
                            void _removed;
                            updateLayout({ freePositions: rest });
                          }}
                          className="w-full rounded-lg border border-stone-200 text-stone-700 text-xs py-2 hover:bg-stone-50 transition"
                          title={`把${drag.label}放回原本的版面位置（可用 ⌘Z 復原）`}
                        >
                          重設回預設版位
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-stone-500 leading-relaxed">
                        在中間預覽按住{drag.label}直接拖，放到哪就顯示在哪，位置會自動記住。
                      </p>
                    )}
                  </Field>
                );
              })()}
              <Field label="樣式複製">
                <p className="-mt-1 mb-1.5 text-[11px] text-stone-500 leading-snug">
                  這段調好之後，可貼到別段一鍵套同樣樣式
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={copyStyle}
                    disabled={!hasCustom}
                    className={`rounded-lg border px-2 py-2 text-xs transition text-left leading-tight ${
                      hasCustom
                        ? "border-stone-200 text-stone-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900"
                        : "border-stone-100 text-stone-300 cursor-not-allowed"
                    }`}
                    title={
                      hasCustom
                        ? "複製這段所有樣式（含背景 / 字距 / 邊框等）"
                        : "這段沒有自訂樣式，沒東西可複製"
                    }
                  >
                    複製這段
                  </button>
                  <button
                    type="button"
                    onClick={pasteStyle}
                    disabled={!canPaste}
                    className={`rounded-lg border px-2 py-2 text-xs transition text-left leading-tight ${
                      canPaste
                        ? "border-stone-200 text-stone-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900"
                        : "border-stone-100 text-stone-300 cursor-not-allowed"
                    }`}
                    title={
                      !styleClipboard
                        ? "還沒複製樣式 — 先複製一段才能貼"
                        : styleClipboard.source === selectedSection
                        ? "你正在這段，要切到別段才能貼"
                        : `把 ${sectionLabels[styleClipboard.source]} 的 ${clipboardCount} 項樣式貼過來（可⌘Z 復原）`
                    }
                  >
                    貼上樣式
                  </button>
                </div>
                {styleClipboard && (
                  <p className="mt-1.5 text-[11px] text-stone-500 leading-snug">
                    已複製：{sectionLabels[styleClipboard.source]} 的 {clipboardCount} 項樣式
                  </p>
                )}
                <button
                  type="button"
                  onClick={applyToAll}
                  disabled={!hasCustom || otherSections.length === 0}
                  className={`mt-1.5 w-full rounded-lg border px-2 py-2 text-xs transition leading-tight ${
                    hasCustom && otherSections.length > 0
                      ? "border-stone-200 text-stone-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900"
                      : "border-stone-100 text-stone-300 cursor-not-allowed"
                  }`}
                  title={
                    !hasCustom
                      ? "這段沒有自訂樣式，先調一段才能套到全部"
                      : otherSections.length === 0
                      ? "沒有其他區段可套"
                      : `把這段樣式一次套到其他 ${otherSections.length} 個區段（可⌘Z 復原）`
                  }
                >
                  套到全部區段{hasCustom && otherSections.length > 0 ? `（${otherSections.length} 段）` : ""}
                </button>
              </Field>
              <Field label="快速風格">
                <p className="-mt-1 mb-1.5 text-[11px] text-stone-500 leading-snug">
                  一鍵套樣式組合，套完還能微調個別控制。上下兩排各挑一個可以疊著用，
                  同一排換另一個會取代掉前一個。
                </p>
                <p className="mb-1 text-[10px] text-stone-400">整段的樣子</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {presets.filter((p) => p.group === "section").map((p) => {
                    const isActive = activePresetByGroup.section === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => applyPreset(p)}
                        title={p.hint}
                        className={`rounded-lg border px-2 py-2 text-xs transition text-left leading-tight ${
                          isActive
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900"
                        }`}
                      >
                        {p.label}
                        {isActive && (
                          <span className="ml-1 text-[10px] font-normal text-emerald-600">· 目前</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 mb-1 text-[10px] text-stone-400">卡片的樣子</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {presets.filter((p) => p.group === "card").map((p) => {
                    const isActive = activePresetByGroup.card === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => applyPreset(p)}
                        title={p.hint}
                        className={`rounded-lg border px-2 py-2 text-xs transition text-left leading-tight ${
                          isActive
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900"
                        }`}
                      >
                        {p.label}
                        {isActive && (
                          <span className="ml-1 text-[10px] font-normal text-emerald-600">· 目前</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div className="mt-3 pt-3 border-t border-stone-200">
                <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-stone-500">
                  常用
                </p>
              </div>
              <Field label="標題對齊">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "left", label: "左" },
                    { v: "center", label: "置中" },
                    { v: "right", label: "右" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ headingAlign: opt.v })}
                      aria-pressed={align === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        align === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="內文對齊">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "auto", label: "同標題" },
                    { v: "left", label: "左" },
                    { v: "center", label: "置中" },
                    { v: "right", label: "右" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ bodyAlign: opt.v })}
                      aria-pressed={(bodyAlign ?? "auto") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (bodyAlign ?? "auto") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>只管段落文字，標題另外走上面那條</span>
                  {bodyAlign && (
                    <button
                      type="button"
                      onClick={() => patch({ bodyAlign: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="一行字數">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "auto", label: "不限制" },
                    { v: "normal", label: "約 34 字" },
                    { v: "narrow", label: "約 24 字" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ bodyMeasure: opt.v })}
                      aria-pressed={(bodyMeasure ?? "auto") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (bodyMeasure ?? "auto") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>長段落收成窄欄好讀，標題與照片不跟著變窄</span>
                  {bodyMeasure && (
                    <button
                      type="button"
                      onClick={() => patch({ bodyMeasure: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="內文大小">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "small", label: "小" },
                    { v: "default", label: "預設" },
                    { v: "large", label: "大" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ bodyScale: opt.v })}
                      aria-pressed={(bodyScale ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (bodyScale ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>只縮放段落文字，標題另有「標題大小」那一組</span>
                  {bodyScale && (
                    <button
                      type="button"
                      onClick={() => patch({ bodyScale: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="內文濃淡">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "muted", label: "淡" },
                    { v: "default", label: "預設" },
                    { v: "strong", label: "濃" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ bodyTone: opt.v })}
                      aria-pressed={(bodyTone ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (bodyTone ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>描述、說明這類次要文字的深淺，選「濃」跟標題一樣深、長描述最好讀</span>
                  {bodyTone && (
                    <button
                      type="button"
                      onClick={() => patch({ bodyTone: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="內文粗細">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "normal", label: "常規" },
                    { v: "medium", label: "中黑" },
                    { v: "bold", label: "粗" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ bodyWeight: opt.v })}
                      aria-pressed={(bodyWeight ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (bodyWeight ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>描述、引言、答案那幾行的粗細，不佔空間也不換顏色就讓字站出來</span>
                  {bodyWeight && (
                    <button
                      type="button"
                      onClick={() => patch({ bodyWeight: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="內文字距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "預設" },
                    { v: "wide", label: "撐開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ bodyTracking: opt.v })}
                      aria-pressed={(bodyTracking ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (bodyTracking ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那幾行字與字之間的距離，只動內文不動大標（上面「字距」是整段一起走）</span>
                  {bodyTracking && (
                    <button
                      type="button"
                      onClick={() => patch({ bodyTracking: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="背景色">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bg ?? "#F7F4ED"}
                    onChange={(e) => patch({ bgColor: e.target.value })}
                    className="h-8 w-12 rounded border border-stone-200"
                  />
                  <input
                    type="text"
                    value={bg ?? ""}
                    onChange={(e) => patch({ bgColor: e.target.value || null })}
                    placeholder="預設用全站背景"
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                  />
                  {bg && (
                    <button
                      type="button"
                      onClick={() => patch({ bgColor: null })}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {bgSwatches.map((sw) => {
                    const active = (bg ?? "").toUpperCase() === sw.c.toUpperCase();
                    return (
                      <button
                        key={sw.label}
                        type="button"
                        title={sw.label}
                        onClick={() => patch({ bgColor: sw.c })}
                        className={`h-6 w-6 rounded-full border transition ${
                          active
                            ? "border-emerald-500 ring-2 ring-emerald-300"
                            : "border-stone-300 hover:border-stone-500"
                        }`}
                        style={{ backgroundColor: sw.c }}
                      />
                    );
                  })}
                </div>
              </Field>
              <Field label="文字顏色">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textCol ?? "#1A1A1A"}
                    onChange={(e) => patch({ textColor: e.target.value })}
                    className="h-8 w-12 rounded border border-stone-200"
                  />
                  <input
                    type="text"
                    value={textCol ?? ""}
                    onChange={(e) => patch({ textColor: e.target.value || null })}
                    placeholder="預設用全站文字色"
                    className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                  />
                  {textCol && (
                    <button
                      type="button"
                      onClick={() => patch({ textColor: null })}
                      className="text-xs text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {textSwatches.map((sw) => {
                    const active = (textCol ?? "").toUpperCase() === sw.c.toUpperCase();
                    return (
                      <button
                        key={sw.label}
                        type="button"
                        title={sw.label}
                        onClick={() => patch({ textColor: sw.c })}
                        className={`h-6 w-6 rounded-full border transition ${
                          active
                            ? "border-emerald-500 ring-2 ring-emerald-300"
                            : "border-stone-300 hover:border-stone-500"
                        }`}
                        style={{ backgroundColor: sw.c }}
                      />
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500">
                  改深色背景時搭淺字、淺色背景搭深字
                </p>
              </Field>
              {(() => {
                // 防呆：文字色跟它疊上去的底色對比太低 → 文字會看不清。
                // 這段沒設自訂背景色時，文字是疊在全站底色（theme.bg）上，就拿底色來比 —
                // 才抓得到「只把文字改成淺色、底色其實還是淺色 → 白字配淺底整段看不見」這種沉默陷阱。
                const sectionBg = bg ?? theme.bg; // 區段實際底色：自訂優先，否則全站底色
                const sectionBgLum = hexLuminance(sectionBg);
                const textLum = textCol ? hexLuminance(textCol) : null;
                let warn: { msg: string; fix: string } | null = null;
                if (sectionBgLum !== null && textLum !== null) {
                  const ratio = contrastRatio(sectionBgLum, textLum);
                  if (ratio < 3) {
                    warn = {
                      msg: `背景跟文字色太接近（對比約 ${ratio.toFixed(1)} 比 1），文字會看不清`,
                      fix: sectionBgLum < 0.4 ? "#FFFFFF" : "#1A1A1A",
                    };
                  }
                } else if (bg !== null && textLum === null) {
                  // 有改深底色、文字色卻還沒設 → 文字會用全站深色，跟深底色糊在一起
                  const bgLum = hexLuminance(bg);
                  if (bgLum !== null && bgLum < 0.18) {
                    warn = {
                      msg: "背景偏深、文字色還沒設 — 文字會用全站的深色，跟背景糊在一起會看不見",
                      fix: "#FFFFFF",
                    };
                  }
                }
                if (!warn) return null;
                return (
                  <div className="-mt-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {warn.msg}
                    </p>
                    <button
                      type="button"
                      onClick={() => patch({ textColor: warn!.fix })}
                      className="mt-1.5 rounded-md border border-amber-400 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100 transition"
                    >
                      {warn.fix === "#FFFFFF" ? "文字改成白色" : "文字改成深色"}
                    </button>
                  </div>
                );
              })()}
              <div className="mt-3 pt-3 border-t border-stone-200">
                <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-stone-500">
                  結構
                </p>
              </div>
              <Field label="這段的上下空白">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "compact", label: "緊湊" },
                    { v: "default", label: "預設" },
                    { v: "spacious", label: "寬鬆" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ paddingScale: opt.v })}
                      aria-pressed={pad === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        pad === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>沒選 = 跟著全站「區段上下空白」</span>
                  {pad && (
                    <button
                      type="button"
                      onClick={() => patch({ paddingScale: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="標題與內容">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "放寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ headingGap: opt.v })}
                      aria-pressed={(headingGap ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (headingGap ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>這段最上面那塊標題跟底下內容之間空多少。標題只有幾個字時中間空太多會像兩段沒關係的東西，選「收緊」；標題底下還有引言、想讓底下的卡片獨立一點時選「放寬」（上面那格調的是整段外圍的上下）</span>
                  {headingGap && (
                    <button
                      type="button"
                      onClick={() => patch({ headingGap: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="標題塊裡面">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "放寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ headingInnerGap: opt.v })}
                      aria-pressed={(headingInnerGap ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (headingInnerGap ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>上面那格調的是這塊標題跟底下卡片之間；這格調的是這塊裡面——小標跟大標之間、大標跟底下那行引言或短線之間。小標寫得長、大標又是兩行時選「收緊」讓三行看起來是同一塊；標題只有兩三個字時選「放寬」</span>
                  {headingInnerGap && (
                    <button
                      type="button"
                      onClick={() => patch({ headingInnerGap: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="小標字距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "撐開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ eyebrowTracking: opt.v })}
                      aria-pressed={(eyebrowTracking ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (eyebrowTracking ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>這段最上面那行小標（大標上面那行小字）每個字之間空多少。中文小標、或字多一點被撐到換行時選「收緊」；英文短詞想要雜誌那種一字一字排開的感覺選「撐開」（整段的「字距」動不到這行，它自己帶著一個值）</span>
                  {eyebrowTracking && (
                    <button
                      type="button"
                      onClick={() => patch({ eyebrowTracking: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="小標字級">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "small", label: "小" },
                    { v: "default", label: "跟預設" },
                    { v: "large", label: "大" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ eyebrowScale: opt.v })}
                      aria-pressed={(eyebrowScale ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (eyebrowScale ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>上面那格調的是那行小標的字距，這格調的是那行字本身多大。小標打中文、在手機上糊成一團看不清楚時選「大」；把小標當這段主標用（大標只有兩個字）也選「大」（「標題大小」動的是大標，這行不跟著動）</span>
                  {eyebrowScale && (
                    <button
                      type="button"
                      onClick={() => patch({ eyebrowScale: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="小標粗細">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "normal", label: "跟預設" },
                    { v: "light", label: "常規" },
                    { v: "medium", label: "中黑" },
                    { v: "bold", label: "粗" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ eyebrowWeight: opt.v })}
                      aria-pressed={(eyebrowWeight ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (eyebrowWeight ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那行小標的字本身多重。小標的字最小、又撐開字距，在淺色底上細到看不清楚時選「中黑」或「粗」；選物與精選那兩段的小標本來就比較重、又是用主色印的，想讓它退回配角選「常規」（「內文粗細」也會動到這行，但會把整段的描述、答案一起變粗）</span>
                  {eyebrowWeight && (
                    <button
                      type="button"
                      onClick={() => patch({ eyebrowWeight: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="小標行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "拉開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ eyebrowLeading: opt.v })}
                      aria-pressed={(eyebrowLeading ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (eyebrowLeading ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>上兩格調的是那行小標的字距與大小，這格調的是它排到兩行時上下隔多遠。小標打長一點、或字級按到「大」之後在手機上換行，兩行散得像兩個小標時選「收緊」（整段的「行高」也動得到這行，但會把底下的描述、答案一起收緊）</span>
                  {eyebrowLeading && (
                    <button
                      type="button"
                      onClick={() => patch({ eyebrowLeading: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="小標用色">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "normal", label: "跟預設" },
                    { v: "accent", label: "主色" },
                    { v: "text", label: "內文色" },
                    { v: "muted", label: "淡" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ eyebrowTone: opt.v })}
                      aria-pressed={(eyebrowTone ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (eyebrowTone ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那行小標是什麼顏色。大部分段落的小標是用全站主色印的，主色深的時候跟底下的大標搶、亮的時候在淺底上糊掉，想讓它退回一般文字選「內文色」或「淡」；合作那段的小標本來就是淡的，想跟別段一致選「主色」（「文字顏色」換的是整段的色，小標帶著自己的顏色反而不會跟著動）</span>
                  {eyebrowTone && (
                    <button
                      type="button"
                      onClick={() => patch({ eyebrowTone: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="小標大小寫">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "upper", label: "全大寫" },
                    { v: "capitalize", label: "字首大寫" },
                    { v: "none", label: "照原樣" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ eyebrowCase: opt.v })}
                      aria-pressed={(eyebrowCase ?? "upper") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (eyebrowCase ?? "upper") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那行小標的英文字母要不要被轉成大寫。前面幾格調的是那行字的字距、大小、粗細、行距、顏色，這格調的是字形本身。小標一律轉全大寫，中文沒有大小寫、按了不會動；打英文的話會被整行拉成大寫——自己的英文店名（Plantae Market → PLANTAE MARKET）或「Est. 2019」想照自己打的樣子顯示選「照原樣」（改輸入框裡的字沒用，大寫是顯示的時候才轉的）</span>
                  {eyebrowCase && (
                    <button
                      type="button"
                      onClick={() => patch({ eyebrowCase: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="分隔線">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "top", label: "上" },
                    { v: "bottom", label: "下" },
                    { v: "both", label: "上下" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ divider: opt.v })}
                      aria-pressed={divider === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        divider === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500">
                  在這段加細線分隔（顏色跟著全網站邊框色）
                </p>
              </Field>
              {/* 粗細只在真的畫了線之後才有東西可調，設成無的段落按了不會有任何反應——
                  跟底線粗細同一個處理，設了線才長出來。 */}
              {divider !== "none" && (
                <Field label="分隔線粗細">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "normal", label: "跟預設" },
                      { v: "medium", label: "中" },
                      { v: "thick", label: "粗" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ dividerWeight: opt.v })}
                        aria-pressed={(dividerWeight ?? "normal") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (dividerWeight ?? "normal") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>預設那條又細又淡，常常看起來像沒畫；段落之間要斷得明確就調粗</span>
                    {dividerWeight && (
                      <button
                        type="button"
                        onClick={() => patch({ dividerWeight: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 深淺跟粗細同一個道理：沒畫線就沒東西可調。粗細那格的說明自己講了
                  「又細又淡」，粗細只救了細那一半，這格補淡那一半。 */}
              {divider !== "none" && (
                <Field label="分隔線深淺">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "normal", label: "跟預設" },
                      { v: "strong", label: "同文字" },
                      { v: "accent", label: "主色" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ dividerTone: opt.v })}
                        aria-pressed={(dividerTone ?? "normal") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (dividerTone ?? "normal") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>調粗了還是看不清就調深：同文字跟這段的字一樣深，主色拿來當裝飾線</span>
                    {dividerTone && (
                      <button
                        type="button"
                        onClick={() => patch({ dividerTone: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 線型跟粗細、深淺同一個道理：沒畫線就沒東西可調。那三格調完線還是只有
                  一種樣子——實線；拿線當裝飾的（深淺那格的主色就是為這個開的）要的是
                  虛線點線那種軟一點的線。 */}
              {divider !== "none" && (
                <Field label="分隔線線型">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "solid", label: "實線" },
                      { v: "dashed", label: "虛線" },
                      { v: "dotted", label: "點線" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ dividerStyle: opt.v })}
                        aria-pressed={(dividerStyle ?? "solid") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (dividerStyle ?? "solid") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>實線像明確的分界，虛線點線比較軟，拿線當裝飾時用</span>
                    {dividerStyle && (
                      <button
                        type="button"
                        onClick={() => patch({ dividerStyle: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              <div className="mt-3 pt-3 border-t border-stone-200">
                <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-stone-500">
                  進階
                </p>
              </div>
              <Field label="標題大小">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "small", label: "小" },
                    { v: "default", label: "預設" },
                    { v: "large", label: "大" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ headingScale: opt.v })}
                      aria-pressed={headingScale === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        headingScale === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>小 0.85x · 預設 1x · 大 1.25x</span>
                  {headingScale && (
                    <button
                      type="button"
                      onClick={() => patch({ headingScale: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="標題粗細">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "light", label: "細" },
                    { v: "normal", label: "預設" },
                    { v: "bold", label: "粗" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ headingWeight: opt.v })}
                      aria-pressed={(headingWeight ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (headingWeight ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                      style={{
                        fontWeight:
                          opt.v === "light" ? 400 : opt.v === "bold" ? 700 : undefined,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>細常規 · 預設維持原樣 · 粗</span>
                  {headingWeight && (
                    <button
                      type="button"
                      onClick={() => patch({ headingWeight: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="標題行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "預設" },
                    { v: "loose", label: "拉開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ headingLeading: opt.v })}
                      aria-pressed={(headingLeading ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (headingLeading ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>標題換行後兩行之間的距離</span>
                  {headingLeading && (
                    <button
                      type="button"
                      onClick={() => patch({ headingLeading: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="標題字距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "預設" },
                    { v: "wide", label: "撐開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ headingTracking: opt.v })}
                      aria-pressed={(headingTracking ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (headingTracking ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                      style={{
                        letterSpacing:
                          opt.v === "tight" ? "-0.05em" : opt.v === "wide" ? "0.08em" : undefined,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>
                    上一格調的是大標換行後上下的距離，這格調的是同一行裡字跟字之間的距離。大標
                    打中文、筆畫多的字黏在一起時選撐開（「字距」那格動的是整段，內文會跟著散開）
                  </span>
                  {headingTracking && (
                    <button
                      type="button"
                      onClick={() => patch({ headingTracking: null })}
                      className="text-stone-500 hover:text-stone-800 underline whitespace-nowrap"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="標題用色">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "default", label: "預設" },
                    { v: "accent", label: "主色" },
                    { v: "muted", label: "柔和" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ headingTone: opt.v })}
                      aria-pressed={(headingTone ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (headingTone ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>只動標題：主色跟小標同色、柔和跟次要文字同深淺</span>
                  {headingTone && (
                    <button
                      type="button"
                      onClick={() => patch({ headingTone: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="標題底線">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "short", label: "短線" },
                    { v: "full", label: "整條" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ headingRule: opt.v })}
                      aria-pressed={(headingRule ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (headingRule ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>畫在標題底下，跟著標題對齊走</span>
                  {headingRule && (
                    <button
                      type="button"
                      onClick={() => patch({ headingRule: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              {/* 粗細只在真的畫了線之後才有東西可調，設成無的段落按了不會有任何反應——
                  跟照片佔寬同一個處理，設了線才長出來。 */}
              {headingRule && (
                <Field label="底線粗細">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "thin", label: "細" },
                      { v: "normal", label: "跟預設" },
                      { v: "thick", label: "粗" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ headingRuleWeight: opt.v })}
                        aria-pressed={(headingRuleWeight ?? "normal") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (headingRuleWeight ?? "normal") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>標題調大的段落用粗一點才配得上，整條橫過整個螢幕時用細的才不會比標題還搶眼</span>
                    {headingRuleWeight && (
                      <button
                        type="button"
                        onClick={() => patch({ headingRuleWeight: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 深淺跟粗細同一個道理：沒畫線就沒東西可調。分隔線那組三格都補齊了，
                  這條畫在標題正下方、最像雜誌開章那個手勢的線反而沒有主色可選；
                  深底淺字的段落淡色線更是直接看不見。 */}
              {headingRule && (
                <Field label="底線深淺">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "normal", label: "跟預設" },
                      { v: "strong", label: "同文字" },
                      { v: "accent", label: "主色" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ headingRuleTone: opt.v })}
                        aria-pressed={(headingRuleTone ?? "normal") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (headingRuleTone ?? "normal") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>深底的段落看不到線就調深：同文字跟這段的字一樣深，主色是標題底下壓色線那種用法</span>
                    {headingRuleTone && (
                      <button
                        type="button"
                        onClick={() => patch({ headingRuleTone: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 線型跟粗細、深淺同一個道理：沒畫線就沒東西可調。分隔線那格開了虛線點線
                  之後，最常拿來當裝飾的這條線反而還是只有實線一種語氣。 */}
              {headingRule && (
                <Field label="底線線型">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "solid", label: "實線" },
                      { v: "dashed", label: "虛線" },
                      { v: "dotted", label: "點線" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ headingRuleStyle: opt.v })}
                        aria-pressed={(headingRuleStyle ?? "solid") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (headingRuleStyle ?? "solid") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>實線像明確的收尾，虛線點線比較軟，標題底下壓裝飾線時用</span>
                    {headingRuleStyle && (
                      <button
                        type="button"
                        onClick={() => patch({ headingRuleStyle: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              <Field label="最小高度">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "auto", label: "普通" },
                    { v: "tall", label: "高" },
                    { v: "fullscreen", label: "滿屏" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ minHeight: opt.v })}
                      aria-pressed={minHeight === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        minHeight === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>普通 跟著內容 · 高 80vh · 滿屏 100vh</span>
                  {minHeight && (
                    <button
                      type="button"
                      onClick={() => patch({ minHeight: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="內容垂直位置">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "top", label: "靠上" },
                    { v: "middle", label: "置中" },
                    { v: "bottom", label: "靠下" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ contentAlign: opt.v })}
                      aria-pressed={(contentAlign ?? "top") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (contentAlign ?? "top") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 leading-snug">
                  這一段比內容高的時候，多出來的空白留在哪邊。要先把上面的「最小高度」設成高或滿屏才看得出差別
                </p>
              </Field>
              <Field label="在這台裝置隱藏">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "都顯示" },
                    { v: "mobile", label: "手機" },
                    { v: "desktop", label: "桌機" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ hideOn: opt.v })}
                      aria-pressed={(hideOn ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (hideOn ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 leading-snug">
                  橫著排的段落（合作品牌、照片牆）到手機上會擠成一長條，這裡可以只讓它在手機不出現，桌機照舊。平板一律顯示。編輯畫布上會留在原地淡掉、框一圈虛線，客人那邊是真的看不到
                </p>
              </Field>
              <Field label="區段寬度">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "full", label: "滿版" },
                    { v: "boxed", label: "置中" },
                    { v: "narrow", label: "窄欄" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ sectionWidth: opt.v })}
                      aria-pressed={(sectionWidth ?? "full") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (sectionWidth ?? "full") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 leading-snug">
                  滿版 寬度撐滿 · 置中 1100px · 窄欄 760px。配背景色 + 陰影 + 圓角就成置中的卡片式區段
                </p>
              </Field>
              <Field label="內容欄寬">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "narrow", label: "窄" },
                    { v: "normal", label: "照原本" },
                    { v: "wide", label: "寬" },
                    { v: "full", label: "滿版" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ contentWidth: opt.v })}
                      aria-pressed={(contentWidth ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (contentWidth ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 leading-snug">
                  這一段的字跟卡片排多寬。上面那格「區段寬度」收的是這一段的底色跟外框畫到哪，裡面的字跟卡片不會跟著動，這格才是。窄 768px · 照原本 1024px（照片牆 1152px）· 寬 1280px · 滿版 排到畫面左右邊界為止。卡片調成 4 欄、或想讓照片牆變成跨頁大圖時用這格
                </p>
              </Field>
              <Field label="內容欄位置">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "left", label: "靠左" },
                    { v: "center", label: "置中" },
                    { v: "right", label: "靠右" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ contentAlignX: opt.v })}
                      aria-pressed={(contentAlignX ?? "center") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (contentAlignX ?? "center") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 leading-snug">
                  上面那格排出來的欄擺在這一段的哪一邊。平常置中；把欄寬設成窄之後選靠左，字會貼著跟導覽列同一道左邊界起排（雜誌常見的收法）。跟「區段對齊」不一樣——那格是欄裡每行字各自靠哪邊，這格是整道欄搬家。欄寬選滿版時欄已經佔滿，這格看不出差別
                </p>
              </Field>
              <Field label="內容欄內距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收窄" },
                    { v: "normal", label: "照原本" },
                    { v: "wide", label: "加寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ contentPadX: opt.v })}
                      aria-pressed={(contentPadX ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (contentPadX ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 leading-snug">
                  這道欄自己左右兩側留多少空白。照原本是跟導覽列、商品同一道邊界（手機 32px · 電腦 48px）。欄寬選了滿版之後，字跟卡片離畫面邊多遠就是這格在管：照片牆想幾乎頂到邊選收窄；想讓整段四周留一大片白、字只佔中間選加寬。手機上會自動縮小一點，不會擠成一條
                </p>
              </Field>
              <Field label="區段外距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "貼緊" },
                    { v: "normal", label: "適中" },
                    { v: "large", label: "寬鬆" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ sectionGap: opt.v })}
                      aria-pressed={(sectionGap ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (sectionGap ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 leading-snug">
                  貼緊 跟上下區段相連 · 適中 64px · 寬鬆 112px。做置中卡片式區段時，留外距才能讓卡片從上下拉開、浮出來
                </p>
              </Field>
              <Field label="外框">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "subtle", label: "細邊" },
                    { v: "strong", label: "粗邊" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ outline: opt.v })}
                      aria-pressed={(outline ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (outline ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>細邊 1px · 粗邊 2px（用全網站邊框色，不影響 layout）</span>
                  {outline && (
                    <button
                      type="button"
                      onClick={() => patch({ outline: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              {/* 深淺跟分隔線那格同一個道理：沒畫框就沒東西可調。四條線裡分隔線、
                  標題底線、側邊色條的深淺都開了，外框是最後一條顏色寫死的——預設那個
                  淡色圈在淺底上幾乎看不出有框，粗邊也救不回來。 */}
              {outline && outline !== "none" && (
                <Field label="外框深淺">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "normal", label: "跟預設" },
                      { v: "strong", label: "同文字" },
                      { v: "accent", label: "主色" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ outlineTone: opt.v })}
                        aria-pressed={(outlineTone ?? "normal") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (outlineTone ?? "normal") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>選了粗邊還是看不出框就調深：同文字跟這段的字一樣深，主色描邊像優惠卡</span>
                    {outlineTone && (
                      <button
                        type="button"
                        onClick={() => patch({ outlineTone: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 線型跟深淺同一個道理：沒畫框就沒東西可調。四條線的線型這格補到外框
                  才全齊——一圈實線是名片框的正式語氣，虛線是優惠券「沿線剪下」那圈。 */}
              {outline && outline !== "none" && (
                <Field label="外框線型">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "solid", label: "實線" },
                      { v: "dashed", label: "虛線" },
                      { v: "dotted", label: "點線" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ outlineStyle: opt.v })}
                        aria-pressed={(outlineStyle ?? "solid") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (outlineStyle ?? "solid") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>實線正式，虛線配主色像優惠券的沿線剪下，點線是手帳貼紙那圈</span>
                    {outlineStyle && (
                      <button
                        type="button"
                        onClick={() => patch({ outlineStyle: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              <Field label="側邊色條">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "left", label: "左邊" },
                    { v: "right", label: "右邊" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ accentBar: opt.v })}
                      aria-pressed={(accentBar ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (accentBar ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>邊緣一條粗色條，用來標重點段落（4px）</span>
                  {accentBar && (
                    <button
                      type="button"
                      onClick={() => patch({ accentBar: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              {/* 粗細只在真的畫了色條之後才有東西可調——跟底線粗細同一個處理，
                  設了色條才長出來。 */}
              {accentBar && (
                <Field label="色條粗細">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "thin", label: "細" },
                      { v: "normal", label: "跟預設" },
                      { v: "thick", label: "粗" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ accentBarWeight: opt.v })}
                        aria-pressed={(accentBarWeight ?? "normal") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (accentBarWeight ?? "normal") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>窄欄的段落用細一點才不搶內文，滿屏的段落要粗才立得住</span>
                    {accentBarWeight && (
                      <button
                        type="button"
                        onClick={() => patch({ accentBarWeight: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 深淺跟粗細同一個處理：沒畫色條就沒東西可調。四檔不是三檔——色條的
                  顏色有兩種寫死值（沒設文字色＝主色、設了＝文字色六成淡），跟小標用色
                  一樣要讓兩種能互相切換。 */}
              {accentBar && (
                <Field label="色條深淺">
                  <div className="grid grid-cols-4 gap-1.5">
                    {([
                      { v: "normal", label: "跟預設" },
                      { v: "soft", label: "淡" },
                      { v: "strong", label: "同文字" },
                      { v: "accent", label: "主色" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ accentBarTone: opt.v })}
                        aria-pressed={(accentBarTone ?? "normal") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (accentBarTone ?? "normal") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>粗色條太搶就淡，退成裝飾；同文字跟這段的字一樣深，主色是品牌色實色</span>
                    {accentBarTone && (
                      <button
                        type="button"
                        onClick={() => patch({ accentBarTone: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 線型跟粗細、深淺同一個處理：沒畫色條就沒東西可調。三條線的線型這格
                  是最後補上的一條——色條偏偏最當裝飾用，實心帶再淡還是一塊面。 */}
              {accentBar && (
                <Field label="色條線型">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "solid", label: "實線" },
                      { v: "dashed", label: "虛線" },
                      { v: "dotted", label: "點線" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ accentBarStyle: opt.v })}
                        aria-pressed={(accentBarStyle ?? "solid") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (accentBarStyle ?? "solid") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>實線是一塊面，虛線點線有孔隙、當裝飾更輕；粗的點線會變一排圓點</span>
                    {accentBarStyle && (
                      <button
                        type="button"
                        onClick={() => patch({ accentBarStyle: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              <Field label="陰影">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "soft", label: "淺" },
                    { v: "deep", label: "深" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ shadow: opt.v })}
                      aria-pressed={(shadow ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (shadow ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>有設背景色的 section 加陰影像卡片浮起來</span>
                  {shadow && (
                    <button
                      type="button"
                      onClick={() => patch({ shadow: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="圓角">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "soft", label: "微圓" },
                    { v: "strong", label: "大圓" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ borderRadius: opt.v })}
                      aria-pressed={(borderRadius ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (borderRadius ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>微圓 16px · 大圓 32px（搭配背景色 / 陰影像卡片）</span>
                  {borderRadius && (
                    <button
                      type="button"
                      onClick={() => patch({ borderRadius: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="照片圓角">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "直角" },
                    { v: "soft", label: "微圓" },
                    { v: "round", label: "圓潤" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ mediaRadius: opt.v })}
                      aria-pressed={(mediaRadius ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (mediaRadius ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>只圓這一段裡的照片（上面那欄圓的是整段的框）</span>
                  {mediaRadius && (
                    <button
                      type="button"
                      onClick={() => patch({ mediaRadius: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="照片比例">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "auto", label: "預設" },
                    { v: "square", label: "正方" },
                    { v: "portrait", label: "直式" },
                    { v: "landscape", label: "橫式" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ mediaAspect: opt.v })}
                      aria-pressed={(mediaAspect ?? "auto") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (mediaAspect ?? "auto") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>換這一段照片框的裁法（直式商品選「直式」不會被裁頭去尾）</span>
                  {mediaAspect && (
                    <button
                      type="button"
                      onClick={() => patch({ mediaAspect: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="照片取景">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "auto", label: "置中" },
                    { v: "top", label: "靠上" },
                    { v: "bottom", label: "靠下" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ mediaFocus: opt.v })}
                      aria-pressed={(mediaFocus ?? "auto") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (mediaFocus ?? "auto") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>照片被框裁掉時保留哪一端（直式商品照選「靠上」保住瓶口、葉冠）</span>
                  {mediaFocus && (
                    <button
                      type="button"
                      onClick={() => patch({ mediaFocus: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="照片左右取景">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "left", label: "靠左" },
                    { v: "auto", label: "置中" },
                    { v: "right", label: "靠右" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ mediaFocusX: opt.v })}
                      aria-pressed={(mediaFocusX ?? "auto") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (mediaFocusX ?? "auto") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>橫式照片放進正方或直式的框時保留哪一側，可跟上面那格疊著用</span>
                  {mediaFocusX && (
                    <button
                      type="button"
                      onClick={() => patch({ mediaFocusX: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="照片完整度">
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { v: "cover", label: "鋪滿框" },
                    { v: "contain", label: "整張顯示" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ mediaFit: opt.v })}
                      aria-pressed={(mediaFit ?? "cover") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (mediaFit ?? "cover") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>整張顯示＝照片一點都不裁，放不滿的地方露出底色（整株盆栽、帶留白的商品圖）</span>
                  {mediaFit && (
                    <button
                      type="button"
                      onClick={() => patch({ mediaFit: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              {/* 框底色只在選了「整張顯示」之後才長出來：鋪滿框的時候照片蓋住整個框，
                  框的底根本看不到，擺出來會是按了畫面不動的死按鈕。 */}
              {mediaFit === "contain" && (
                <Field label="框底色">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "auto", label: "跟段落" },
                      { v: "white", label: "白" },
                      { v: "dark", label: "深" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ mediaFrameBg: opt.v, mediaFrameColor: null })}
                        aria-pressed={!mediaFrameColor && (mediaFrameBg ?? "auto") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          !mediaFrameColor && (mediaFrameBg ?? "auto") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {/* 自訂色跟上面三檔互斥：挑了色就清掉三檔、按了三檔就清掉色。不然商家按「白」
                      畫面卻停在自訂色，會以為那顆按鈕壞了。白 / 深是寫死的純白與暖黑，商品圖的
                      底不一定是那兩種（圖庫圖常見的灰白、自拍的淡奶油底），這格讓商家直接對色。 */}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={mediaFrameColor ?? "#FFFFFF"}
                      onChange={(e) => patch({ mediaFrameColor: e.target.value, mediaFrameBg: null })}
                      className="h-8 w-12 rounded border border-stone-200"
                      aria-label="框底色自訂色"
                    />
                    <input
                      type="text"
                      value={mediaFrameColor ?? ""}
                      onChange={(e) =>
                        patch({ mediaFrameColor: e.target.value || null, mediaFrameBg: null })
                      }
                      placeholder="或直接填色碼，例如 #F5F5F5"
                      className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>照片放不滿的邊露出的底色。白底商品圖選「白」會跟照片接成一片；圖的底不是純白就填它的色碼</span>
                    {(mediaFrameBg || mediaFrameColor) && (
                      <button
                        type="button"
                        onClick={() => patch({ mediaFrameBg: null, mediaFrameColor: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 這兩格只在合作夥伴那段列出來：規則落在那排 logo 上，別段沒有這種 img，
                  擺出來會是按了畫面不動的死按鈕（其他段的卡片照片歸上面那四格管）。 */}
              {selectedSection === "partners" && (
                <>
              <Field label="合作 logo 大小">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "small", label: "小" },
                    { v: "default", label: "跟預設" },
                    { v: "large", label: "大" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ partnerLogoScale: opt.v })}
                      aria-pressed={(partnerLogoScale ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (partnerLogoScale ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那排 logo 本身多高（手機 / 平板 / 桌機一起跟著調）。預設值是照橫式字標挑的，方形的商圈標章、上圖下字的兩層式 logo 在裡面只剩一小塊是字，選大才認得出來；只放兩三個 logo 想排得安靜一點就選小。上面那幾格照片的設定管的是卡片裡的照片，動不到這排</span>
                  {partnerLogoScale && (
                    <button
                      type="button"
                      onClick={() => patch({ partnerLogoScale: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="合作 logo 濃淡">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "faint", label: "更淡" },
                    { v: "default", label: "跟預設" },
                    { v: "solid", label: "清楚" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ partnerLogoOpacity: opt.v })}
                      aria-pressed={(partnerLogoOpacity ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (partnerLogoOpacity ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那排 logo 印得多淡。預設是半透明（滑鼠移上去才變清楚，手機沒有這個動作），要客人認出是哪家媒體、哪個品牌就選清楚；當背景紋理排一整列就選更淡。「淡化」那格淡的是整段連小標一起，「濾鏡」換的是黑白或復古，都不是這一層</span>
                  {partnerLogoOpacity && (
                    <button
                      type="button"
                      onClick={() => patch({ partnerLogoOpacity: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
                </>
              )}
              <Field label="卡片間距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "緊湊" },
                    { v: "normal", label: "預設" },
                    { v: "loose", label: "寬鬆" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ gridGap: opt.v })}
                      aria-pressed={(gridGap ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (gridGap ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>調這一段卡片、照片彼此的距離（不是段落外圍的空白）</span>
                  {gridGap && (
                    <button
                      type="button"
                      onClick={() => patch({ gridGap: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="滑過卡片">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "default", label: "預設" },
                    { v: "calm", label: "輕微" },
                    { v: "none", label: "不動" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardHover: opt.v })}
                      aria-pressed={(cardHover ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardHover ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>滑鼠移到卡片上要不要動（照片放大、浮起、壓暗；手機沒有這件事）</span>
                  {cardHover && (
                    <button
                      type="button"
                      onClick={() => patch({ cardHover: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片文字">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "auto", label: "跟著整段" },
                    { v: "left", label: "靠左" },
                    { v: "center", label: "置中" },
                    { v: "right", label: "靠右" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardText: opt.v })}
                      aria-pressed={(cardText ?? "auto") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardText ?? "auto") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>卡片下面的品名、價錢站哪（大標置中、卡片文字靠左最常見）</span>
                  {cardText && (
                    <button
                      type="button"
                      onClick={() => patch({ cardText: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片外觀">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "原樣" },
                    { v: "panel", label: "淡底色" },
                    { v: "outline", label: "細框" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardSurface: opt.v })}
                      aria-pressed={(cardSurface ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardSurface ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>每張卡片有沒有自己的邊界（欄數多、品名長短不一時，有底或有框才分得出哪行字配哪張照片）</span>
                  {cardSurface && (
                    <button
                      type="button"
                      onClick={() => patch({ cardSurface: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              {/* 內距只在卡片真的有底或有框之後才看得出來（沒邊界的話那圈是看不見的空白），
                  跟底線粗細同一個處理，設了外觀才長出來。 */}
              {cardSurface && (
                <Field label="卡片內距">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "tight", label: "收緊" },
                      { v: "normal", label: "跟預設" },
                      { v: "loose", label: "放寬" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ cardPadding: opt.v })}
                        aria-pressed={(cardPadding ?? "normal") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (cardPadding ?? "normal") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>卡片裡的東西跟框之間留多少（一列四張的小卡收緊、一列一張的大卡放寬，圓角跟著一起走）</span>
                    {cardPadding && (
                      <button
                        type="button"
                        onClick={() => patch({ cardPadding: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              <Field label="卡片排法">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "stack", label: "照片在上" },
                    { v: "side", label: "照片在左" },
                    { v: "side-reverse", label: "照片在右" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardLayout: opt.v })}
                      aria-pressed={(cardLayout ?? "stack") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardLayout ?? "stack") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>照片在左＝一般網購站的清單模式，一個螢幕看得到的品項多很多；照片在右先讀到字，適合先講故事的段落（兩者手機都自動收成一列一張）</span>
                  {cardLayout && (
                    <button
                      type="button"
                      onClick={() => patch({ cardLayout: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              {/* 照片佔寬只在橫著排的時候有東西可分，照片在上那檔按了不會有任何反應——
                  與其擺一格按下去沒事發生的選項，設成橫排才長出來。 */}
              {(cardLayout === "side" || cardLayout === "side-reverse") && (
                <Field label="照片佔寬">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "auto", label: "跟預設" },
                      { v: "narrow", label: "小張" },
                      { v: "wide", label: "大張" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ cardMediaWidth: opt.v })}
                        aria-pressed={(cardMediaWidth ?? "auto") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (cardMediaWidth ?? "auto") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>橫著排時照片佔一張卡的幾成寬（跟預設約四成）。字多的段落用小張讓文字有寬度寫完整，配橫幅生活照的段落用大張</span>
                    {cardMediaWidth && (
                      <button
                        type="button"
                        onClick={() => patch({ cardMediaWidth: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              <Field label="手機一列幾張">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "auto", label: "跟預設" },
                    { v: "one", label: "一張" },
                    { v: "two", label: "兩張" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ mobileColumns: opt.v })}
                      aria-pressed={(mobileColumns ?? "auto") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (mobileColumns ?? "auto") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>只管手機畫面（上面那個「一列幾張」調的是桌機）。小商品用兩張一次看得多，主打商品、橫幅照片用一張看得清楚</span>
                  {mobileColumns && (
                    <button
                      type="button"
                      onClick={() => patch({ mobileColumns: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片標題行數">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "auto", label: "跟預設" },
                    { v: "one", label: "一行" },
                    { v: "two", label: "兩行" },
                    { v: "full", label: "完整" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardTitleLines: opt.v })}
                      aria-pressed={(cardTitleLines ?? "auto") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardTitleLines ?? "auto") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>卡片上那行品名（或文章標題）最多顯示幾行。精選商品原本只顯示一行，品名帶規格的選「完整」才看得完；標題長短不一撐得卡片高低不齊時選固定行數</span>
                  {cardTitleLines && (
                    <button
                      type="button"
                      onClick={() => patch({ cardTitleLines: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片描述行數">
                <div className="grid grid-cols-5 gap-1.5">
                  {([
                    { v: "auto", label: "跟預設" },
                    { v: "one", label: "一行" },
                    { v: "two", label: "兩行" },
                    { v: "three", label: "三行" },
                    { v: "full", label: "完整" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardDescLines: opt.v })}
                      aria-pressed={(cardDescLines ?? "auto") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardDescLines ?? "auto") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>品名底下那段描述最多顯示幾行（選物的副標、慢讀的摘要）。描述長短不一撐得同一列卡片高低不齊時選固定行數；精選商品那段底下是價錢，不受這格影響</span>
                  {cardDescLines && (
                    <button
                      type="button"
                      onClick={() => patch({ cardDescLines: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片標題字級">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "small", label: "小" },
                    { v: "default", label: "跟預設" },
                    { v: "large", label: "大" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardTitleScale: opt.v })}
                      aria-pressed={(cardTitleScale ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardTitleScale ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>卡片上那行品名（或文章標題）本身多大，上面兩格管的是它佔幾行。卡片變寬（欄數少、照片在左）時選大，一列四張的小卡選小</span>
                  {cardTitleScale && (
                    <button
                      type="button"
                      onClick={() => patch({ cardTitleScale: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片標題粗細">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "normal", label: "常規" },
                    { v: "medium", label: "中黑" },
                    { v: "bold", label: "粗" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardTitleWeight: opt.v })}
                      aria-pressed={(cardTitleWeight ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardTitleWeight ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>上一格管的是品名多大，這格管的是它多粗。品名跟底下的描述、價錢分不出主次時選中黑或粗（「標題粗細」那格動的是段落大標，不是卡片裡這行）</span>
                  {cardTitleWeight && (
                    <button
                      type="button"
                      onClick={() => patch({ cardTitleWeight: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片標題行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "拉開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardTitleLeading: opt.v })}
                      aria-pressed={(cardTitleLeading ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardTitleLeading ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>品名排到兩行以上時，上下兩行之間隔多遠（品名只有一行的話這格看不出差別）。「卡片標題行數」選了兩行或完整、或品名本來就長的段落才用得到：兩行中文黏在一起就拉開，字級調大之後間隙太空就收緊。「卡片行距」那格調的是品名跟照片、價錢之間，不是同一行字自己換行</span>
                  {cardTitleLeading && (
                    <button
                      type="button"
                      onClick={() => patch({ cardTitleLeading: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片品名字距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "撐開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardTitleTracking: opt.v })}
                      aria-pressed={(cardTitleTracking ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardTitleTracking ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>品名同一行裡，字與字之間空多少。筆畫多的中文品名（像「觀葉植物」）字級一大就會跟隔壁黏在一起，撐開一點看得清楚；只有兩三個字的短品名撐開會更像選物店。上一格「卡片標題行距」調的是換行之後上下隔多遠，這格是同一行左右之間。只動品名，描述、價錢與那幾行小字不跟著變</span>
                  {cardTitleTracking && (
                    <button
                      type="button"
                      onClick={() => patch({ cardTitleTracking: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片品名用色">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "default", label: "預設" },
                    { v: "accent", label: "主色" },
                    { v: "muted", label: "柔和" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardTitleTone: opt.v })}
                      aria-pressed={(cardTitleTone ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardTitleTone ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>卡片上那行品名是什麼顏色。三段的品名本來都跟內文同深，整張卡上沒有一個顏色的落點，品名跟底下的描述、價錢只差在字大一點；換成主色能讓客人掃過一列卡片時先看到商品名，柔和則是讓品名退半階、把重量留給照片。上面幾格動的是字多大、多粗、隔多遠，都不換顏色。只動品名，描述、價錢與那幾行小字不跟著變</span>
                  {cardTitleTone && (
                    <button
                      type="button"
                      onClick={() => patch({ cardTitleTone: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片描述字級">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "small", label: "小" },
                    { v: "default", label: "跟預設" },
                    { v: "large", label: "大" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardDescScale: opt.v })}
                      aria-pressed={(cardDescScale ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardDescScale ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>品名底下那段描述本身多大（選物的副標、慢讀的摘要）。想讓摘要真的被讀完選大，品名調大之後想讓描述退一步選小；精選商品那段底下是價錢，不受這格影響</span>
                  {cardDescScale && (
                    <button
                      type="button"
                      onClick={() => patch({ cardDescScale: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片描述行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "拉開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardDescLeading: opt.v })}
                      aria-pressed={(cardDescLeading ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardDescLeading ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那段描述排到第二行以後，上下兩行之間隔多遠。原本選物那邊照英文短句的密度排（兩行中文會黏在一起，選拉開）、慢讀那邊排得比較鬆（一段話會散開，選收緊）。「卡片行距」那格調的是描述跟品名、照片之間，不是同一段字自己換行</span>
                  {cardDescLeading && (
                    <button
                      type="button"
                      onClick={() => patch({ cardDescLeading: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片描述粗細">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "normal", label: "常規" },
                    { v: "medium", label: "中黑" },
                    { v: "bold", label: "粗" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardDescWeight: opt.v })}
                      aria-pressed={(cardDescWeight ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardDescWeight ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那段描述的筆畫多粗。原本是最細的一級、又被「卡片副文字深淺」淡過一層，慢讀那種客人真的要讀的摘要在卡片上輕得像圖說，想讓它站出來選中黑或粗；小卡上描述只是一句副標、想讓品名獨大就留常規</span>
                  {cardDescWeight && (
                    <button
                      type="button"
                      onClick={() => patch({ cardDescWeight: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片描述字距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "撐開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardDescTracking: opt.v })}
                      aria-pressed={(cardDescTracking ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardDescTracking ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那段描述同一行裡，字與字之間空多少。把品名字距撐開之後，底下那句副標還是原本的密度，一鬆一緊疊在同一張卡上——這格讓描述跟得上；慢讀那種一整段的摘要收緊一點能多塞回半行。只動描述，品名、價錢與那幾行小字不跟著變</span>
                  {cardDescTracking && (
                    <button
                      type="button"
                      onClick={() => patch({ cardDescTracking: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片描述用色">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "default", label: "跟預設" },
                    { v: "accent", label: "主色" },
                    { v: "text", label: "跟品名同深" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardDescTone: opt.v })}
                      aria-pressed={(cardDescTone ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardDescTone ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>前面三格動的是那段描述多大、行距多開、多粗，這格動的是它什麼顏色。描述現在固定比品名淡一階（選物那段外面還多淡一層），放大、加粗都追不上那個淺灰——慢讀那種摘要才是客人要讀完的段落，選「跟品名同深」就不再退在後面；想讓副標帶點品牌感選「主色」</span>
                  {cardDescTone && (
                    <button
                      type="button"
                      onClick={() => patch({ cardDescTone: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片小字字級">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "small", label: "小" },
                    { v: "default", label: "跟預設" },
                    { v: "large", label: "大" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardMicroScale: opt.v })}
                      aria-pressed={(cardMicroScale ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardMicroScale ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>卡片上那幾行全大寫的小字多大（選物卡片底下的「看更多」、慢讀卡片的分類與標籤、精選商品價錢底下的「剩 N」）。那行只有 10px，是照英文挑的，中文擠在裡面會糊成一條灰線看不出是字，選大能救回來</span>
                  {cardMicroScale && (
                    <button
                      type="button"
                      onClick={() => patch({ cardMicroScale: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片小字字距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "撐開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardMicroTracking: opt.v })}
                      aria-pressed={(cardMicroTracking ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardMicroTracking ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>上一格那幾行小字，字跟字之間空多少。那個間隙是照英文短詞挑的，中文放進去會變成一個個站開的單字、在手機上還會被撐到換行——中文小字選收緊，英文短詞想要雜誌感選撐開</span>
                  {cardMicroTracking && (
                    <button
                      type="button"
                      onClick={() => patch({ cardMicroTracking: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片小字行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "拉開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardMicroLeading: opt.v })}
                      aria-pressed={(cardMicroLeading ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardMicroLeading ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>同樣那幾行小字排到第二行時，上下兩行隔多遠。它們沒有自己的行距、跟著整段內文走（那是給一整段文字挑的值），套在那麼小的字上兩行之間空得比字還高——分類、標籤打長一點就會換行，選收緊讓兩行貼回一組</span>
                  {cardMicroLeading && (
                    <button
                      type="button"
                      onClick={() => patch({ cardMicroLeading: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片小字粗細">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "normal", label: "跟預設" },
                    { v: "light", label: "常規" },
                    { v: "medium", label: "中黑" },
                    { v: "bold", label: "粗" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardMicroWeight: opt.v })}
                      aria-pressed={(cardMicroWeight ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardMicroWeight ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>同樣那幾行小字的筆畫多粗。「看更多」、分類、標籤那三行是最細的一級，10px 又撐開字距，在淺色底上看起來像一條灰線不像字，想讓客人看得出那裡可以點選「中黑」或「粗」；精選商品那行「剩 N」本來就比較重、又是琥珀色，想讓它退成一句提示選「常規」</span>
                  {cardMicroWeight && (
                    <button
                      type="button"
                      onClick={() => patch({ cardMicroWeight: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片小字用色">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "normal", label: "跟預設" },
                    { v: "accent", label: "主色" },
                    { v: "text", label: "跟品名同深" },
                    { v: "muted", label: "淡" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardMicroTone: opt.v })}
                      aria-pressed={(cardMicroTone ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardMicroTone ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>前面三格動的是那幾行小字多大、字距多開、多粗，這格動的是它們什麼顏色。那幾行現在各是各的顏色：「看更多」跟慢讀的分類用主色、慢讀底下的標籤是淡灰、精選那行「剩 N」是橘色的警示色（跟店的配色沒關係）。主色深就跟品名撞在一起、主色亮在淺底上看不見、橘色那行又比價錢還搶——想讓整張卡的小字統一，四個都會一起換</span>
                  {cardMicroTone && (
                    <button
                      type="button"
                      onClick={() => patch({ cardMicroTone: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片小字大小寫">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "upper", label: "全大寫" },
                    { v: "capitalize", label: "字首大寫" },
                    { v: "none", label: "照原樣" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardMicroCase: opt.v })}
                      aria-pressed={(cardMicroCase ?? "upper") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardMicroCase ?? "upper") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>同樣那幾行小字的英文字母要不要被轉成大寫。前面五格調的是它們多大、字距多開、換行後隔多遠、多粗、什麼顏色，這格調的是字形本身。那幾行一律轉全大寫，中文沒有大小寫、按了不會動；打英文就會被整行拉大寫——「Shop all」變 SHOP ALL、自己訂的分類標籤（Care 照顧只有前半被改）、好評那行的職稱或 IG 帳號，想照自己打的樣子顯示選「照原樣」（改輸入框裡的字沒用，大寫是顯示的時候才轉的）</span>
                  {cardMicroCase && (
                    <button
                      type="button"
                      onClick={() => patch({ cardMicroCase: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片價錢字級">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "small", label: "小" },
                    { v: "default", label: "跟預設" },
                    { v: "large", label: "大" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardPriceScale: opt.v })}
                      aria-pressed={(cardPriceScale ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardPriceScale ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>精選商品卡片上那行價錢多大。價錢只有 14px、比品名還小一級，客人在首頁掃過去常常正是在找它；品名調大之後想讓價錢跟上也是這格。只有精選商品那段的卡片有價錢，其他段不受影響</span>
                  {cardPriceScale && (
                    <button
                      type="button"
                      onClick={() => patch({ cardPriceScale: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片價錢粗細">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "normal", label: "常規" },
                    { v: "medium", label: "中黑" },
                    { v: "bold", label: "粗" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardPriceWeight: opt.v })}
                      aria-pressed={(cardPriceWeight ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardPriceWeight ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>上一格管的是價錢多大，這格管的是它多粗。想讓價錢一眼看得到，加粗比放大省——不會把卡片下半撐開，也不用改顏色；反過來想讓首頁先講商品不先講價，就留常規。同樣只有精選商品那段的卡片有價錢</span>
                  {cardPriceWeight && (
                    <button
                      type="button"
                      onClick={() => patch({ cardPriceWeight: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片價錢字距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "wide", label: "撐開" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardPriceTracking: opt.v })}
                      aria-pressed={(cardPriceTracking ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardPriceTracking ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>那行價錢同一行裡，數字與數字之間空多少。把品名字距撐開之後，貼在底下的價錢還是原本的密度，一鬆一緊疊在同一張卡上——這格讓價錢跟得上；撐開一點也有實體標價牌那種數字隔開的味道。只動價錢，品名、描述與那幾行小字不跟著變</span>
                  {cardPriceTracking && (
                    <button
                      type="button"
                      onClick={() => patch({ cardPriceTracking: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片價錢用色">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "default", label: "預設" },
                    { v: "accent", label: "主色" },
                    { v: "text", label: "跟品名同深" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardPriceTone: opt.v })}
                      aria-pressed={(cardPriceTone ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardPriceTone ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>前面兩格動的是價錢多大、多粗，這格動的是它什麼顏色。那行本來比品名淡一階，是整張卡上最淡的一行，可是一株賣多少常常正是客人在首頁在找的東西——換成主色或跟品名同深，掃過一列卡片時才看得到。「卡片副文字深淺」動的是那層透明度，跟這格是兩回事，可以疊著用。只有精選商品那段的卡片有價錢</span>
                  {cardPriceTone && (
                    <button
                      type="button"
                      onClick={() => patch({ cardPriceTone: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片行距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "收緊" },
                    { v: "normal", label: "跟預設" },
                    { v: "loose", label: "放寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardRowGap: opt.v })}
                      aria-pressed={(cardRowGap ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardRowGap ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>同一張卡片裡上下幾行之間隔多遠（照片到品名、品名到描述或價錢、描述到底下那行小字）。卡片變寬、四行字散在一片空白裡就收緊，字調大之後幾行黏成一團就放寬；幾行之間原本的遠近會照比例保留，不會被拉成一樣</span>
                  {cardRowGap && (
                    <button
                      type="button"
                      onClick={() => patch({ cardRowGap: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="卡片副文字深淺">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "muted", label: "更淡" },
                    { v: "default", label: "跟預設" },
                    { v: "strong", label: "加深" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ cardMetaTone: opt.v })}
                      aria-pressed={(cardMetaTone ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (cardMetaTone ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>卡片上品名底下那行有多濃（選物的副標、精選商品的價錢）。那行現在被淡了兩次，實際只剩不到五成，字放大了還是一行讀不太到的淺灰——想讓客人在首頁一眼看到價錢就選加深；想讓卡片先講品名、價錢退到後面就選更淡。慢讀那段的摘要不受這格影響</span>
                  {cardMetaTone && (
                    <button
                      type="button"
                      onClick={() => patch({ cardMetaTone: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="底紋">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "grid", label: "格線" },
                    { v: "dots", label: "點陣" },
                    { v: "lines", label: "斜紋" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ texture: opt.v })}
                      aria-pressed={(texture ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (texture ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>很淡的紋路疊在底色上，顏色跟著這段的文字色走</span>
                  {texture && (
                    <button
                      type="button"
                      onClick={() => patch({ texture: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              {/* 濃淡跟分隔線、色條的深淺同一個處理：沒設底紋就沒東西可調。三種花樣都畫在
                  一個寫死的濃度上，底色跟文字色拉不開的段落按了三種花樣都像壞的。 */}
              {texture && texture !== "none" && (
                <Field label="底紋濃淡">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "faint", label: "更淡" },
                      { v: "default", label: "跟預設" },
                      { v: "strong", label: "加深" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ textureTone: opt.v })}
                        aria-pressed={(textureTone ?? "default") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (textureTone ?? "default") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>底紋看不出來就加深；更淡是留一點若有似無的質感，加深後點陣可以當滿版圓點主視覺</span>
                    {textureTone && (
                      <button
                        type="button"
                        onClick={() => patch({ textureTone: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 密度跟濃淡是一對：濃淡調的是一顆點多黑，密度調的是點跟點隔多遠。點陣加深
                  想當滿版圓點主視覺時 20px 還是方眼紙的密度，想要織物細密感時格線 32px 又
                  疏得像表格——缺這格的話商家只能拿濃淡硬湊。 */}
              {texture && texture !== "none" && (
                <Field label="底紋密度">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "dense", label: "更密" },
                      { v: "default", label: "跟預設" },
                      { v: "sparse", label: "更疏" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ textureScale: opt.v })}
                        aria-pressed={(textureScale ?? "default") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (textureScale ?? "default") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>更密是織物那種細密質感；更疏讓點跟點拉開距離，配加深可以當滿版圓點主視覺</span>
                    {textureScale && (
                      <button
                        type="button"
                        onClick={() => patch({ textureScale: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              {/* 用色跟濃淡、密度是一組：濃淡調多黑、密度調多密，這格調什麼色。密度開了
                  「更疏」就是給拿點陣當滿版圓點主視覺的，而那種圓點慣用品牌色——缺這格
                  的話商家調完濃淡密度拿到的還是一片灰點。 */}
              {texture && texture !== "none" && (
                <Field label="底紋用色">
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { v: "text", label: "跟文字色" },
                      { v: "accent", label: "全站主色" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ textureColor: opt.v })}
                        aria-pressed={(textureColor ?? "text") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (textureColor ?? "text") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>跟文字色是安靜的襯底；全站主色讓紋帶品牌色，配加深、更疏就是品牌色圓點主視覺</span>
                    {textureColor && (
                      <button
                        type="button"
                        onClick={() => patch({ textureColor: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              <Field label="底色明暗">
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "top", label: "上緣" },
                    { v: "bottom", label: "下緣" },
                    { v: "vignette", label: "暈影" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ bgGradient: opt.v })}
                      aria-pressed={(bgGradient ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (bgGradient ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>底色從一邊淡淡加深（暈影＝四周壓暗），可以跟底紋一起用</span>
                  {bgGradient && (
                    <button
                      type="button"
                      onClick={() => patch({ bgGradient: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              {/* 濃淡跟底紋濃淡同一個處理：沒選明暗方向就沒東西可調。三個方向都疊在一個
                  寫死的 12% 上，底色跟文字色拉不開的段落按了三個方向都像壞的。 */}
              {bgGradient && bgGradient !== "none" && (
                <Field label="底色明暗濃淡">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { v: "faint", label: "更淡" },
                      { v: "default", label: "跟預設" },
                      { v: "strong", label: "加深" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => patch({ bgGradientTone: opt.v })}
                        aria-pressed={(bgGradientTone ?? "default") === opt.v}
                        className={`rounded-lg border py-2 text-xs transition ${
                          (bgGradientTone ?? "default") === opt.v
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                    <span>明暗看不出來就加深；加深後暈影像舞台打光，把視線收到段落中央</span>
                    {bgGradientTone && (
                      <button
                        type="button"
                        onClick={() => patch({ bgGradientTone: null })}
                        className="text-stone-500 hover:text-stone-800 underline"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </Field>
              )}
              <div className="mt-3 pt-3 border-t border-stone-200">
                <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-stone-500">
                  字體 / 動效
                </p>
              </div>
              <Field label="進場動畫">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "fade", label: "淡入" },
                    { v: "slide-up", label: "上滑" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ entrance: opt.v })}
                      aria-pressed={(entrance ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (entrance ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>滾到該段時觸發（編輯模式不會看到動畫）</span>
                  {entrance && (
                    <button
                      type="button"
                      onClick={() => patch({ entrance: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="字體">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "default", label: "預設" },
                    { v: "serif", label: "宋體" },
                    { v: "sans", label: "黑體" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ fontFamily: opt.v })}
                      aria-pressed={(fontFamily ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (fontFamily ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>沒選 = 跟著全站字體</span>
                  {fontFamily && (
                    <button
                      type="button"
                      onClick={() => patch({ fontFamily: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="字距">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "緊" },
                    { v: "normal", label: "預設" },
                    { v: "wide", label: "寬" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ letterSpacing: opt.v })}
                      aria-pressed={(letterSpacing ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (letterSpacing ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>「寬」適合雜誌大標 / 全大寫字</span>
                  {letterSpacing && (
                    <button
                      type="button"
                      onClick={() => patch({ letterSpacing: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="行高">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "tight", label: "緊湊" },
                    { v: "normal", label: "預設" },
                    { v: "relaxed", label: "舒展" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ lineHeight: opt.v })}
                      aria-pressed={(lineHeight ?? "normal") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (lineHeight ?? "normal") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>「舒展」適合長段內文 / 慢讀區</span>
                  {lineHeight && (
                    <button
                      type="button"
                      onClick={() => patch({ lineHeight: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <div className="mt-3 pt-3 border-t border-stone-200">
                <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-stone-500">
                  氣氛
                </p>
              </div>
              <Field label="淡化">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "default", label: "普通" },
                    { v: "muted", label: "半透" },
                    { v: "faint", label: "淡" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ opacity: opt.v })}
                      aria-pressed={(opacity ?? "default") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (opacity ?? "default") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>讓次要 section（合作 / 數字 / FAQ）變淡，襯托 hero 跳出</span>
                  {opacity && (
                    <button
                      type="button"
                      onClick={() => patch({ opacity: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
              <Field label="濾鏡">
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { v: "none", label: "無" },
                    { v: "grayscale", label: "黑白" },
                    { v: "sepia", label: "復古" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => patch({ filter: opt.v })}
                      aria-pressed={(filter ?? "none") === opt.v}
                      className={`rounded-lg border py-2 text-xs transition ${
                        (filter ?? "none") === opt.v
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                  <span>套在這段的照片上（文字與配色不動），合作 / 相簿黑白做雜誌感、慢讀區復古做懷舊感</span>
                  {filter && (
                    <button
                      type="button"
                      onClick={() => patch({ filter: null })}
                      className="text-stone-500 hover:text-stone-800 underline"
                    >
                      清除
                    </button>
                  )}
                </div>
              </Field>
            </PanelSection>
          );
        })()}

        {activeTab === "design" && (
          <PanelSection title="視覺風格">
            <Field label={`全網站字體大小（${theme.layout.fontScale.toFixed(2)}x）`}>
              <input
                type="range"
                min={FONT_SCALE_MIN}
                max={FONT_SCALE_MAX}
                step="0.05"
                value={theme.layout.fontScale}
                onChange={(e) => updateLayout({ fontScale: parseFloat(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>小</span>
                <span>標準</span>
                <span>大</span>
              </div>
            </Field>
            <Field label="區段上下空白">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "compact", label: "緊湊" },
                  { v: "default", label: "標準" },
                  { v: "spacious", label: "寬鬆" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ sectionPaddingScale: opt.v })}
                    aria-pressed={theme.layout.sectionPaddingScale === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.sectionPaddingScale === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="按鈕圓角">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "pill", label: "整圓" },
                  { v: "soft", label: "微圓" },
                  { v: "square", label: "直角" },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => updateLayout({ buttonRadius: opt.v })}
                    aria-pressed={theme.layout.buttonRadius === opt.v}
                    className={`rounded-lg border py-2 text-xs transition ${
                      theme.layout.buttonRadius === opt.v
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-stone-500 leading-relaxed">
                全站的按鈕一起換 — 首頁的行動按鈕、加入購物車、結帳、表單送出。
              </p>
            </Field>
            <Field label="頁尾底色">
              <div className="flex items-center gap-2">
                {/* 沒設的時候頁尾坐的是卡片底色，所以取色器拿它當初始值 */}
                <input
                  type="color"
                  value={theme.layout.footerBg ?? theme.surface}
                  onChange={(e) => updateLayout({ footerBg: e.target.value })}
                  className="h-8 w-12 rounded border border-stone-200"
                />
                <input
                  type="text"
                  value={theme.layout.footerBg ?? ""}
                  onChange={(e) => updateLayout({ footerBg: e.target.value || null })}
                  placeholder="預設跟卡片底色一樣"
                  className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                />
                {theme.layout.footerBg && (
                  <button
                    type="button"
                    onClick={() => updateLayout({ footerBg: null })}
                    className="text-xs text-stone-500 hover:text-stone-800 underline"
                  >
                    清除
                  </button>
                )}
              </div>
              <p className="text-[10px] text-stone-500 leading-relaxed mt-1">
                每一頁最後那一塊（首頁、商品、購物車、結帳、會員都是同一個）。原本它跟
                卡片同一個顏色，全站底色也調成白的店，最後一段到頁尾是一整片白、只剩一條
                細線在撐。換一塊深色收尾，客人一眼看得出這一頁到這裡結束
              </p>
            </Field>
            <Field label="頁尾文字色">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={theme.layout.footerText ?? theme.text}
                  onChange={(e) => updateLayout({ footerText: e.target.value })}
                  className="h-8 w-12 rounded border border-stone-200"
                />
                <input
                  type="text"
                  value={theme.layout.footerText ?? ""}
                  onChange={(e) => updateLayout({ footerText: e.target.value || null })}
                  placeholder="預設跟全站文字色一樣"
                  className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                />
                {theme.layout.footerText && (
                  <button
                    type="button"
                    onClick={() => updateLayout({ footerText: null })}
                    className="text-xs text-stone-500 hover:text-stone-800 underline"
                  >
                    清除
                  </button>
                )}
              </div>
              <p className="text-[10px] text-stone-500 leading-relaxed mt-1">
                上面那格挑深色的話這格要跟著挑淺色，不然整塊看不見。只要挑一個顏色就好，
                地址、營業時間、社群、版權那幾行的深淺跟中間那幾條短線都會自己從它算出來
              </p>
            </Field>
            <Field label="Logo（顯示在 nav）">
              {theme.logoUrl ? (
                <div className="space-y-2">
                  <div className="relative h-16 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={theme.logoUrl}
                      alt="Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAssetPickerMode({ kind: "logo" })}
                      className="flex-1 rounded-lg bg-emerald-700 text-white text-xs py-2 hover:bg-emerald-800 transition"
                    >
                      ✦ 換 Logo
                    </button>
                    <button
                      type="button"
                      onClick={() => update("logoUrl", null)}
                      className="rounded-lg border border-stone-200 text-stone-600 text-xs px-3 hover:bg-stone-50 transition"
                    >
                      移除
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAssetPickerMode({ kind: "logo" })}
                  className="w-full h-16 rounded-lg border border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50/30 transition text-xs text-stone-500"
                >
                  ✦ 從圖庫挑 Logo
                </button>
              )}
            </Field>
            <Field label="主色 Primary">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={theme.primary}
                  onChange={(e) => update("primary", e.target.value)}
                  className="w-10 h-10 rounded border border-stone-200"
                />
                <input
                  type="text"
                  value={theme.primary}
                  onChange={(e) => update("primary", e.target.value)}
                  className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                />
              </div>
            </Field>
            <Field label="Accent 色">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={theme.accent}
                  onChange={(e) => update("accent", e.target.value)}
                  className="w-10 h-10 rounded border border-stone-200"
                />
                <input
                  type="text"
                  value={theme.accent}
                  onChange={(e) => update("accent", e.target.value)}
                  className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono"
                />
              </div>
            </Field>
          </PanelSection>
        )}

        {activeTab === "content" && (
          <PanelSection title="文案 / 子頁開關">
            <Field label="主 tagline">
              <textarea
                value={theme.tagline}
                onChange={(e) => update("tagline", e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none"
              />
            </Field>
            <div className="space-y-2 mt-2">
              {(
                [
                  { key: "about", label: "關於頁" },
                  { key: "contact", label: "聯絡資訊" },
                  { key: "hours", label: "營業時間" },
                  { key: "faq", label: "FAQ" },
                  { key: "social", label: "頁尾社群" },
                ] as const
              ).map((s) => (
                <label
                  key={s.key}
                  className="flex items-center gap-2 text-sm text-emerald-900"
                >
                  <input
                    type="checkbox"
                    checked={theme.sections[s.key]}
                    onChange={(e) => {
                      setTheme((t) => {
                        pushHistory(t);
                        return {
                          ...t,
                          sections: { ...t.sections, [s.key]: e.target.checked },
                        };
                      });
                      setDirty(true);
                    }}
                    className="w-4 h-4 rounded text-emerald-700"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </PanelSection>
        )}

        {activeTab === "content" && (
          <PanelSection title="子頁標題">
            <p className="text-[11px] text-stone-500 leading-relaxed -mt-2">
              關於頁 / 聯絡頁 / 商品頁的 eyebrow + 大字標題。空白會用預設值。
            </p>
            <Field label="關於頁 eyebrow">
              <input
                type="text"
                value={theme.homepage.aboutEyebrow}
                onChange={(e) =>
                  updateHomepage({ aboutEyebrow: e.target.value })
                }
                maxLength={60}
                placeholder="About"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="關於頁標題">
              <input
                type="text"
                value={theme.homepage.aboutTitle}
                onChange={(e) =>
                  updateHomepage({ aboutTitle: e.target.value })
                }
                maxLength={60}
                placeholder="關於我們"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="聯絡頁 eyebrow">
              <input
                type="text"
                value={theme.homepage.contactEyebrow}
                onChange={(e) =>
                  updateHomepage({ contactEyebrow: e.target.value })
                }
                maxLength={60}
                placeholder="Contact"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="聯絡頁標題">
              <input
                type="text"
                value={theme.homepage.contactTitle}
                onChange={(e) =>
                  updateHomepage({ contactTitle: e.target.value })
                }
                maxLength={60}
                placeholder="聯絡我們"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="商品頁 eyebrow">
              <input
                type="text"
                value={theme.homepage.shopEyebrow}
                onChange={(e) =>
                  updateHomepage({ shopEyebrow: e.target.value })
                }
                maxLength={60}
                placeholder="Shop"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="商品頁標題">
              <input
                type="text"
                value={theme.homepage.shopTitle}
                onChange={(e) =>
                  updateHomepage({ shopTitle: e.target.value })
                }
                maxLength={60}
                placeholder="所有商品"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
          </PanelSection>
        )}

        {activeTab === "content" && (
          <PanelSection title="頁尾（Footer）">
            <p className="text-[11px] text-stone-500 leading-relaxed -mt-2">
              頁尾 tagline、社群連結上方的小標，與訂單追蹤連結文字。空白會用預設值。
            </p>
            <Field label="tagline 上方小標">
              <input
                type="text"
                value={theme.homepage.footerWordsLabel}
                onChange={(e) =>
                  updateHomepage({ footerWordsLabel: e.target.value })
                }
                maxLength={60}
                placeholder="Words"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="社群區小標">
              <input
                type="text"
                value={theme.homepage.footerFollowLabel}
                onChange={(e) =>
                  updateHomepage({ footerFollowLabel: e.target.value })
                }
                maxLength={60}
                placeholder="Follow"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="訂單追蹤連結文字">
              <input
                type="text"
                value={theme.homepage.footerTrackLabel}
                onChange={(e) =>
                  updateHomepage({ footerTrackLabel: e.target.value })
                }
                maxLength={60}
                placeholder="Track · 訂單追蹤"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </Field>
          </PanelSection>
        )}
      </aside>
      )}
      </div>

      {/* === Asset Picker modal === */}
      <AssetPicker
        open={assetPickerMode !== null}
        onClose={() => setAssetPickerMode(null)}
        onSelect={handleAssetSelected}
        title={
          assetPickerMode?.kind === "partner-logo"
            ? "從圖庫挑 Logo（建議搜 brand / logo）"
            : "從圖庫挑圖"
        }
      />

      {/* === 鍵盤快捷鍵說明浮層（按 ? 切換、Esc 關） === */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-stone-950/40 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-emerald-950">鍵盤快捷鍵</h2>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="text-stone-400 hover:text-stone-700 transition"
                aria-label="關閉"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {(
                [
                  { keys: ["⌘", "Z"], desc: "復原上一步" },
                  { keys: ["⌘", "⇧", "Z"], desc: "重做（也可用 ⌘ + Y）" },
                  { keys: ["["], desc: "跳到上一段（編輯區段時）" },
                  { keys: ["]"], desc: "跳到下一段（編輯區段時）" },
                  { keys: ["?"], desc: "開／關這個說明" },
                  { keys: ["Esc"], desc: "關掉浮層、編輯面板" },
                  { keys: ["雙擊", "標題"], desc: "直接改文字（不用回左邊欄）" },
                  { keys: ["拖動", "已選元素"], desc: "自由定位（Hero 主標等元素）" },
                  { keys: ["點 iframe", "section"], desc: "跳到對應的編輯面板" },
                ] as { keys: string[]; desc: string }[]
              ).map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1">
                    {row.keys.map((k, j) => (
                      <kbd
                        key={j}
                        className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded border border-stone-300 bg-stone-50 text-[11px] font-medium text-stone-700 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                  <span className="text-xs text-stone-600 text-right flex-1">{row.desc}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-stone-50 border-t border-stone-100">
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Windows / Linux 把 ⌘ 換成 Ctrl。⇧ = Shift。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableSectionItem({
  sectionKey,
  label,
  selected,
  onSelect,
  removable,
  onRemove,
}: {
  sectionKey: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto",
  } as React.CSSProperties;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border ${
        selected
          ? "border-emerald-400 bg-emerald-50/60 shadow-sm shadow-emerald-700/10"
          : "border-stone-200 bg-white hover:border-stone-300"
      } transition ${isDragging ? "shadow-lg shadow-stone-300" : ""}`}
    >
      <div className="flex items-center">
        <button
          type="button"
          className="px-2 py-2.5 text-stone-400 hover:text-stone-700 cursor-grab active:cursor-grabbing touch-none"
          aria-label="拖曳重排"
          {...attributes}
          {...listeners}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="6" r="1.5" fill="currentColor" />
            <circle cx="15" cy="6" r="1.5" fill="currentColor" />
            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
            <circle cx="15" cy="12" r="1.5" fill="currentColor" />
            <circle cx="9" cy="18" r="1.5" fill="currentColor" />
            <circle cx="15" cy="18" r="1.5" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 text-left py-2.5 pr-3 text-sm text-emerald-950 min-w-0 truncate"
        >
          {label}
        </button>
        {removable && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="px-2 text-stone-400 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
            title="移除這個區段"
            aria-label="移除"
          >
            ×
          </button>
        )}
      </div>
    </li>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5 border-b border-stone-100">
      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-emerald-900 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
