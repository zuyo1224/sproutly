"use client";

import { useState, useEffect, useRef } from "react";

type AssetPhoto = {
  id: number;
  thumb: string;
  large: string;
  original: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  width: number;
  height: number;
};

const PRESET_QUERIES = [
  "plant",
  "interior",
  "minimal",
  "nature",
  "ceramic",
  "garden",
  "studio",
  "still life",
];

/**
 * Asset Picker modal — 對標 Wix Asset Library
 * 從 Pexels free API 拉圖，user 點圖選用 → onSelect 回傳 URL
 */
export function AssetPicker({
  open,
  onClose,
  onSelect,
  title = "從圖庫挑圖",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  title?: string;
}) {
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<AssetPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      load("", 1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function load(q: string, p: number) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/asset-search?q=${encodeURIComponent(q)}&page=${p}`
      );
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? `${r.status} 錯誤`);
        setPhotos([]);
        return;
      }
      if (p === 1) {
        setPhotos(data.photos ?? []);
      } else {
        setPhotos((prev) => [...prev, ...(data.photos ?? [])]);
      }
      setHasNext(Boolean(data.next));
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  function search(q: string) {
    setQuery(q);
    load(q, 1);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-semibold text-emerald-950">{title}</h2>
            <p className="text-[11px] text-stone-500 mt-0.5">
              來自 Pexels 免費圖庫 · 商用可
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-stone-100 text-stone-600 text-lg flex items-center justify-center transition"
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        {/* Search bar */}
        <div className="p-5 border-b border-stone-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = inputRef.current?.value ?? "";
              search(v);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="search"
              defaultValue={query}
              placeholder="搜尋圖片：plant, interior, ceramic, garden..."
              className="flex-1 rounded-full px-4 py-2 border border-stone-200 bg-stone-50 text-sm outline-none focus:border-emerald-400 focus:bg-white transition"
            />
            <button
              type="submit"
              className="rounded-full px-5 py-2 bg-emerald-700 text-white text-sm hover:bg-emerald-800 transition"
            >
              搜
            </button>
          </form>

          {/* Quick query chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {PRESET_QUERIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  if (inputRef.current) inputRef.current.value = q;
                  search(q);
                }}
                className={`text-[11px] px-2.5 py-1 rounded-full transition ${
                  query === q
                    ? "bg-emerald-700 text-white"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Photo grid */}
        <div className="flex-1 overflow-y-auto p-5 bg-stone-50/50">
          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-100 p-5 text-sm text-red-700">
              <p className="font-medium mb-1">無法載入圖庫</p>
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          ) : photos.length === 0 && !loading ? (
            <p className="text-center text-stone-500 py-12">
              {query ? `搜不到「${query}」` : "輸入關鍵字或點上方 quick query"}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p.large);
                      onClose();
                    }}
                    className="group relative aspect-square rounded-lg overflow-hidden bg-stone-200 hover:ring-4 hover:ring-emerald-200 transition"
                    title={`${p.alt} — by ${p.photographer}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumb}
                      alt={p.alt}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                      <p className="text-[10px] text-white/80 truncate">
                        © {p.photographer}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {hasNext && (
                <div className="text-center mt-6">
                  <button
                    type="button"
                    onClick={() => load(query, page + 1)}
                    disabled={loading}
                    className="px-5 py-2 rounded-full border border-stone-200 hover:bg-white text-sm text-stone-700 transition disabled:opacity-40"
                  >
                    {loading ? "載入中…" : "載入更多"}
                  </button>
                </div>
              )}
            </>
          )}

          {loading && photos.length === 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-stone-200 animate-pulse"
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <span>圖庫由 Pexels.com 提供 · 商用免授權</span>
          <span>Esc 關閉</span>
        </div>
      </div>
    </div>
  );
}
