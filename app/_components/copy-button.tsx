"use client";

import { useEffect, useRef, useState } from "react";

// 一鍵把指定文字放進剪貼簿，按完顯示兩秒「已複製」回饋。
// 給「商家要把收件資訊抄去物流單 / LINE」這類照抄場景用，
// 跟 ShareButton 的差別：這裡複製的是固定內容，不走系統分享面板。
export function CopyButton({
  text,
  copiedLabel = "已複製",
  className,
  children,
}: {
  text: string;
  copiedLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪貼簿被擋就算了，不彈錯誤打擾 */
    }
  }

  return (
    <>
      <button type="button" onClick={copy} className={className}>
        {copied ? copiedLabel : children}
      </button>
      {/* 按鈕文字換成「已複製」只有看得到畫面的人收得到。按鈕的名稱
          就是這段文字，名稱變化報讀器不會主動念，補一條 sr-only 即時
          區，複製成功瞬間念出來。 */}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}
