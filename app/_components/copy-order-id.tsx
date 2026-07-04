"use client";

import { useEffect, useRef, useState } from "react";

// 訂單成功頁要客人「記下訂單編號」，但編號是被樣式包過的文字，
// 手機很難長按反白複製。把編號本身做成可點的按鈕：點一下複製 #XXXX，
// 給「已複製」回饋，正對 user 長期在意的「怕弄丟東西、沒退路」。
export function CopyOrderId({ shortId }: { shortId: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  async function copy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(`#${shortId}`);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 連剪貼簿都不給就放棄，不打擾客人 */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "已複製訂單編號" : `複製訂單編號 ${shortId}`}
        className="font-mono inline-flex items-center gap-1.5 align-baseline transition-opacity hover:opacity-70"
        style={{
          color: "var(--store-text, currentColor)",
          letterSpacing: "0.05em",
        }}
      >
        <strong style={{ fontWeight: 600 }}>#{shortId}</strong>
        {/* --store-* 變數只在 [slug] 店面注入；後台沒有，全部 fallback 到
            currentColor / inherit，讓按鈕吃所在 eyebrow 的顏色與字體。
            「複製」提示只對螢幕操作有意義，列印訂單時藏掉、只留編號本身。 */}
        <span
          aria-hidden="true"
          className="print:hidden"
          style={{
            color: copied
              ? "var(--store-accent, currentColor)"
              : "var(--store-text-muted, currentColor)",
            fontSize: "0.6875rem",
            letterSpacing: "0.15em",
            fontFamily: "var(--store-font, inherit)",
            opacity: copied ? 1 : 0.75,
          }}
        >
          {copied ? "已複製" : "複製"}
        </span>
      </button>
      {/* 複製成功只把 aria-label 換掉，但焦點停在同一顆按鈕上，名稱變化
          報讀器不會主動念。補一條 sr-only 即時區，按下複製成功才念。 */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "已複製訂單編號" : ""}
      </span>
    </>
  );
}
