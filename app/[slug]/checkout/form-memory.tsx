"use client";

import { useEffect, useRef } from "react";

// 結帳表單的「打過的字不清空」防呆。單品結帳走 server action：送出後只要 server 端
// 退回（庫存剛被別的客人買走、商品下架、訂單建立失敗），redirect 回這頁只帶得回
// product_id / qty / error，客人打好的姓名、電話、Email、地址、備註、選好的配送
// 與付款方式全部清空——錯誤訊息說「請重新確認」，重新確認的代價卻是整張表單重打。
// 購物車結帳是 fetch 不換頁、欄位天生留著，只有單品這條有這個洞。
//
// 做法：欄位每次輸入就把值記進 sessionStorage（只留在這個分頁、關掉就丟，
// 姓名電話地址不進網址列、不落地到磁碟以外的地方）；帶著 error 回來時塞回欄位。
// 配送方式的門市／地址欄是「選到才出現」的 React 條件欄位（見 shipping-fields），
// 得先把 radio 用 click() 點回去（走 React onChange 讓欄位長出來），下一個 frame
// 再回填文字欄。正常進頁（沒帶 error）就把舊小抄清掉，上一張單的資料不會塞進新表單。
export function CheckoutFormMemory({
  storageKey,
  hasError,
}: {
  storageKey: string;
  hasError: boolean;
}) {
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = markerRef.current?.closest("form");
    if (!form) return;
    const key = `sproutly_checkout_form_${storageKey}`;

    // 記的只有客人親手填／選的欄位：hidden（product_id、quantity）與 disabled
    // （「即將推出」的付款方式）不收，radio 只收選中的那顆。
    function save() {
      if (!form) return;
      const data: Record<string, string> = {};
      form
        .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          "input[name], textarea[name]"
        )
        .forEach((el) => {
          if (el.disabled) return;
          if (el instanceof HTMLInputElement) {
            if (el.type === "hidden") return;
            if (el.type === "radio") {
              if (el.checked) data[el.name] = el.value;
              return;
            }
          }
          if (el.value) data[el.name] = el.value;
        });
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        /* sessionStorage 不給寫就算了，不影響下單 */
      }
    }

    if (!hasError) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    } else {
      let saved: Record<string, unknown> | null = null;
      try {
        const raw = sessionStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          saved = parsed;
        }
      } catch {
        saved = null;
      }
      if (saved) {
        const entries = Object.entries(saved).filter(
          (e): e is [string, string] => typeof e[1] === "string"
        );
        // 先點 radio（配送／付款）：走 React 的 onChange，門市／地址欄才會長出來。
        for (const [name, value] of entries) {
          const radio = form.querySelector<HTMLInputElement>(
            `input[type="radio"][name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`
          );
          if (radio && !radio.checked && !radio.disabled) radio.click();
        }
        // 下一個 frame 條件欄位已 mount，再回填文字欄。只填還空著的，
        // 不蓋掉客人在還原前就開始打的字。
        requestAnimationFrame(() => {
          const byName = new Map(entries);
          form
            .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
              "input[name], textarea[name]"
            )
            .forEach((el) => {
              if (
                el instanceof HTMLInputElement &&
                (el.type === "hidden" || el.type === "radio")
              ) {
                return;
              }
              const v = byName.get(el.name);
              if (typeof v === "string" && !el.value) el.value = v;
            });
        });
      }
    }

    // 用 input + change 雙掛而不是攔 submit：每次輸入就記，瀏覽器當掉、
    // 誤按上一頁也還留著；也不用賭 React 19 form action 的 submit 事件時序。
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
    };
  }, [storageKey, hasError]);

  return <span ref={markerRef} hidden />;
}
