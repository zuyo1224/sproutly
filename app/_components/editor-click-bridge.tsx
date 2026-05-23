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
      .sproutly-subtle-fade,
      section[data-edit-target][data-anim="fade"],
      section[data-edit-target][data-anim="slide-up"] {
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
    // Bug fix：原本 mousedown 立即進 drag mode，user 沒移動 mouseup 也 fire
    // position-update，導致點 element 不拖也會改位置。改成只有移動 ≥ 5px
    // 才算開始拖，純點擊不觸發 position-update。
    const DRAG_THRESHOLD_PX = 5;
    let dragState: {
      el: HTMLElement;
      section: HTMLElement;
      startX: number;
      startY: number;
      element: string;
      hasDragged: boolean; // 真的有移動超過 threshold
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

      // 先不 preventDefault — 等真正進入 drag 再擋
      dragState = {
        el: dragEl,
        section,
        startX: e.clientX,
        startY: e.clientY,
        element: dragEl.dataset.editDrag ?? "unknown",
        hasDragged: false,
      };
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragState) return;
      const { el, section, startX, startY } = dragState;
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);

      // 還沒超過 threshold — 不算 drag
      if (!dragState.hasDragged) {
        if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
        // 超過 → 正式進入 drag mode
        dragState.hasDragged = true;
        el.setAttribute("data-dragging", "true");
        // 通知 editor 開始 drag（避免 popover 跳出）
        if (window.parent !== window) {
          window.parent.postMessage({ type: "sproutly-edit-drag-start" }, "*");
        }
      }

      e.preventDefault();
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
      const { el, section, element, hasDragged } = dragState;
      const ds = dragState;
      dragState = null;

      // 沒拖過 → 純點擊，不要 fire position-update（讓 onClick handler 正常處理）
      if (!hasDragged) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const xClamped = Math.max(0, Math.min(1, x));
      const yClamped = Math.max(0, Math.min(1, y));

      el.removeAttribute("data-dragging");

      // 防 reference unused warning
      void ds;

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

    // 接 editor 送來的 theme update — 用來支援「undo 不重新整理頁面」
    // editor undo → postMessage theme-apply → iframe 即時套 CSS vars / 文字 / position
    function applyThemePatch(theme: Record<string, unknown>) {
      if (!theme || typeof theme !== "object") return;
      const root = document.querySelector(":root") as HTMLElement | null;
      if (root) {
        // CSS vars（顏色 / 字型）
        const colors: Record<string, string> = {
          "--store-primary": "primary",
          "--store-accent": "accent",
          "--store-bg": "bg",
          "--store-surface": "surface",
          "--store-text": "text",
          "--store-text-muted": "textMuted",
          "--store-border": "border",
        };
        for (const [cssVar, key] of Object.entries(colors)) {
          const v = (theme as Record<string, unknown>)[key];
          if (typeof v === "string") root.style.setProperty(cssVar, v);
        }
      }

      // tagline / eyebrow 等 text 欄位（用 data-edit-field 對應）
      const tagline = (theme as { tagline?: string }).tagline;
      if (typeof tagline === "string") {
        document
          .querySelectorAll<HTMLElement>('[data-edit-field="tagline"]')
          .forEach((el) => {
            // 用 textContent 直接替換（保留 <span class="block"> 結構不容易，先簡單 replace）
            el.textContent = tagline;
          });
      }

      // freePositions 套到 [data-edit-drag]
      // hero-tagline 已重新打開 drag — 但只綁在 h1 上，scope 內 cream block，
      // 不會跑出 hero section 外影響其他 section。
      const SKIP_FREE_POSITION_KEYS = new Set<string>();
      const layout = (theme as { layout?: { freePositions?: Record<string, { x: number; y: number }> } }).layout;
      if (layout?.freePositions && typeof layout.freePositions === "object") {
        document
          .querySelectorAll<HTMLElement>("[data-edit-drag]")
          .forEach((el) => {
            const key = el.dataset.editDrag;
            if (!key) return;
            if (SKIP_FREE_POSITION_KEYS.has(key)) {
              // 強制清掉 inline absolute styles 即使 DB 還留著舊值
              el.style.left = "";
              el.style.top = "";
              el.style.transform = "";
              el.style.position = "";
              return;
            }
            const pos = layout.freePositions![key];
            if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
              el.style.left = `${pos.x * 100}%`;
              el.style.top = `${pos.y * 100}%`;
              el.style.transform = "translate(-50%, -50%)";
              el.style.position = "absolute";
            } else {
              el.style.left = "";
              el.style.top = "";
              el.style.transform = "";
              el.style.position = "";
            }
          });
      }
    }

    function onParentMessage(ev: MessageEvent) {
      if (typeof ev.data !== "object" || !ev.data) return;
      const msg = ev.data as { type?: string; theme?: Record<string, unknown> };
      if (msg.type === "sproutly-theme-apply" && msg.theme) {
        applyThemePatch(msg.theme);
      }
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDblClick, true);
    document.addEventListener("click", onLinkBlock, false);
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("message", onParentMessage);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dblclick", onDblClick, true);
      document.removeEventListener("click", onLinkBlock, false);
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("message", onParentMessage);
      style.remove();
    };
  }, []);

  return null;
}
