"use client";

import { useEffect, useRef, useState } from "react";

// 把連結複製到剪貼簿，盡量讓各種瀏覽器都成功：
// 1. 先用現代 Clipboard API（prod 是 HTTPS 安全情境，主流瀏覽器都吃這個）。
// 2. 它在非安全情境（http://）或舊 Safari 是 undefined、權限被擋時會丟錯——
//    這時退回傳統做法：塞一個看不見的 textarea，選取後 execCommand 複製。
// 少了第 2 步時，桌機客人按「分享」會靜靜沒反應、連「已複製」回饋都沒有。
async function copyLink(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* 落到下面的傳統做法 */
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// 客人最常做的就是把商品連結貼到 LINE 給朋友看。
// 手機普遍支援系統原生分享面板（一鍵轉到 LINE / IG / 訊息）；
// 桌機或舊瀏覽器沒有 navigator.share 時，退回「複製連結」並給視覺回饋。
export function ShareButton({
  productName,
  storeName,
  className,
  children = "分享",
}: {
  productName: string;
  storeName?: string;
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
    // 帶上店名，轉到 LINE / IG 的訊息會是「『商品名』· 店名」而不只光禿禿一個商品名，
    // 收到的朋友一眼知道是哪家店的東西（這站的客人多半就是靠 LINE / IG 接的）。
    const text = storeName ? `『${productName}』· ${storeName}` : productName;
    const shareData = { title: productName, text, url };

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

    if (await copyLink(url)) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
    /* 連傳統複製都失敗就只能放棄，不打擾客人 */
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
