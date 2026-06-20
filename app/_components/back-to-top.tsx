"use client";

import { useEffect, useState } from "react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsEditing(params.get("edit") === "1");

    const onScroll = () => {
      setVisible(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isEditing) return null;

  const onClick = () => {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    // 捲回頂部後焦點若還留在這顆（隨即隱藏的）按鈕，鍵盤／報讀器使用者的
    // 閱讀位置沒跟著回到頁首，下次 Tab 會從底部繼續。把焦點搬到 skip link
    // 指向的主內容容器（已加 tabIndex=-1），閱讀位置才真的回到頁面開頭。
    // preventScroll 避免 focus() 自己再跳一次、跟上面的平滑捲動打架。
    const main = document.getElementById("main-content");
    main?.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="回到頁面頂部"
      title="回到頂部"
      // 未顯示時除了視覺淡出，也要退出鍵盤 Tab 順序與報讀器——否則
      // pointer-events-none 只擋滑鼠，鍵盤族仍會 Tab 停在這顆看不到的按鈕上。
      tabIndex={visible ? undefined : -1}
      aria-hidden={visible ? undefined : true}
      className={`fixed right-5 sm:right-8 bottom-28 sm:bottom-10 z-20 flex h-11 w-11 items-center justify-center rounded-full transition duration-300 ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      style={{
        background: "var(--store-surface)",
        border: "1px solid var(--store-border)",
        boxShadow: "var(--sproutly-elev-2)",
        color: "var(--store-text)",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
