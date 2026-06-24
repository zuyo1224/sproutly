"use client";

import { useState } from "react";

export default function PasswordInput({
  name,
  placeholder,
  required,
  ariaRequired,
  minLength,
  autoComplete,
}: {
  name: string;
  placeholder?: string;
  required?: boolean;
  ariaRequired?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <input
        name={name}
        type={shown ? "text" : "password"}
        required={required}
        aria-required={ariaRequired ? "true" : undefined}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-emerald-100 px-4 py-3 pr-12 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "隱藏密碼" : "顯示密碼"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-emerald-700/55 hover:text-emerald-800 transition"
      >
        {shown ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
