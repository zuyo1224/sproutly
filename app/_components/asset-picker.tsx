"use client";

import { useState, useEffect, useId, useRef } from "react";
import { buildUrl } from "@/lib/url";

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
  // 只給報讀念的載入結果（畫面上看得到圖就知道，報讀使用者聽不到格子換了）
  // 「多載入」只記這次幾張，總數在畫面重畫時用 photos.length 算
  const [status, setStatus] = useState<string | { more: number }>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // 打開時記下原本焦點所在；關掉後焦點掉到 body 就送回去（已被別處拿走就不搶）
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const returnTo = prev instanceof HTMLElement ? prev : null;
    return () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (
          returnTo?.isConnected &&
          (!active || active === document.body)
        ) {
          returnTo.focus();
        }
      });
    };
  }, [open]);

  // 彈窗裡按 Tab 只在彈窗內繞，不跑到後面的編輯器
  function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    if (open) {
      load("", 1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
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
    setStatus("");
    try {
      const r = await fetch(
        buildUrl("/api/asset-search", { q, page: p })
      );
      const data = await r.json();
      if (!r.ok) {
        const msg = data.error ?? `${r.status} 錯誤`;
        setError(msg);
        setPhotos([]);
        setStatus(`無法載入圖庫：${msg}`);
        return;
      }
      const added: number = data.photos?.length ?? 0;
      if (p === 1) {
        setPhotos(data.photos ?? []);
        setStatus(
          added > 0
            ? `找到 ${added} 張圖`
            : q
              ? `搜不到「${q}」`
              : "沒有圖片"
        );
      } else {
        setPhotos((prev) => [...prev, ...(data.photos ?? [])]);
        setStatus({ more: added });
      }
      setHasNext(Boolean(data.next));
      setPage(p);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知錯誤";
      setError(msg);
      setStatus(`無法載入圖庫：${msg}`);
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-emerald-950">
              {title}
            </h2>
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
              aria-label="搜尋圖片"
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

        <p role="status" className="sr-only">
          {typeof status === "string"
            ? status
            : `多載入 ${status.more} 張，共 ${photos.length} 張`}
        </p>

        {/* Photo grid */}
        <div
          className="flex-1 overflow-y-auto p-5 bg-stone-50/50"
          aria-busy={loading}
        >
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
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p.large);
                      onClose();
                    }}
                    className="group relative aspect-square rounded-lg overflow-hidden bg-stone-200 hover:ring-4 hover:ring-emerald-200 outline-none focus-visible:ring-4 focus-visible:ring-emerald-600 transition"
                    title={`${p.alt} — by ${p.photographer}`}
                    // Pexels 有些圖沒有描述（alt 空字串），按鈕名稱改掛在按鈕上，沒描述就念第幾張
                    aria-label={`選用${p.alt ? `「${p.alt}」` : `第 ${i + 1} 張圖`}，攝影 ${p.photographer}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumb}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    {/* 鍵盤聚焦時也壓暗、露出攝影師名，比照滑鼠移上去 */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 group-focus-visible:bg-black/20 transition" />
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition">
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
                    onClick={() => {
                      if (!loading) load(query, page + 1);
                    }}
                    // 不用 disabled：載入中停用會讓焦點掉出圖庫視窗，改 aria-disabled 焦點留在原鈕
                    aria-disabled={loading}
                    className="px-5 py-2 rounded-full border border-stone-200 hover:bg-white text-sm text-stone-700 transition aria-disabled:opacity-40"
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
