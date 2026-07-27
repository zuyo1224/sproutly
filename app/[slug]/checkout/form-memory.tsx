"use client";

import { useEffect, useRef } from "react";

// 結帳表單的「打過的字不清空」防呆。單品結帳走 server action：送出後只要 server 端
// 退回（庫存剛被別的客人買走、商品下架、訂單建立失敗），redirect 回這頁只帶得回
// product_id / qty / error，客人打好的姓名、電話、Email、地址、備註、選好的配送
// 與付款方式全部清空——錯誤訊息說「請重新確認」，重新確認的代價卻是整張表單重打。
//
// 購物車結帳沒有「被 server 退回」這條路（fetch 不換頁、錯誤只是塞進紅框，欄位留著），
// 但它一樣會整張清空，只是觸發的動作不同：客人填到一半想起數量要改，按上一頁回購物車
// 調完再點結帳，回來是全新的 React state、什麼都沒了；手機上切去查地址／找超商門市名稱
// 再切回來，分頁被系統回收重載也一樣；不小心下拉重新整理更不用說。這些都是結帳到一半
// 很自然會做的事，代價卻是姓名、電話、Email、地址、備註、配送與付款方式整套重打——
// 跟單品結帳被退回時的下場一模一樣，只是沒人幫它接住。兩條結帳路徑共用這支。
//
// 做法：欄位每次輸入就把值記進 sessionStorage（只留在這個分頁、關掉就丟，
// 姓名電話地址不進網址列、不落地到磁碟以外的地方）；帶著 error 回來時塞回欄位。
// 配送方式的門市／地址欄是「選到才出現」的 React 條件欄位（見 shipping-fields），
// 得先把 radio 用 click() 點回去（走 React onChange 讓欄位長出來），下一個 frame
// 再回填文字欄。正常進頁（沒帶 error）就把舊小抄清掉，上一張單的資料不會塞進新表單。
//
// 回填值一律走這支，而不是直接 `el.value = v`：配送的門市欄與地址欄現在是 React
// 受控欄位（值存在 shipping-fields 的 state 裡），直接寫 DOM 的話 React 完全不知道
// 值變了——畫面上看得到字，state 仍是空字串，等到那個欄位再 render 一次（客人點錯
// 配送方式再點回來、或 React 校正受控值）就把還原的字蓋回空，「打過的字不清空」
// 這件事在最需要它的路徑上失效。用原生 value setter 寫值再補派一個 input 事件，
// React 的 onChange 才收得到、state 跟著同步；非受控欄位（姓名、電話、備註）走同一
// 條路徑結果不變。
function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, v: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, v);
  else el.value = v;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function memoryKey(storageKey: string) {
  return `sproutly_checkout_form_${storageKey}`;
}

// 下單成功後把小抄丟掉，下一張單不會塞著上一張的收件資料。單品結帳走 server action、
// 成功就 redirect 去成功頁，重進結帳頁時 restore 為 false 自然會清；購物車結帳不換頁
// （fetch + router.push），沒有「重進頁面」這一刻，得由送出成功那條路自己清。
export function clearCheckoutFormMemory(storageKey: string) {
  try {
    sessionStorage.removeItem(memoryKey(storageKey));
  } catch {
    /* ignore */
  }
}

// restore：這次進來要不要把小抄塞回欄位。
// - 單品結帳傳 `Boolean(error)`——只有被 server 退回來時才還原，正常進頁就清掉小抄。
// - 購物車結帳恆傳 true——它不換頁，沒有「帶著 error 重進頁面」這回事，客人離開這頁的
//   方式是按上一頁回購物車改數量、手機切去別的 app 被系統丟掉分頁、或不小心重新整理，
//   回來時整張表單本來就是空的，一律還原才有意義；清除改由送出成功後
//   呼叫 clearCheckoutFormMemory 負責。
export function CheckoutFormMemory({
  storageKey,
  restore,
}: {
  storageKey: string;
  restore: boolean;
}) {
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = markerRef.current?.closest("form");
    if (!form) return;
    const key = memoryKey(storageKey);

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

    if (!restore) {
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
              if (typeof v === "string" && !el.value) setFieldValue(el, v);
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
  }, [storageKey, restore]);

  return <span ref={markerRef} hidden />;
}
