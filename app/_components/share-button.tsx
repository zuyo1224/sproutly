"use client";

import { useEffect, useRef, useState } from "react";

// 客人最常做的就是把商品連結貼到 LINE 給朋友看。
// 手機普遍支援系統原生分享面板（一鍵轉到 LINE / IG / 訊息）；
// 桌機或舊瀏覽器沒有 navigator.share 時，退回「複製連結」並給視覺回饋。
export function ShareButton({
  productName,
  className,
  children = "分享",
}: {
  productName: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  async function share() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const shareData = { title: productName, text: productName, url };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // 使用者自己取消分享面板（AbortError）就安靜結束，不要退回複製也不報錯
        if (err instanceof DOMException && err.name === "AbortError") return;
        // 其他錯誤再退回複製連結
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 連剪貼簿都不給就只能放棄，不打擾客人 */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        aria-label="分享這個商品"
        className={className}
      >
        {copied ? "已複製連結" : children}
      </button>
      {/* 走複製連結那條路（桌機／舊瀏覽器沒有系統分享面板）時，按鈕的
          aria-label 是固定的、可見文字變「已複製連結」報讀器讀不到，
          靠這條 sr-only 的 live region 念出來，讓看不到畫面的客人也知道複製成功了。 */}
      <span aria-live="polite" className="sr-only">
        {copied ? "已複製連結" : ""}
      </span>
    </>
  );
}
