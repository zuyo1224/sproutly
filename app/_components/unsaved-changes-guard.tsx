"use client";

import { useEffect, useRef } from "react";

// 放進表單裡，商家改了還沒存好就關分頁/重整/跳外站時，
// 先跳瀏覽器原生「確定要離開？」——商品的名稱、價格、描述、剛挑好的照片
// 不會因為手滑關掉視窗就無聲消失。沿用編輯器同一套 beforeunload 做法。
//
// 只擋瀏覽器層級的離開（關分頁/重整/打別的網址）。站內按「取消」「商品列表」
// 這種 client 導覽是商家自己要走，刻意不擋以免每次都跳煩人提示。
export function UnsavedChangesGuard() {
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = markerRef.current?.closest("form");
    if (!form) return;

    let dirty = false;
    const markDirty = () => {
      dirty = true;
    };
    // 送出時（含 server action 提交）就當作存好了，不要再擋
    const clearDirty = () => {
      dirty = false;
    };

    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("submit", clearDirty);

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = ""; // Chrome 要設 returnValue 才會跳提示
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("submit", clearDirty);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return <span ref={markerRef} aria-hidden className="hidden" />;
}
