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
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:opacity-60 disabled:cursor-not-allowed transition`}
    >
      {pending ? (pendingText ?? "處理中...") : children}
    </button>
  );
}
