"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sproutly root error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex flex-col">
      <header className="px-8 py-6 max-w-7xl mx-auto w-full">
        <Link
          href="/"
          className="text-emerald-900 font-bold text-xl tracking-tight hover:opacity-70 transition"
        >
          Sproutly
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="max-w-xl text-center">
          <div className="mb-8 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-700/60">
            Something went wrong
          </div>
          <h1 className="text-4xl md:text-6xl font-medium text-emerald-950 leading-[1.1] tracking-tight">
            這頁
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              暫時打不開
            </span>
          </h1>
          <p className="mt-8 text-base text-emerald-900/65 leading-[1.85]">
            連線中斷或頁面出了一點小問題，
            <br />
            重新試一次通常就會好。
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={reset}
              className="rounded-full bg-emerald-700 px-8 py-4 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
            >
              再試一次
            </button>
            <Link
              href="/"
              className="rounded-full border-2 border-emerald-200 bg-white px-8 py-4 text-emerald-900 font-medium hover:bg-emerald-50 transition"
            >
              回到首頁
            </Link>
          </div>
          {error.digest && (
            <p className="mt-10 text-[0.7rem] uppercase tracking-[0.32em] text-emerald-900/35 font-mono">
              ref · {error.digest}
            </p>
          )}
        </div>
      </main>

      <footer className="px-8 py-6 text-center text-[0.7rem] uppercase tracking-[0.32em] text-emerald-900/40">
        Sproutly · 在台灣設計
      </footer>
    </div>
  );
}
