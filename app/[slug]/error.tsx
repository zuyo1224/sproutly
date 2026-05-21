"use client";

import { useEffect } from "react";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sproutly storefront error:", error);
  }, [error]);

  return (
    <div className="px-6 py-24 max-w-2xl mx-auto text-center">
      <div className="mb-8 text-[0.7rem] uppercase tracking-[0.4em] opacity-55">
        Something went wrong
      </div>
      <h1 className="text-3xl md:text-5xl font-medium leading-[1.15] tracking-tight">
        這頁暫時
        <br />
        打不開
      </h1>
      <p className="mt-8 text-base leading-[1.85] opacity-65">
        店家頁面載入時遇到一點小問題，
        <br />
        重新試一次通常就會好。
      </p>
      <div className="mt-12 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={reset}
          className="rounded-full px-7 py-3.5 text-sm font-medium border border-current/15 bg-current/[0.04] hover:bg-current/[0.08] transition"
        >
          再試一次
        </button>
        <a
          href="/"
          className="rounded-full px-7 py-3.5 text-sm font-medium opacity-60 hover:opacity-100 transition"
        >
          回到 Sproutly
        </a>
      </div>
      {error.digest && (
        <p className="mt-10 text-[0.7rem] uppercase tracking-[0.32em] opacity-35 font-mono">
          ref · {error.digest}
        </p>
      )}
    </div>
  );
}
