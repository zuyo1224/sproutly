"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    // 送出中不用真的 disabled（焦點會掉到頁首，鍵盤與報讀使用者會迷路），
    // 改 aria-disabled 讓焦點留在原鈕；重複送出在 onClick 擋掉，
    // 在輸入框按 Enter 的隱式送出也會先觸發這顆鈕的 click，一樣擋得到。
    <button
      type="submit"
      aria-disabled={pending}
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
      className={`${className} aria-disabled:opacity-60 aria-disabled:cursor-not-allowed transition`}
    >
      {pending ? (pendingText ?? "處理中...") : children}
    </button>
  );
}
