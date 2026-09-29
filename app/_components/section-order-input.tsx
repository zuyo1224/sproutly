"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeSectionOrder, withRequiredSections } from "@/lib/theme-keys";

// 店面設定頁「首頁區塊順序」：以前是一格手打英文代號（hero,collections,…）的文字框，
// 商家得對照說明裡的代號表才排得出來，打錯字或漏逗號也不會有提示。
// 改成一列中文區塊名、每列有「上移／下移」按鈕，排好的順序照舊用逗號串成
// layout_section_order 塞進隱藏欄位送出，存檔端（settings/actions.ts）不用動。
//
// 按鈕點擊不會觸發表單的 input / change 事件，UnsavedChangesGuard 就不知道有改過；
// 所以每次移動後手動從隱藏欄位丟一個會冒泡的 change 事件，讓關分頁前一樣會跳提醒。
//
// AI 助手（ai-edit-panel）改順序是直接改隱藏欄位的 value 再丟 change 事件，不經過這裡的 state；
// 沒接的話清單畫面停在舊順序，存下去的卻是 AI 的順序，下次按上移下移又會被 state 蓋回舊的。
// 所以聽隱藏欄位的 change，值跟畫面不一樣就照存檔端同一套整理後更新清單。
export function SectionOrderInput({
  name,
  defaultOrder,
  labels,
}: {
  name: string;
  defaultOrder: string[];
  labels: Record<string, string>;
}) {
  const [order, setOrder] = useState(defaultOrder);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = hiddenRef.current;
    if (!el) return;
    const sync = () => {
      const next = withRequiredSections(sanitizeSectionOrder(el.value.split(",")));
      setOrder((cur) => (cur.join(",") === next.join(",") ? cur : next));
    };
    el.addEventListener("change", sync);
    return () => el.removeEventListener("change", sync);
  }, []);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
    // 先把 DOM 值改成新順序再丟事件，不然上面的 sync 讀到舊值會把清單拉回去
    if (hiddenRef.current) hiddenRef.current.value = next.join(",");
    hiddenRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const btn =
    "rounded-lg border border-emerald-100 bg-white px-2.5 py-1 text-xs text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:opacity-30 disabled:pointer-events-none";

  return (
    <>
      <input ref={hiddenRef} type="hidden" name={name} value={order.join(",")} />
      <ol className="rounded-xl border border-emerald-100 bg-white divide-y divide-emerald-50">
        {order.map((key, i) => {
          const label = labels[key] ?? key;
          return (
            <li key={key} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-5 text-xs text-emerald-900/40 tabular-nums">
                {i + 1}
              </span>
              <span className="flex-1 text-sm text-emerald-900">{label}</span>
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={`把「${label}」往上移`}
                className={btn}
              >
                上移
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === order.length - 1}
                aria-label={`把「${label}」往下移`}
                className={btn}
              >
                下移
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}
