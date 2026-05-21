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

type SelectedTab = "section" | "design" | "content";

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
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  }
  function redo() {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(theme);
    setTheme(next);
    setDirty(true);
    setHistoryTick((t) => t + 1);
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
        }
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
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save: 改動後 2 秒沒新動作就自動 save + reload iframe
  useEffect(() => {
    if (!dirty || !autoSaveEnabled) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, dirty, autoSaveEnabled]);

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

  function handleSave() {
    startTransition(async () => {
      const res = await saveEditorState(slug, {
        primary: theme.primary,
        accent: theme.accent,
        tagline: theme.tagline,
        heroUrl: theme.heroUrl,
        logoUrl: theme.logoUrl,
        layout: {
          heroStyle: theme.layout.heroStyle,
          heroEyebrow: theme.layout.heroEyebrow ?? "",
          heroSubtitle: theme.layout.heroSubtitle ?? "",
          heroImageSide: theme.layout.heroImageSide,
          sectionOrder: theme.layout.sectionOrder,
          testimonials: theme.layout.testimonials
            .filter((t) => t.quote.trim() && t.author.trim())
            .map((t) => ({
              quote: t.quote,
              author: t.author,
              role: t.role ?? undefined,
            })),
          faqItems: theme.layout.faqItems
            .filter((f) => f.question.trim() && f.answer.trim())
            .map((f) => ({ question: f.question, answer: f.answer })),
          stats: theme.layout.stats
            .filter((s) => s.value.trim() && s.label.trim())
            .map((s) => ({ value: s.value, label: s.label })),
          partners: theme.layout.partners
            .filter((p) => p.name.trim() && p.logoUrl.trim())
            .map((p) => ({ name: p.name, logoUrl: p.logoUrl, href: p.href })),
          gallery: theme.layout.gallery
            .filter((g) => g.url.trim())
            .map((g) => ({ url: g.url, caption: g.caption })),
          mapEmbedUrl: theme.layout.mapEmbedUrl,
        },
        homepage: theme.homepage,
        sections: theme.sections,
      });
      if (res && "ok" in res) {
        setDirty(false);
        setSavedAt(Date.now());
        setPreviewKey((k) => k + 1);
      } else {
        alert(res?.error ?? "儲存失敗");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] min-h-[calc(100vh-80px)] bg-stone-50">
      {/* === 左 sidebar：section 列表 === */}
      <aside className="bg-white border-r border-stone-200 flex flex-col">
        <div className="p-5 border-b border-stone-200">
          <p className="text-[10px] tracking-[0.32em] uppercase text-emerald-700/70 mb-1">
            Editor
          </p>
          <h1 className="text-base font-semibold text-emerald-950 truncate">
            {storeName}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex w-1.5 h-1.5 rounded-full ${isPublished ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <span className="text-[11px] text-emerald-900/55">
              {isPublished ? "已發布" : "草稿"}
            </span>
          </div>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => setActiveTab("section")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition ${
              activeTab === "section"
                ? "bg-emerald-50 text-emerald-900 font-medium"
                : "text-emerald-900/70 hover:bg-stone-50"
            }`}
          >
            版面結構
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("design")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition ${
              activeTab === "design"
                ? "bg-emerald-50 text-emerald-900 font-medium"
                : "text-emerald-900/70 hover:bg-stone-50"
            }`}
          >
            視覺風格
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
              activeTab === "content"
                ? "bg-emerald-50 text-emerald-900 font-medium"
                : "text-emerald-900/70 hover:bg-stone-50"
            }`}
          >
            文案內容
          </button>
        </div>

        {activeTab === "section" && (
          <div className="px-3 pb-3 flex-1 overflow-y-auto border-t border-stone-100 pt-3">
            <p className="px-2 mb-2 text-[10px] tracking-wider uppercase text-emerald-900/45">
              首頁 Sections（拖曳排序）
            </p>
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

        <div className="p-3 border-t border-stone-200 mt-auto space-y-2">
          <div className="flex items-center justify-between px-1 mb-1">
            <label className="flex items-center gap-1.5 text-[11px] text-emerald-900/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSaveEnabled}
                onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-700"
              />
              自動儲存
            </label>
            <span
              className={`text-[11px] ${
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
                ? "儲存中…"
                : dirty
                  ? autoSaveEnabled
                    ? "2 秒後自動存"
                    : "未儲存"
                  : savedAt
                    ? `已存 · ${new Date(savedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`
                    : "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || pending}
            className="w-full rounded-full bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 hover:bg-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "儲存中…" : "立刻儲存"}
          </button>
          <Link
            href={`/dashboard/stores/${slug}/settings`}
            className="block text-center text-xs text-emerald-900/55 hover:text-emerald-900 transition"
          >
            ← 回傳統設定頁
          </Link>
        </div>
      </aside>

      {/* === 中央 canvas: 公開頁 preview === */}
      <main className="bg-stone-100 p-4 lg:p-6 overflow-hidden flex flex-col">
        <div className="flex-1 rounded-xl overflow-hidden shadow-lg shadow-stone-200/60 border border-stone-200 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
              </div>
              {/* Undo / Redo */}
              <div className="flex items-center gap-0.5 ml-2 border-l border-stone-200 pl-3">
                <button
                  type="button"
                  onClick={undo}
                  disabled={pastRef.current.length === 0}
                  title="復原 (Cmd+Z)"
                  className="w-7 h-7 rounded text-stone-600 hover:bg-stone-200 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                  data-history-tick={historyTick}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 00-15-6.7L3 13" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={futureRef.current.length === 0}
                  title="重做 (Cmd+Shift+Z)"
                  className="w-7 h-7 rounded text-stone-600 hover:bg-stone-200 transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 7v6h-6" />
                    <path d="M3 17a9 9 0 0115-6.7L21 13" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Viewport switcher */}
            <div className="flex items-center gap-0.5 bg-stone-200/60 rounded-md p-0.5">
              {(["desktop", "tablet", "mobile"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewport(v)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition ${
                    viewport === v
                      ? "bg-white text-emerald-900 shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                  title={
                    v === "desktop" ? "桌機 (1280)" : v === "tablet" ? "平板 (768)" : "手機 (375)"
                  }
                >
                  {v === "desktop" ? "桌機" : v === "tablet" ? "平板" : "手機"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-stone-500 hidden sm:inline">
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
              <a
                href={`/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title="在新分頁打開公開店面"
                className="text-xs text-emerald-700 hover:text-emerald-900"
              >
                ↗
              </a>
            </div>
          </div>

          {/* iframe container - viewport-aware */}
          <div className="flex-1 bg-stone-200/40 overflow-auto flex items-start justify-center p-0 sm:p-4">
            <div
              className="bg-white shadow-md shadow-stone-300/50 transition-all duration-500"
              style={{
                width:
                  viewport === "desktop"
                    ? "100%"
                    : viewport === "tablet"
                      ? "768px"
                      : "375px",
                maxWidth: "100%",
                height: "100%",
              }}
            >
              <iframe
                key={previewKey}
                src={`/${slug}?edit=1`}
                title="店面預覽"
                className="w-full h-full bg-white"
              />
            </div>
          </div>
        </div>
      </main>

      {/* === 右 panel: 屬性編輯 === */}
      <aside className="bg-white border-l border-stone-200 overflow-y-auto">
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
          (selectedSection === "featured" || selectedSection === "journal") && (
            <PanelSection title={sectionLabels[selectedSection]}>
              <p className="text-sm text-stone-600 leading-relaxed">
                這個 section 的內容由你後台的{" "}
                {selectedSection === "featured" ? "商品" : "Journal 預設 placeholder"}{" "}
                自動生成，目前沒有額外可調的屬性。
              </p>
              <p className="mt-3 text-xs text-stone-500">
                你可以用左側「↑↓」調整這 section 在首頁的位置。
              </p>
            </PanelSection>
          )}

        {activeTab === "design" && (
          <PanelSection title="視覺風格">
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
                      setTheme((t) => ({
                        ...t,
                        sections: { ...t.sections, [s.key]: e.target.checked },
                      }));
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
