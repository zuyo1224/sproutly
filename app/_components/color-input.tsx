"use client";

import { useEffect, useRef, useState } from "react";

// 店面設定頁主色／強調色：色盤旁邊那行色碼以前是 server 端直接印 theme.primary，
// 商家自己挑了新顏色、或 AI 助手（ai-edit-panel）改了色盤的值，色碼都還停在存檔前的舊值，
// 看起來像沒改到。改成聽色盤的 input / change，色碼跟著目前選的顏色走。
//
// 色盤維持 defaultValue（不受 React 控制）：AI 助手是直接改 DOM 的 value 再丟事件，
// 受控 input 會被 React 用 state 蓋回去，所以這裡只用原生事件同步旁邊的文字。
export function ColorInput({
  id,
  name,
  defaultValue,
  className,
}: {
  id: string;
  name: string;
  defaultValue: string;
  className?: string;
}) {
  const [hex, setHex] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setHex(el.value);
    el.addEventListener("input", sync);
    el.addEventListener("change", sync);
    return () => {
      el.removeEventListener("input", sync);
      el.removeEventListener("change", sync);
    };
  }, []);

  return (
    <>
      <input
        ref={ref}
        id={id}
        name={name}
        type="color"
        defaultValue={defaultValue}
        className={className}
      />
      <span className="text-sm text-emerald-900/60 font-mono">{hex}</span>
    </>
  );
}
