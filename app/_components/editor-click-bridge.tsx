"use client";

import { useEffect } from "react";

/**
 * iframe 內公開頁 client island —
 * 偵測 `?edit=1` query param，啟動 click 攔截 + postMessage 傳給 parent editor
 *
 * 流程：
 * 1. layout.tsx 在 RESERVED slug 以外的店面頁載入這個 component
 * 2. 如果 URL ?edit=1，啟動 edit mode（顯示綠色 outline 提示 + 攔截 click）
 * 3. 點任何 `[data-edit-target]` element → postMessage to parent window
 *    { type: "sproutly-edit-click", target: "hero-tagline" / "promise" / etc, label?: string }
 * 4. parent editor 監聽 message → setSelectedSection + 滾右 panel
 */
export function EditorClickBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("edit") !== "1") return;

    // 通知 parent editor 已 ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: "sproutly-edit-ready" }, "*");
    }

    // 注入 edit mode CSS（hover outline + cursor pointer）
    const style = document.createElement("style");
    style.id = "sproutly-edit-mode-style";
    style.textContent = `
      [data-edit-target] {
        outline-offset: 4px;
        cursor: pointer !important;
        transition: outline 0.2s ease;
      }
      [data-edit-target]:hover {
        outline: 2px dashed #10b981 !important;
        background-color: rgba(16, 185, 129, 0.04) !important;
      }
      [data-edit-active] {
        outline: 2px solid #10b981 !important;
        outline-offset: 4px;
      }
      html { scroll-behavior: smooth; }
    `;
    document.head.appendChild(style);

    function onClick(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest("[data-edit-target]") as HTMLElement | null;
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();

      // 視覺 active state
      document
        .querySelectorAll("[data-edit-active]")
        .forEach((el) => el.removeAttribute("data-edit-active"));
      target.setAttribute("data-edit-active", "");

      const editTarget = target.dataset.editTarget;
      const label = target.dataset.editLabel ?? target.textContent?.slice(0, 50) ?? "";
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: "sproutly-edit-click",
            target: editTarget,
            label,
          },
          "*"
        );
      }
    }

    // 攔截所有 link / button 點擊，避免在 edit mode 內 navigate
    function onLinkBlock(e: MouseEvent) {
      const link = (e.target as HTMLElement | null)?.closest("a, button");
      if (link && !link.closest("[data-edit-allow-click]")) {
        e.preventDefault();
      }
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("click", onLinkBlock, false);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("click", onLinkBlock, false);
      style.remove();
    };
  }, []);

  return null;
}
