"use client";

import { useState, useTransition } from "react";
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

type SectionKey =
  | "hero"
  | "collections"
  | "featured"
  | "journal"
  | "promise"
  | "testimonials"
  | "faq"
  | "visit";
type HeroStyle = "full-image" | "split" | "minimal" | "magazine";

type Testimonial = { quote: string; author: string; role: string | null };
type FaqItem = { question: string; answer: string };

const ADDABLE_BLOCKS: { key: SectionKey; label: string; description: string }[] = [
  {
    key: "testimonials",
    label: "顧客評語",
    description: "3 個 quote card 顯示真實顧客評價",
  },
  {
    key: "faq",
    label: "常見問題",
    description: "Accordion 展開式問答",
  },
];

type EditorTheme = {
  primary: string;
  accent: string;
  tagline: string;
  layout: {
    heroStyle: HeroStyle;
    heroEyebrow: string | null;
    heroSubtitle: string | null;
    heroImageSide: "left" | "right";
    sectionOrder: SectionKey[];
    testimonials: Testimonial[];
    faqItems: FaqItem[];
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

  function update<K extends keyof EditorTheme>(key: K, value: EditorTheme[K]) {
    setTheme((t) => ({ ...t, [key]: value }));
    setDirty(true);
  }
  function updateLayout(patch: Partial<EditorTheme["layout"]>) {
    setTheme((t) => ({ ...t, layout: { ...t.layout, ...patch } }));
    setDirty(true);
  }
  function updateHomepage(patch: Partial<EditorTheme["homepage"]>) {
    setTheme((t) => ({ ...t, homepage: { ...t.homepage, ...patch } }));
    setDirty(true);
  }

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

  function handleSave() {
    startTransition(async () => {
      const res = await saveEditorState(slug, {
        primary: theme.primary,
        accent: theme.accent,
        tagline: theme.tagline,
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
          {dirty && (
            <p className="text-[11px] text-amber-700 text-center">未儲存的變動</p>
          )}
          {!dirty && savedAt && (
            <p className="text-[11px] text-emerald-700 text-center">已儲存</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || pending}
            className="w-full rounded-full bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 hover:bg-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "儲存中…" : "儲存變更"}
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
      <main className="bg-stone-100 p-4 lg:p-6 overflow-hidden">
        <div className="h-full rounded-xl overflow-hidden shadow-lg shadow-stone-200/60 border border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
            </div>
            <span className="text-[11px] font-mono text-stone-500">
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
          <iframe
            key={previewKey}
            src={`/${slug}`}
            title="店面預覽"
            className="w-full h-[calc(100%-40px)] bg-white"
          />
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
            <p className="text-xs text-stone-500 leading-relaxed">
              地址 / 營業時間 / 電話 / Email 在「傳統設定頁」改。
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
