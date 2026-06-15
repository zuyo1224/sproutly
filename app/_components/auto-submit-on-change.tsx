"use client";

import { useEffect, useRef } from "react";

// 進階強化（progressive enhancement）：放進一個 GET <form> 裡，會在表單內
// 任何標了 data-autosubmit 的控制項（排序下拉、勾選框）一變動就自動送出，
// 客人不用改完還要去找「套用」按鈕。沒 JavaScript 時整段不生效，「套用」
// 按鈕照樣能用，所以是純加分、不破壞既有行為。
// 故意只綁標了記號的控制項，搜尋文字框不綁——不然每打一個字就送出。
export function AutoSubmitOnChange() {
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;

    const controls = form.querySelectorAll<HTMLElement>("[data-autosubmit]");
    const handler = () => form.requestSubmit();
    controls.forEach((c) => c.addEventListener("change", handler));
    return () =>
      controls.forEach((c) => c.removeEventListener("change", handler));
  }, []);

  return <span ref={anchorRef} hidden aria-hidden="true" />;
}
