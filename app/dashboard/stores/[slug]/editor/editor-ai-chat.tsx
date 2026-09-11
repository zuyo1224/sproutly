"use client";

import { useState, useRef } from "react";
import {
  COMPACT_PATCH_LABELS,
  summarizeThemePatch,
  type ThemePatch,
} from "@/lib/theme-patch-summary";

const SUGGESTIONS = [
  "把 hero 改成 split 樣式",
  "改成雜誌封面風",
  "accent 顏色換深綠色",
  "幫我寫更詩意的 tagline",
  "重寫 promise，慢一點",
];

export function EditorAIChat({
  theme,
  onPatch,
}: {
  theme: Record<string, unknown>;
  onPatch: (patch: ThemePatch) => void;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "ai"; text: string; patch?: ThemePatch }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(prompt: string) {
    if (!prompt.trim() || loading) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setLoading(true);
    try {
      const r = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, theme }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? `${r.status} 錯誤`);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: summarizeThemePatch(data.patch, COMPACT_PATCH_LABELS, 50),
          patch: data.patch,
        },
      ]);
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

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-stone-600 text-xs mb-3">試試問我：</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={loading}
                className="block w-full text-left px-3 py-2 rounded-lg border border-stone-200 text-emerald-900 hover:bg-emerald-50/60 transition text-xs leading-snug disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-6 rounded-2xl rounded-tr-sm bg-emerald-700 text-white px-3 py-2"
                : "mr-6 rounded-2xl rounded-tl-sm bg-stone-100 text-emerald-950 px-3 py-2"
            }
          >
            <p className="whitespace-pre-wrap leading-relaxed text-xs">{m.text}</p>
            {m.patch && (
              <button
                type="button"
                onClick={() => {
                  onPatch(m.patch!);
                  setMessages((mm) => [
                    ...mm,
                    { role: "ai", text: "已套用到畫面，按 Cmd+Z 復原" },
                  ]);
                }}
                className="mt-2 inline-flex px-3 py-1 rounded-full bg-emerald-900 text-white text-[11px] hover:bg-black transition"
              >
                套用 →
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="mr-6 rounded-2xl bg-stone-100 px-3 py-2">
            <p className="text-stone-600 text-xs animate-pulse">想一下…</p>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-red-700 text-xs">
            {error}
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 border-t border-stone-100 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="告訴我想改什麼…"
          disabled={loading}
          className="flex-1 rounded-full px-3 py-1.5 border border-stone-200 text-xs outline-none focus:border-emerald-400 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full px-3 py-1.5 bg-emerald-700 text-white text-xs hover:bg-emerald-800 transition disabled:opacity-40"
        >
          發
        </button>
      </form>
    </div>
  );
}
