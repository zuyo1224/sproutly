"use client";

import { useEffect, useRef, useState } from "react";

type Preview = { url: string; name: string; size: number };

/**
 * 照片上傳的 file input + 選檔即時預覽。
 * 商家以前選完照片只看到原生「已選 N 個檔案」字樣，看不出選對沒、順序對沒、
 * 哪張會當主圖；這裡用 createObjectURL 在送出前就把縮圖攤開來，第一張標主圖。
 * 純前端預覽，name="image_files" 維持原樣，server action 收到的 FormData 不變。
 */
export function ImageFilePicker({
  name = "image_files",
  className,
  showCoverBadge = false,
}: {
  name?: string;
  className?: string;
  showCoverBadge?: boolean;
}) {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const urlsRef = useRef<string[]>([]);

  // 卸載時把所有暫存的 object URL 釋放掉，避免記憶體外洩
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // 重新選檔時先釋放上一批，再建新的
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const files = Array.from(e.target.files ?? []);
    const next = files.map((f) => ({
      url: URL.createObjectURL(f),
      name: f.name,
      size: f.size,
    }));
    urlsRef.current = next.map((n) => n.url);
    setPreviews(next);
  }

  function formatSize(bytes: number) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return (
    <>
      <input
        name={name}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleChange}
        className={className}
      />

      {previews.length > 0 && (
        <div className="mt-4">
          <p
            className="text-emerald-900/55 mb-3"
            style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}
          >
            已選 {previews.length} 張，送出後才會真正上傳
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {previews.map((p, idx) => (
              <div key={p.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.name}
                  className="aspect-square w-full object-cover rounded-xl border border-emerald-100"
                />
                {showCoverBadge && idx === 0 && (
                  <span
                    className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-full bg-emerald-700 text-white"
                    style={{
                      fontSize: "0.625rem",
                      letterSpacing: "0.3em",
                      textTransform: "uppercase",
                    }}
                  >
                    Cover
                  </span>
                )}
                <p
                  className="mt-1.5 text-emerald-900/55 truncate"
                  style={{ fontSize: "0.6875rem" }}
                  title={p.name}
                >
                  {p.name}
                </p>
                <p
                  className="text-emerald-900/40 tabular-nums"
                  style={{ fontSize: "0.625rem" }}
                >
                  {formatSize(p.size)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
