"use client";

import { useState, useRef } from "react";

type ThemePatch = {
  primary?: string;
  accent?: string;
  tagline?: string;
  layout?: {
    heroStyle?: string;
    heroEyebrow?: string;
    heroSubtitle?: string;
    heroImageSide?: string;
    sectionOrder?: string[];
  };
  homepage?: {
    promise?: string;
    collectionsIntro?: string;
    visitTitle?: string;
  };
};

type Message = {
  role: "user" | "ai";
  text: string;
  patch?: ThemePatch;
  ts: number;
};

const SUGGESTIONS = [
  "把 hero 改成 split 樣式，圖在左邊",
  "把 hero 改成雜誌封面風（magazine）",
  "把 accent 顏色改成深綠色",
  "幫我寫一段更詩意的 tagline",
  "promise 文字幫我重寫，慢一點不要太商業",
];

/**
 * AI 助手 panel（對標 Wix Aria）
 * - 對話式：user 講「把 hero 改 split」，AI 回 theme patch
 * - 點「套用」自動把 patch 寫進 form fields，user 仍要按「儲存設定」才存進 DB
 */
export function AIEditPanel({
  currentTheme,
  formId,
}: {
  currentTheme: Record<string, unknown>;
  formId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(prompt: string) {
    if (!prompt.trim() || loading) return;
    setError(null);
    setInput("");
    const userMsg: Message = { role: "user", text: prompt, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, theme: currentTheme }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `${res.status} 錯誤`);
        setLoading(false);
        return;
      }
      const aiMsg: Message = {
        role: "ai",
        text: summarizePatch(data.patch),
        patch: data.patch,
        ts: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知錯誤");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }

  function applyPatch(patch: ThemePatch) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) {
      setError("找不到 form");
      return;
    }
    let count = 0;
    const setVal = (name: string, value: string | null | undefined) => {
      if (value === undefined || value === null) return;
      const el = form.elements.namedItem(name) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null;
      if (!el) return;
      el.value = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      count++;
    };

    if (patch.primary) setVal("theme_primary", patch.primary);
    if (patch.accent) setVal("theme_accent", patch.accent);
    if (patch.tagline !== undefined) setVal("theme_tagline", patch.tagline);

    if (patch.layout) {
      const l = patch.layout;
      if (l.heroStyle) setVal("layout_hero_style", l.heroStyle);
      if (l.heroEyebrow !== undefined) setVal("layout_hero_eyebrow", l.heroEyebrow);
      if (l.heroSubtitle !== undefined) setVal("layout_hero_subtitle", l.heroSubtitle);
      if (l.heroImageSide) setVal("layout_hero_image_side", l.heroImageSide);
      if (l.sectionOrder && Array.isArray(l.sectionOrder)) {
        setVal("layout_section_order", l.sectionOrder.join(","));
      }
    }

    if (patch.homepage) {
      const h = patch.homepage;
      if (h.promise !== undefined) setVal("hp_promise", h.promise);
      if (h.collectionsIntro !== undefined)
        setVal("hp_collections_intro", h.collectionsIntro);
      if (h.visitTitle !== undefined) setVal("hp_visit_title", h.visitTitle);
    }

    setMessages((m) => [
      ...m,
      {
        role: "ai",
        text: `已套用 ${count} 個欄位到 form。按下方「儲存設定」才會真正存進去`,
        ts: Date.now(),
      },
    ]);
  }

  return (
    <aside
      className="bg-white rounded-2xl shadow-lg shadow-emerald-700/5 sticky top-6 max-h-[calc(100vh-3rem)] flex flex-col"
      style={{ minHeight: 540 }}
    >
      <header className="p-5 border-b border-emerald-50 flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-sm font-semibold">
          AI
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-emerald-950 text-sm">Sproutly 助手</p>
          <p className="text-[11px] text-emerald-900/55">
            用自然語言改設計，按套用後再儲存
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-3 text-sm"
      >
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-emerald-900/65 leading-relaxed">
              你可以這樣問我：
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={loading}
                className="block w-full text-left px-3 py-2 rounded-xl border border-emerald-100 text-emerald-900 hover:bg-emerald-50/60 transition text-[13px] leading-snug disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`${
              m.role === "user"
                ? "ml-6 rounded-2xl rounded-tr-sm bg-emerald-700 text-white px-3.5 py-2.5"
                : "mr-6 rounded-2xl rounded-tl-sm bg-emerald-50 text-emerald-950 px-3.5 py-2.5"
            }`}
          >
            <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{m.text}</p>
            {m.patch && (
              <button
                type="button"
                onClick={() => applyPatch(m.patch!)}
                className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-emerald-900 text-white text-xs font-medium hover:bg-black transition"
              >
                套用 →
              </button>
            )}
          </div>
        ))}

        {loading && (
          <div className="mr-6 rounded-2xl bg-emerald-50 px-3.5 py-2.5">
            <p className="text-emerald-900/70 text-[13px] animate-pulse">
              想一下…
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-red-700 text-xs">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 border-t border-emerald-50 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="告訴我你要改什麼..."
          disabled={loading}
          className="flex-1 rounded-full px-4 py-2 border border-emerald-100 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full px-4 py-2 bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-40"
        >
          發
        </button>
      </form>
    </aside>
  );
}

function summarizePatch(patch: ThemePatch | undefined): string {
  if (!patch || typeof patch !== "object") return "（無變動）";
  const lines: string[] = [];
  if (patch.primary) lines.push(`主色 → ${patch.primary}`);
  if (patch.accent) lines.push(`Accent → ${patch.accent}`);
  if (patch.tagline !== undefined)
    lines.push(`Tagline → ${trunc(patch.tagline)}`);
  if (patch.layout?.heroStyle) lines.push(`Hero 樣式 → ${patch.layout.heroStyle}`);
  if (patch.layout?.heroEyebrow !== undefined)
    lines.push(`Hero Eyebrow → ${trunc(patch.layout.heroEyebrow)}`);
  if (patch.layout?.heroSubtitle !== undefined)
    lines.push(`Hero 副標 → ${trunc(patch.layout.heroSubtitle)}`);
  if (patch.layout?.heroImageSide)
    lines.push(`Hero 圖位置 → ${patch.layout.heroImageSide}`);
  if (patch.layout?.sectionOrder?.length)
    lines.push(`Section 順序 → ${patch.layout.sectionOrder.join(",")}`);
  if (patch.homepage?.promise !== undefined)
    lines.push(`Promise → ${trunc(patch.homepage.promise)}`);
  if (patch.homepage?.collectionsIntro !== undefined)
    lines.push(`選物 intro → ${trunc(patch.homepage.collectionsIntro)}`);
  if (patch.homepage?.visitTitle !== undefined)
    lines.push(`Visit 標題 → ${trunc(patch.homepage.visitTitle)}`);
  if (lines.length === 0) return "（沒解析到要改的欄位）";
  return lines.join("\n");
}

function trunc(s: string, n = 60): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}
