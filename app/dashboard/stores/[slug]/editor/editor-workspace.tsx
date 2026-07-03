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
    heroSubtitleFontScale: number;
    heroSubtitleColor: string | null;
    heroSubtitleAlign: "inherit" | "left" | "center" | "right";
    heroHeight: "auto" | "short" | "tall" | "full";
    fontScale: number;
    sectionPaddingScale: "compact" | "default" | "spacious";
    featuredCount: number;
    featuredColumns: 2 | 3 | 4;
    collectionsColumns: 2 | 3 | 4;
    testimonialsColumns: 2 | 3 | 4;
    statsColumns: 2 | 3 | 4;
    galleryColumns: 2 | 3 | 4;
    journalColumns: 2 | 3;
    sectionStyles: Record<string, {
      headingAlign?: "left" | "center" | "right";
      bgColor?: string | null;
      textColor?: string | null;
      paddingScale?: "compact" | "default" | "spacious";
      divider?: "none" | "top" | "bottom" | "both";
      headingScale?: "small" | "default" | "large";
      minHeight?: "auto" | "tall" | "fullscreen";
      outline?: "none" | "subtle" | "strong";
      shadow?: "none" | "soft" | "deep";
      borderRadius?: "none" | "soft" | "strong";
      entrance?: "none" | "fade" | "slide-up";
      fontFamily?: "default" | "serif" | "sans";
      letterSpacing?: "tight" | "normal" | "wide";
      lineHeight?: "tight" | "normal" | "relaxed";
      opacity?: "default" | "muted" | "faint";
      filter?: "none" | "grayscale" | "sepia";
      sectionWidth?: "full" | "boxed" | "narrow";
      sectionGap?: "none" | "normal" | "large";
    }>;
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
          heroSubtitleFontScale: t.layout.heroSubtitleFontScale,
          heroSubtitleColor: t.layout.heroSubtitleColor,
          heroSubtitleAlign: t.layout.heroSubtitleAlign,
          heroHeight: t.layout.heroHeight,
          fontScale: t.layout.fontScale,
          sectionPaddingScale: t.layout.sectionPaddingScale,
          featuredCount: t.layout.featuredCount,
          featuredColumns: t.layout.featuredColumns,
          collectionsColumns: t.layout.collectionsColumns,
          testimonialsColumns: t.layout.testimonialsColumns,
          statsColumns: t.layout.statsColumns,
          galleryColumns: t.layout.galleryColumns,
          journalColumns: t.layout.journalColumns,
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
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={theme.heroUrl}
                      alt="Hero"
                      className="w-full h-full object-cover"
                    />
                  </div>
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
                  // 主標 / 副標 / 按鈕各自一個 key，哪個拖過就列哪個的重設
                  const dragables = [
                    { key: FREE_POS_KEYS.heroTagline, label: "主標" },
                    { key: FREE_POS_KEYS.heroSubtitle, label: "副標" },
                    { key: FREE_POS_KEYS.heroCta, label: "按鈕" },
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
                      在預覽內拖主標、副標或按鈕到任何位置 → 自動儲存位置。
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
          const bg = cur.bgColor ?? null;
          const textCol = cur.textColor ?? null;
          const pad = cur.paddingScale ?? null;
          const divider = cur.divider ?? "none";
          const headingScale = cur.headingScale ?? null;
          const minHeight = cur.minHeight ?? null;
          const outline = cur.outline ?? null;
          const shadow = cur.shadow ?? null;
          const borderRadius = cur.borderRadius ?? null;
          const entrance = cur.entrance ?? null;
          const fontFamily = cur.fontFamily ?? null;
          const letterSpacing = cur.letterSpacing ?? null;
          const lineHeight = cur.lineHeight ?? null;
          const opacity = cur.opacity ?? null;
          const filter = cur.filter ?? null;
          const sectionWidth = cur.sectionWidth ?? null;
          const sectionGap = cur.sectionGap ?? null;
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
          function patch(p: { headingAlign?: "left" | "center" | "right"; bgColor?: string | null; textColor?: string | null; paddingScale?: "compact" | "default" | "spacious" | null; divider?: "none" | "top" | "bottom" | "both"; headingScale?: "small" | "default" | "large" | null; minHeight?: "auto" | "tall" | "fullscreen" | null; outline?: "none" | "subtle" | "strong" | null; shadow?: "none" | "soft" | "deep" | null; borderRadius?: "none" | "soft" | "strong" | null; entrance?: "none" | "fade" | "slide-up" | null; fontFamily?: "default" | "serif" | "sans" | null; letterSpacing?: "tight" | "normal" | "wide" | null; lineHeight?: "tight" | "normal" | "relaxed" | null; opacity?: "default" | "muted" | "faint" | null; filter?: "none" | "grayscale" | "sepia" | null; sectionWidth?: "full" | "boxed" | "narrow" | null; sectionGap?: "none" | "normal" | "large" | null }) {
            const next: { headingAlign?: "left" | "center" | "right"; bgColor?: string | null; textColor?: string | null; paddingScale?: "compact" | "default" | "spacious"; divider?: "none" | "top" | "bottom" | "both"; headingScale?: "small" | "default" | "large"; minHeight?: "auto" | "tall" | "fullscreen"; outline?: "none" | "subtle" | "strong"; shadow?: "none" | "soft" | "deep"; borderRadius?: "none" | "soft" | "strong"; entrance?: "none" | "fade" | "slide-up"; fontFamily?: "default" | "serif" | "sans"; letterSpacing?: "tight" | "normal" | "wide"; lineHeight?: "tight" | "normal" | "relaxed"; opacity?: "default" | "muted" | "faint"; filter?: "none" | "grayscale" | "sepia"; sectionWidth?: "full" | "boxed" | "narrow"; sectionGap?: "none" | "normal" | "large" } = { ...cur };
            if (p.headingAlign !== undefined) next.headingAlign = p.headingAlign;
            if (p.bgColor !== undefined) next.bgColor = p.bgColor;
            if (p.textColor !== undefined) next.textColor = p.textColor;
            if (p.paddingScale === null) delete next.paddingScale;
            else if (p.paddingScale !== undefined) next.paddingScale = p.paddingScale;
            if (p.divider !== undefined) {
              if (p.divider === "none") delete next.divider;
              else next.divider = p.divider;
            }
            if (p.headingScale === null) delete next.headingScale;
            else if (p.headingScale !== undefined) next.headingScale = p.headingScale;
            if (p.minHeight === null) delete next.minHeight;
            else if (p.minHeight !== undefined) next.minHeight = p.minHeight;
            if (p.outline !== undefined) {
              if (p.outline === null || p.outline === "none") delete next.outline;
              else next.outline = p.outline;
            }
            if (p.shadow !== undefined) {
              if (p.shadow === null || p.shadow === "none") delete next.shadow;
              else next.shadow = p.shadow;
            }
            if (p.borderRadius !== undefined) {
              if (p.borderRadius === null || p.borderRadius === "none") delete next.borderRadius;
              else next.borderRadius = p.borderRadius;
            }
            if (p.entrance !== undefined) {
              if (p.entrance === null || p.entrance === "none") delete next.entrance;
              else next.entrance = p.entrance;
            }
            if (p.fontFamily !== undefined) {
              if (p.fontFamily === null || p.fontFamily === "default") delete next.fontFamily;
              else next.fontFamily = p.fontFamily;
            }
            if (p.letterSpacing !== undefined) {
              if (p.letterSpacing === null || p.letterSpacing === "normal") delete next.letterSpacing;
              else next.letterSpacing = p.letterSpacing;
            }
            if (p.lineHeight !== undefined) {
              if (p.lineHeight === null || p.lineHeight === "normal") delete next.lineHeight;
              else next.lineHeight = p.lineHeight;
            }
            if (p.opacity !== undefined) {
              if (p.opacity === null || p.opacity === "default") delete next.opacity;
              else next.opacity = p.opacity;
            }
            if (p.filter !== undefined) {
              if (p.filter === null || p.filter === "none") delete next.filter;
              else next.filter = p.filter;
            }
            if (p.sectionWidth !== undefined) {
              if (p.sectionWidth === null || p.sectionWidth === "full") delete next.sectionWidth;
              else next.sectionWidth = p.sectionWidth;
            }
            if (p.sectionGap !== undefined) {
              if (p.sectionGap === null || p.sectionGap === "none") delete next.sectionGap;
              else next.sectionGap = p.sectionGap;
            }
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
          const presets: { key: string; label: string; hint: string; fields: typeof cur }[] = [
            {
              key: "editorial",
              label: "雜誌風",
              hint: "宋體 + 大標 + 寬呼吸（適合 promise / journal）",
              fields: {
                fontFamily: "serif",
                headingScale: "large",
                paddingScale: "spacious",
                letterSpacing: "wide",
                lineHeight: "relaxed",
                divider: "top",
              },
            },
            {
              key: "modern",
              label: "現代簡潔",
              hint: "黑體 + 緊字距 + 微圓角（Stripe / Linear 風）",
              fields: {
                fontFamily: "sans",
                paddingScale: "default",
                letterSpacing: "tight",
                borderRadius: "soft",
              },
            },
            {
              key: "dramatic",
              label: "戲劇感",
              hint: "滿屏 + 大標 + 深陰影 + 上滑進場",
              fields: {
                minHeight: "fullscreen",
                headingScale: "large",
                paddingScale: "spacious",
                shadow: "deep",
                entrance: "slide-up",
              },
            },
            {
              key: "floating",
              label: "卡片浮起",
              hint: "淺底 + 邊框 + 圓角 + 陰影（適合 testimonial）",
              fields: {
                bgColor: "#fafaf9",
                shadow: "soft",
                borderRadius: "soft",
                outline: "subtle",
                paddingScale: "default",
              },
            },
            {
              key: "recede",
              label: "低調襯底",
              hint: "淡化 + 緊湊 + 小標（次要區段退到後面，襯托 hero / 選物。適合 partners / stats / faq）",
              fields: {
                opacity: "muted",
                paddingScale: "compact",
                headingScale: "small",
                letterSpacing: "wide",
              },
            },
            {
              key: "mono",
              label: "黑白雜誌",
              hint: "黑白濾鏡 + 宋體 + 寬字距 + 寬呼吸（攝影感雜誌調，適合 gallery / partners）",
              fields: {
                filter: "grayscale",
                fontFamily: "serif",
                letterSpacing: "wide",
                paddingScale: "spacious",
              },
            },
            {
              key: "boxed-card",
              label: "置中卡片",
              hint: "窄版置中 + 上下拉開 + 淺底圓角陰影（整段縮成一張浮起的卡片，適合 promise / testimonial / faq）",
              fields: {
                sectionWidth: "boxed",
                sectionGap: "large",
                bgColor: "#fafaf9",
                borderRadius: "soft",
                shadow: "soft",
                outline: "subtle",
                paddingScale: "default",
              },
            },
            {
              key: "left-story",
              label: "靠左敘事",
              hint: "標題靠左 + 宋體 + 寬行高 + 寬呼吸（左對齊的雜誌敘事感，適合 about / story / journal）",
              fields: {
                headingAlign: "left",
                fontFamily: "serif",
                lineHeight: "relaxed",
                paddingScale: "spacious",
                sectionWidth: "narrow",
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
          let activePresetKey: string | null = null;
          let activePresetFieldCount = 0;
          for (const p of presets) {
            if (presetMatches(p.fields)) {
              const n = Object.keys(p.fields).length;
              if (n > activePresetFieldCount) {
                activePresetFieldCount = n;
                activePresetKey = p.key;
              }
            }
          }
          function applyPreset(fields: typeof cur) {
            const merged: typeof cur = { ...cur, ...fields };
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
                  一鍵套樣式組合，套完還能微調個別控制
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {presets.map((p) => {
                    const isActive = activePresetKey === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => applyPreset(p.fields)}
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
                  <span>整段 section 套濾鏡，合作 / 相簿黑白做雜誌感、journal 復古做懷舊感</span>
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
