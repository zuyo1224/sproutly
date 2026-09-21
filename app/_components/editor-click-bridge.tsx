"use client";

import { useEffect } from "react";
import { clampFreePos } from "@/lib/theme-scale";
import { isPlainObject } from "@/lib/is-plain-object";
import { sanitizeFreePos } from "@/lib/free-positions";
import { resolveInlineListTextPreview, resolveInlineTextPreview } from "@/lib/inline-text-preview";
import { HOMEPAGE_DEFAULTS, HOMEPAGE_DEFAULT_COLLECTIONS, JOURNAL_CARD_DEFAULTS } from "@/app/[slug]/_theme";

// 慢讀卡／選物卡沒存過內容時公開頁畫的預設整組，復原時套字要照同一組對 index
const HOMEPAGE_CARD_DEFAULTS = {
  journalCards: JOURNAL_CARD_DEFAULTS,
  collectionItems: HOMEPAGE_DEFAULT_COLLECTIONS,
} as const;

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
      /* 設了「在這台裝置隱藏」的段落，在編輯畫布上不要真的消失（公開頁那兩條 media query
         見 layout.tsx）。商家一按下去段落就整個不見，等於連要點回去改回來都找不到——
         同一顆按鈕既是開也是關，關掉之後卻沒有東西可以按。
         改成留在原地、淡掉並框一圈虛線：位置還在、點得到、面板上那顆按鈕也還是亮的，
         而「這段在這台裝置不顯示」這件事看一眼就知道。只在 ?edit=1 生效，客人看到的是
         真的不顯示。 */
      @media (max-width: 639.98px) {
        section[data-edit-target][data-hide-on="mobile"] {
          display: block !important;
          opacity: 0.35;
          outline: 2px dashed #94a3b8 !important;
          outline-offset: -4px;
        }
      }
      @media (min-width: 1024px) {
        section[data-edit-target][data-hide-on="desktop"] {
          display: block !important;
          opacity: 0.35;
          outline: 2px dashed #94a3b8 !important;
          outline-offset: -4px;
        }
      }
    `;
    document.head.appendChild(style);

    function commitTextEdit(el: HTMLElement) {
      const field = el.dataset.editField;
      if (!field) return;
      // innerText 不是 textContent：FAQ 答案這種多段落欄位（answer 依換行拆成
      // 多個 <p>）用 textContent 會把段落黏成一串、雙擊後即使沒改字也毀掉換行；
      // innerText 依排版還原換行，存回去再 split 得回原本的段落。
      const value = (el.innerText ?? "").trim();
      el.removeAttribute("contenteditable");
      // 清單卡片的欄位（好評第 2 張的引言、FAQ 第 3 條的問題⋯）多帶一個
      // data-edit-index 說是第幾筆，editor 端才知道要改進哪張卡
      const indexRaw = el.dataset.editIndex;
      const index =
        indexRaw !== undefined && /^\d+$/.test(indexRaw)
          ? Number(indexRaw)
          : undefined;
      if (window.parent !== window) {
        window.parent.postMessage(
          {
            type: "sproutly-edit-text-update",
            field,
            value,
            ...(index !== undefined ? { index } : {}),
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
      // 記住原文，按 Esc 取消時要還原 —— 否則 user 打到一半的字會留在預覽畫面上，
      // 直到下次重繪才消失，看起來像「取消了卻沒取消」。
      // 存 innerHTML 不是 textContent：多段落欄位（FAQ 答案）取消時才能連段落結構一起還原。
      const originalHtml = textEl.innerHTML;
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
          // 先拔掉 blur 監聽，免得移除 contenteditable 連帶觸發 blur 又 commit 一筆原值
          textEl.removeEventListener("blur", onBlur);
          textEl.removeEventListener("keydown", onKey);
          // 還原原文再移掉 contenteditable，讓畫面回到沒編輯前的樣子
          textEl.innerHTML = originalHtml;
          textEl.removeAttribute("contenteditable");
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
      const xClamped = clampFreePos(x);
      const yClamped = clampFreePos(y);

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
      const xClamped = clampFreePos(x);
      const yClamped = clampFreePos(y);

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
    function applyThemePatch(theme: unknown) {
      if (!isPlainObject(theme)) return;
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
          const v = theme[key];
          if (typeof v === "string") root.style.setProperty(cssVar, v);
        }
      }

      // 文字欄位：畫面上每格 [data-edit-field] 都去 theme 找同名的值套回去（讀哪裡、
      // 沒填顯示什麼、要不要拆行，規則在 lib/inline-text-preview，跟公開頁 render 對齊）。
      // 以前這裡只套 tagline 一格，副標、小標、各區段標題雙擊改字後按復原，theme 退了
      // 但預覽的字留在原地，看起來像復原沒作用。
      // 帶 data-edit-index 的清單卡片欄位（好評、FAQ、數字、相簿、慢讀卡、選物卡）
      // 用 index 去 theme 那張清單撈同一筆（FAQ 畫面第幾條對回原始第幾筆的規則在 lib）。
      // 正在雙擊打字中的格子別蓋掉。
      document
        .querySelectorAll<HTMLElement>("[data-edit-field]")
        .forEach((el) => {
          const field = el.dataset.editField;
          if (!field) return;
          if (el.hasAttribute("contenteditable")) return;
          const indexRaw = el.dataset.editIndex;
          let preview;
          if (indexRaw === undefined) {
            preview = resolveInlineTextPreview(theme, field, HOMEPAGE_DEFAULTS);
          } else if (/^\d+$/.test(indexRaw)) {
            preview = resolveInlineListTextPreview(theme, field, Number(indexRaw), HOMEPAGE_CARD_DEFAULTS);
          }
          if (!preview) return;
          if (preview.kind === "text") {
            el.textContent = preview.value;
            return;
          }
          if (preview.kind === "paragraphs") {
            // 跟公開頁 FAQ 答案一樣一段一個 <p class="sproutly-card-desc">，第二段起 mt-3
            el.replaceChildren(
              ...preview.paragraphs.map((line, idx) => {
                const p = document.createElement("p");
                p.className = idx > 0 ? "sproutly-card-desc mt-3" : "sproutly-card-desc";
                p.textContent = line;
                return p;
              }),
            );
            return;
          }
          // 跟公開頁 blockLines 一樣一行一個 <span class="block">
          el.replaceChildren(
            ...preview.lines.map((line) => {
              const span = document.createElement("span");
              span.className = "block";
              span.textContent = line;
              return span;
            }),
          );
        });

      // freePositions 套到 [data-edit-drag]。以前這裡有一張「不套座標」的名單擋舊
      // hero-tagline 殘留座標，主標重新打開拖動（只綁 h1、scope 在米色區塊內）後
      // 名單就一直是空的，已拿掉；沒座標或座標不合法一律走下面清掉 inline 樣式那條。
      const layout = theme.layout;
      const freePositions = isPlainObject(layout) ? layout.freePositions : undefined;
      if (isPlainObject(freePositions)) {
        document
          .querySelectorAll<HTMLElement>("[data-edit-drag]")
          .forEach((el) => {
            const key = el.dataset.editDrag;
            if (!key) return;
            // 守門走 lib/free-positions 的 sanitizeFreePos，跟存檔端、公開頁讀回端同一支：
            // 以前這裡手寫 typeof === "number"，NaN／Infinity 也算過關，left 寫成 "NaN%"
            // 被瀏覽器忽略、position: absolute 卻照設，元素就飄到區塊左上角；超出 0-1 的
            // 值也沒夾，預覽畫的位置跟存進去、公開頁畫出來的對不上。
            const pos = sanitizeFreePos(freePositions[key]);
            if (pos) {
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
      const msg = ev.data as { type?: string; theme?: unknown };
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
