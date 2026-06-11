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
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "已複製訂單編號" : `複製訂單編號 ${shortId}`}
      className="font-mono inline-flex items-center gap-1.5 align-baseline transition-opacity hover:opacity-70"
      style={{ color: "var(--store-text)", letterSpacing: "0.05em" }}
    >
      <strong style={{ fontWeight: 600 }}>#{shortId}</strong>
      <span
        aria-hidden="true"
        style={{
          color: copied ? "var(--store-accent)" : "var(--store-text-muted)",
          fontSize: "0.6875rem",
          letterSpacing: "0.15em",
          fontFamily: "var(--store-font)",
          opacity: copied ? 1 : 0.75,
        }}
      >
        {copied ? "已複製" : "複製"}
      </span>
    </button>
  );
}
