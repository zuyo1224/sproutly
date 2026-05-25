"use client";

import { useState, useTransition, useEffect, useRef } from "react";
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
    heroHeight: "auto" | "short" | "tall" | "full";
    fontScale: number;
    sectionPaddingScale: "compact" | "default" | "spacious";
    featuredCount: number;
    featuredColumns: 2 | 3 | 4;
    collectionsColumns: 2 | 3 | 4;
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
    }>;
  };
  homepage: {
    promise: string;
    collectionsIntro: string;
    visitTitle: string;
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

const HERO_STYLE_LABELS: Record<HeroStyle, string> = {
  "full-image": "全屏沉浸",
  split: "左右分割",
  minimal: "極簡文字",
  magazine: "雜誌封面",
};

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
  // 區段樣式 clipboard（session 內 user 從某段複製、貼到別段）
  // 不持久化（reload 後清空）— 是工具不是狀態
  const [styleClipboard, setStyleClipboard] = useState<{
    source: SectionKey;
    fields: EditorTheme["layout"]["sectionStyles"][string];
  } | null>(null);
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

  function pushHistory(prev: EditorTheme) {
    pastRef.current.push(prev);
    if (pastRef.current.length > 50) pastRef.current.shift();
    futureRef.current = [];
    setHistoryTick((t) => t + 1);
  }

  function update<K extends keyof EditorTheme>(key: K, value: EditorTheme[K]) {
    setTheme((t) => {
      pushHistory(t);
      return { ...t, [key]: value };
    });
    setDirty(true);
  }
  function updateLayout(patch: Partial<EditorTheme["layout"]>) {
    setTheme((t) => {
      pushHistory(t);
      return { ...t, layout: { ...t.layout, ...patch } };
    });
    setDirty(true);
  }
  function updateHomepage(patch: Partial<EditorTheme["homepage"]>) {
    setTheme((t) => {
      pushHistory(t);
      return { ...t, homepage: { ...t.homepage, ...patch } };
    });
    setDirty(true);
  }

  function undo() {
    const last = pastRef.current.pop();
    if (!last) return;
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
      const msg = e.data as { type?: string; target?: string; field?: string; value?: string };
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
        } else if (msg.field === "collectionsIntro") {
          updateHomepage({ collectionsIntro: value });
        } else if (msg.field === "heroEyebrow") {
          updateLayout({ heroEyebrow: value || null });
        } else if (msg.field === "heroSubtitle") {
          updateLayout({ heroSubtitle: value || null });
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover, showShortcuts]);

  // Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;
      // 不要 hijack input / textarea 內的 native undo
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
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
    updateLayout({
      sectionOrder: arrayMove(theme.layout.sectionOrder, oldIdx, newIdx),
    });
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
    updateLayout({ sectionOrder: next });
    setSelectedSection(blockKey);
  }

  function removeBlock(blockKey: SectionKey) {
    updateLayout({
      sectionOrder: theme.layout.sectionOrder.filter((k) => k !== blockKey),
    });
    if (selectedSection === blockKey) setSelectedSection("hero");
  }

  function updateTestimonial(idx: number, patch: Partial<Testimonial>) {
    const next = [...theme.layout.testimonials];
    next[idx] = { ...next[idx], ...patch };
    updateLayout({ testimonials: next });
  }
  function addTestimonial() {
    if (theme.layout.testimonials.length >= 6) return;
    updateLayout({
      testimonials: [
        ...theme.layout.testimonials,
        { quote: "", author: "", role: null },
      ],
    });
  }
  function removeTestimonial(idx: number) {
    updateLayout({
      testimonials: theme.layout.testimonials.filter((_, i) => i !== idx),
    });
  }

  function updateFaq(idx: number, patch: Partial<FaqItem>) {
    const next = [...theme.layout.faqItems];
    next[idx] = { ...next[idx], ...patch };
    updateLayout({ faqItems: next });
  }
  function addFaq() {
    if (theme.layout.faqItems.length >= 20) return;
    updateLayout({
      faqItems: [...theme.layout.faqItems, { question: "", answer: "" }],
    });
  }
  function removeFaq(idx: number) {
    updateLayout({
      faqItems: theme.layout.faqItems.filter((_, i) => i !== idx),
    });
  }

  // Stats / Partners / Gallery 通用 list helpers
  function updateListItem<T>(field: "stats" | "partners" | "gallery", idx: number, patch: Partial<T>) {
    const list = theme.layout[field] as T[];
    const next = [...list];
    next[idx] = { ...next[idx], ...patch };
    updateLayout({ [field]: next } as Partial<EditorTheme["layout"]>);
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
    updateLayout({ [field]: [...cur, blank] } as Partial<EditorTheme["layout"]>);
  }
  function removeListItem(field: "stats" | "partners" | "gallery", idx: number) {
    const cur = theme.layout[field] as Array<unknown>;
    updateLayout({ [field]: cur.filter((_, i) => i !== idx) } as Partial<EditorTheme["layout"]>);
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
          freePositions: t.layout.freePositions,
          heroZoom: t.layout.heroZoom,
          heroZoomMobile: t.layout.heroZoomMobile,
          heroZoomTablet: t.layout.heroZoomTablet,
          heroZoomDesktop: t.layout.heroZoomDesktop,
          heroTaglineFontScale: t.layout.heroTaglineFontScale,
          heroTaglineColor: t.layout.heroTaglineColor,
          heroTaglineAlign: t.layout.heroTaglineAlign,
          heroHeight: t.layout.heroHeight,
          fontScale: t.layout.fontScale,
          sectionPaddingScale: t.layout.sectionPaddingScale,
          featuredCount: t.layout.featuredCount,
          featuredColumns: t.layout.featuredColumns,
          collectionsColumns: t.layout.collectionsColumns,
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
              if (patch.primary) update("primary", patch.primary);
              if (patch.accent) update("accent", patch.accent);
              if (patch.tagline !== undefined) update("tagline", patch.tagline);
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
                if (Object.keys(patchObj).length) updateLayout(patchObj);
              }
              if (patch.homepage) {
                const hpPatch: Partial<EditorTheme["homepage"]> = {};
                if (patch.homepage.promise !== undefined) hpPatch.promise = patch.homepage.promise;
                if (patch.homepage.collectionsIntro !== undefined) hpPatch.collectionsIntro = patch.homepage.collectionsIntro;
                if (patch.homepage.visitTitle !== undefined) hpPatch.visitTitle = patch.homepage.visitTitle;
                if (Object.keys(hpPatch).length) updateHomepage(hpPatch);
              }
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
                placeholder="給 Split / Magazine / Minimal 用"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm resize-none"
              />
            </Field>
            <Field label={`主標字體大小（${theme.layout.heroTaglineFontScale.toFixed(2)}x）`}>
              <input
                type="range"
                min="0.6"
                max="1.8"
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
                      min="1.0"
                      max="2.5"
                      step="0.05"
                      value={zoomValue}
                      onChange={(e) =>
                        updateLayout({ [zoomKey]: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-stone-500">
                      <span>1.0x（原始）</span>
                      <span>{zoomValue.toFixed(2)}x</span>
                      <span>2.5x</span>
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
                  const pos = theme.layout.freePositions["hero-tagline"];
                  if (pos) {
                    return (
                      <div className="space-y-2">
                        <p className="text-[11px] text-stone-600">
                          Tagline 自訂位置：X={Math.round(pos.x * 100)}% Y={Math.round(pos.y * 100)}%
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const { ["hero-tagline"]: _, ...rest } =
                              theme.layout.freePositions;
                            updateLayout({ freePositions: rest });
                          }}
                          className="w-full rounded-lg border border-stone-200 text-stone-700 text-xs py-2 hover:bg-stone-50 transition"
                        >
                          重設為預設位置（左下）
                        </button>
                      </div>
                    );
                  }
                  return (
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      在 iframe 內拖藍色虛線 tagline 框到任何位置 → 自動儲存位置。
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
            <p className="text-xs text-stone-500 leading-relaxed">
              個別選物提案的標題、副標、情境照在「傳統設定頁」編輯。
            </p>
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "promise" && (
          <PanelSection title="Promise 區段">
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
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "partners" && (
          <PanelSection title="合作夥伴 / 媒體 logos">
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
          </PanelSection>
        )}

        {activeTab === "section" && selectedSection === "faq" && (
          <PanelSection title="常見問題（FAQ）區段">
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
          </PanelSection>
        )}

        {activeTab === "section" &&
          selectedSection === "featured" && (
            <PanelSection title={sectionLabels.featured}>
              <Field label={`顯示幾個商品（${theme.layout.featuredCount}）`}>
                <input
                  type="range"
                  min="3"
                  max="12"
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
            <p className="text-sm text-stone-600 leading-relaxed">
              慢讀 / Journal 區段，目前用預設 placeholder。
            </p>
            <p className="mt-3 text-xs text-stone-500">
              你可以用左側「版面結構」拖曳排序這個 section 的位置，
              或在「色彩」改 accent 色換它的調性。
            </p>
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
          function patch(p: { headingAlign?: "left" | "center" | "right"; bgColor?: string | null; textColor?: string | null; paddingScale?: "compact" | "default" | "spacious" | null; divider?: "none" | "top" | "bottom" | "both"; headingScale?: "small" | "default" | "large" | null; minHeight?: "auto" | "tall" | "fullscreen" | null; outline?: "none" | "subtle" | "strong" | null; shadow?: "none" | "soft" | "deep" | null; borderRadius?: "none" | "soft" | "strong" | null; entrance?: "none" | "fade" | "slide-up" | null; fontFamily?: "default" | "serif" | "sans" | null; letterSpacing?: "tight" | "normal" | "wide" | null; lineHeight?: "tight" | "normal" | "relaxed" | null; opacity?: "default" | "muted" | "faint" | null; filter?: "none" | "grayscale" | "sepia" | null }) {
            const next: { headingAlign?: "left" | "center" | "right"; bgColor?: string | null; textColor?: string | null; paddingScale?: "compact" | "default" | "spacious"; divider?: "none" | "top" | "bottom" | "both"; headingScale?: "small" | "default" | "large"; minHeight?: "auto" | "tall" | "fullscreen"; outline?: "none" | "subtle" | "strong"; shadow?: "none" | "soft" | "deep"; borderRadius?: "none" | "soft" | "strong"; entrance?: "none" | "fade" | "slide-up"; fontFamily?: "default" | "serif" | "sans"; letterSpacing?: "tight" | "normal" | "wide"; lineHeight?: "tight" | "normal" | "relaxed"; opacity?: "default" | "muted" | "faint"; filter?: "none" | "grayscale" | "sepia" } = { ...cur };
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
          ];
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
              </Field>
              <Field label="快速風格">
                <p className="-mt-1 mb-1.5 text-[11px] text-stone-500 leading-snug">
                  一鍵套樣式組合，套完還能微調個別控制
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {presets.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyPreset(p.fields)}
                      title={p.hint}
                      className="rounded-lg border border-stone-200 px-2 py-2 text-xs text-stone-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-900 transition text-left leading-tight"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>
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
                <p className="mt-1.5 text-[11px] text-stone-500">
                  改深色背景時搭淺字、淺色背景搭深字
                </p>
              </Field>
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
                min="0.8"
                max="1.3"
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
