export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50">
      {/* 報讀器：用一句話交代正在載入，下面的骨架純裝飾退出朗讀 */}
      <p role="status" className="sr-only">
        正在整理你的店⋯
      </p>

      <div aria-hidden="true">
        <header className="px-8 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
          <span className="text-emerald-900 font-bold text-xl tracking-tight">
            Sproutly
          </span>
          <div className="h-3.5 w-8 rounded-full bg-emerald-900/10 sproutly-dash-pulse" />
        </header>

        <main className="max-w-5xl mx-auto px-8 pb-16">
          {/* hero：對齊 Dashboard eyebrow + Hi 大標 + 分隔線 + email */}
          <div className="mb-16">
            <div className="h-2.5 w-24 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
            <div className="mt-5 h-10 md:h-12 w-56 rounded-lg bg-emerald-900/10 sproutly-dash-pulse" />
            <div className="mt-5 h-px w-12 bg-emerald-700/30" />
            <div className="mt-5 h-3 w-64 rounded-full bg-emerald-900/7 sproutly-dash-pulse" />
          </div>

          {/* 業績概覽：四張卡片格 */}
          <section className="mb-16">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6"
                  style={{ boxShadow: "var(--sproutly-elev-2)" }}
                >
                  <div className="h-2.5 w-16 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
                  <div className="mt-4 h-7 w-24 rounded-lg bg-emerald-900/10 sproutly-dash-pulse" />
                  <div className="mt-3 h-2.5 w-12 rounded-full bg-emerald-900/6 sproutly-dash-pulse" />
                </div>
              ))}
            </div>
          </section>

          {/* 我的店：區段標題 + 店面卡片格 */}
          <section>
            <div className="mb-10">
              <div className="h-2.5 w-24 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
              <div className="mt-5 h-8 w-28 rounded-lg bg-emerald-900/10 sproutly-dash-pulse" />
              <div className="mt-4 h-px w-12 bg-emerald-700/30" />
              <div className="mt-4 h-3 w-52 rounded-full bg-emerald-900/7 sproutly-dash-pulse" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-7 sm:p-8"
                  style={{ boxShadow: "var(--sproutly-elev-2)" }}
                >
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="h-5 w-32 rounded-md bg-emerald-900/10 sproutly-dash-pulse" />
                    <div className="h-5 w-12 rounded-full bg-emerald-900/7 sproutly-dash-pulse" />
                  </div>
                  <div className="h-2.5 w-40 rounded-full bg-emerald-900/6 sproutly-dash-pulse mb-5" />

                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {Array.from({ length: 3 }).map((__, j) => (
                      <div
                        key={j}
                        className="rounded-lg bg-emerald-50/60 px-2 py-3 flex flex-col items-center"
                      >
                        <div className="h-2 w-8 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
                        <div className="mt-2 h-3 w-6 rounded-full bg-emerald-900/10 sproutly-dash-pulse" />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-emerald-50">
                    <div className="flex-1 h-9 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
                    <div className="flex-1 h-9 rounded-full bg-emerald-900/6 sproutly-dash-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      <style>{`
        @keyframes sproutly-dash-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .sproutly-dash-pulse {
          animation: sproutly-dash-pulse 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .sproutly-dash-pulse { animation: none; opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
