"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sproutly dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center px-8 py-12">
      <div className="max-w-xl text-center">
        <div className="mb-8 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-700/60">
          Dashboard Error
        </div>
        <h1 className="text-3xl md:text-5xl font-medium text-emerald-950 leading-[1.15] tracking-tight">
          後台暫時
          <br />
          <span className="bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
            載入不出來
          </span>
        </h1>
        <p className="mt-8 text-base text-emerald-900/65 leading-[1.85]">
          連線中斷或資料庫忙線，
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
            href="/dashboard"
            className="rounded-full border-2 border-emerald-200 bg-white px-8 py-4 text-emerald-900 font-medium hover:bg-emerald-50 transition"
          >
            回主後台
          </Link>
        </div>
        {error.digest && (
          <p className="mt-10 text-[0.7rem] uppercase tracking-[0.32em] text-emerald-900/35 font-mono">
            ref · {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
