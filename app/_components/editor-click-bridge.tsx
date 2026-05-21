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
      [data-edit-text] {
        outline-offset: 2px;
        transition: outline 0.15s ease, background-color 0.15s ease;
        cursor: text !important;
      }
      [data-edit-text]:hover {
        outline: 1px dashed #f59e0b !important;
        background-color: rgba(245, 158, 11, 0.06) !important;
      }
      [data-edit-text][contenteditable="true"] {
        outline: 2px solid #f59e0b !important;
        background-color: rgba(245, 158, 11, 0.08) !important;
        cursor: text !important;
      }
      [data-edit-text][contenteditable="true"]:focus {
        outline: 2px solid #d97706 !important;
      }
      [data-edit-drag],
      [data-edit-drag] * {
        cursor: move !important;
      }
      [data-edit-drag]:hover {
        outline: 1px dashed #0ea5e9 !important;
        outline-offset: 8px;
      }
      [data-edit-drag]:hover * {
        cursor: move !important;
      }
      [data-edit-drag][data-dragging="true"] {
        outline: 2px solid #0ea5e9 !important;
        opacity: 0.85;
        transition: none !important;
      }
      html { scroll-behavior: smooth; }
      /* edit mode 禁用 hero parallax + scroll-shrink nav + section stagger
         （這些 scroll-timeline 動畫在 iframe 內會引起 image translate 偏移） */
      .sproutly-hero-parallax,
      .sproutly-nav-shrink,
      .sproutly-stagger > *,
      .sproutly-subtle-fade {
        animation: none !important;
        animation-name: none !important;
        animation-timeline: none !important;
        transform: none !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);

    function commitTextEdit(el: HTMLElement) {
      const field = el.dataset.editField;
      if (!field) return;
      const value = (el.textContent ?? "").trim();
      el.removeAttribute("contenteditable");
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: "sproutly-edit-text-update",
            field,
            value,
          },
          "*"
        );
      }
    }

    function onDblClick(e: MouseEvent) {
      const textEl = (e.target as HTMLElement | null)?.closest("[data-edit-text]") as HTMLElement | null;
      if (!textEl) return;
      e.preventDefault();
      e.stopPropagation();
      textEl.setAttribute("contenteditable", "true");
      textEl.focus();
      // 選取全部文字方便重打
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(textEl);
      sel?.removeAllRanges();
      sel?.addRange(range);

      const onBlur = () => {
        commitTextEdit(textEl);
        textEl.removeEventListener("blur", onBlur);
        textEl.removeEventListener("keydown", onKey);
      };
      const onKey = (ke: KeyboardEvent) => {
        if (ke.key === "Enter" && !ke.shiftKey) {
          ke.preventDefault();
          textEl.blur();
        } else if (ke.key === "Escape") {
          ke.preventDefault();
          textEl.removeAttribute("contenteditable");
          textEl.removeEventListener("blur", onBlur);
          textEl.removeEventListener("keydown", onKey);
        }
      };
      textEl.addEventListener("blur", onBlur);
      textEl.addEventListener("keydown", onKey);
    }

    function onClick(e: MouseEvent) {
      // 在 contentEditable 狀態下不攔截
      const editingNow = (e.target as HTMLElement | null)?.closest('[contenteditable="true"]');
      if (editingNow) return;

      // text-level 雙擊已處理；單擊 text element 不開 section panel（要 section block）
      const textEl = (e.target as HTMLElement | null)?.closest("[data-edit-text]");
      if (textEl) {
        // 落到 section level handler — 但仍處理 section
      }

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
      // contentEditable 內不擋（user 可能在編 text 想點 cursor）
      if ((e.target as HTMLElement | null)?.closest('[contenteditable="true"]')) return;
      const link = (e.target as HTMLElement | null)?.closest("a, button");
      if (link && !link.closest("[data-edit-allow-click]")) {
        e.preventDefault();
      }
    }

    // Phase 5 MVP — drag handling for [data-edit-drag] elements
    let dragState: {
      el: HTMLElement;
      section: HTMLElement;
      startX: number;
      startY: number;
      element: string;
    } | null = null;

    function onMouseDown(e: MouseEvent) {
      // 不要 hijack 雙擊或正在 edit 文字
      if (e.detail >= 2) return;
      if ((e.target as HTMLElement | null)?.closest('[contenteditable="true"]')) return;
      const dragEl = (e.target as HTMLElement | null)?.closest("[data-edit-drag]") as HTMLElement | null;
      if (!dragEl) return;
      // 不在 text 元素 (textarea / button / a) 起拖
      const innerInteractive = (e.target as HTMLElement | null)?.closest("a, button, input, textarea");
      if (innerInteractive && innerInteractive !== dragEl) return;

      // 找父 section（用 hero section 當坐標系）
      const section = dragEl.closest("[data-edit-target]") as HTMLElement | null;
      if (!section) return;

      e.preventDefault();
      e.stopPropagation();

      dragState = {
        el: dragEl,
        section,
        startX: e.clientX,
        startY: e.clientY,
        element: dragEl.dataset.editDrag ?? "unknown",
      };
      dragEl.setAttribute("data-dragging", "true");
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragState) return;
      const { el, section } = dragState;
      const rect = section.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const xClamped = Math.max(0, Math.min(1, x));
      const yClamped = Math.max(0, Math.min(1, y));

      // 即時跟著鼠標（視覺 follow，本地 transform override）
      el.style.left = `${xClamped * 100}%`;
      el.style.top = `${yClamped * 100}%`;
      el.style.transform = "translate(-50%, -50%)";
      el.style.position = "absolute";
    }

    function onMouseUp(e: MouseEvent) {
      if (!dragState) return;
      const { el, section, element } = dragState;
      const rect = section.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const xClamped = Math.max(0, Math.min(1, x));
      const yClamped = Math.max(0, Math.min(1, y));

      el.removeAttribute("data-dragging");
      dragState = null;

      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: "sproutly-edit-position-update",
            element,
            x: xClamped,
            y: yClamped,
          },
          "*"
        );
      }
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDblClick, true);
    document.addEventListener("click", onLinkBlock, false);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dblclick", onDblClick, true);
      document.removeEventListener("click", onLinkBlock, false);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      style.remove();
    };
  }, []);

  return null;
}
