// 店面後台子頁的載入骨架。外層 layout（標題列＋店名 hero＋分頁）是共用的、會先渲染好，
// 這裡只補 {children} 那一格——對齊總覽頁的版面（設置進度 + 四指標 + 趨勢/熱銷雙欄 + 近期訂單），
// 載入完從骨架切到真實內容不位移。報讀器只聽一句狀態，骨架整段退出朗讀。
export default function StoreLoading() {
  return (
    <>
      <p role="status" className="sr-only">
        正在整理這間店的資料⋯
      </p>

      <div aria-hidden="true" className="space-y-6">
        {/* 設置進度卡 */}
        <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
          <div className="flex items-start justify-between mb-5 gap-4">
            <div>
              <div className="h-2 w-20 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
              <div className="mt-2.5 h-5 w-28 rounded-md bg-emerald-900/10 sproutly-dash-pulse" />
              <div className="mt-2 h-2.5 w-56 rounded-full bg-emerald-900/6 sproutly-dash-pulse" />
            </div>
            <div className="h-8 w-12 rounded-lg bg-emerald-900/8 sproutly-dash-pulse flex-shrink-0" />
          </div>
          <div className="h-2 w-full rounded-full bg-emerald-50 mb-5" />
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-900/8 sproutly-dash-pulse flex-shrink-0" />
                <div className="h-3 w-44 rounded-full bg-emerald-900/7 sproutly-dash-pulse" />
              </div>
            ))}
          </div>
        </section>

        {/* 四個指標 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 shadow-lg shadow-emerald-700/5"
            >
              <div className="h-2 w-16 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
              <div className="mt-3.5 h-6 w-24 rounded-lg bg-emerald-900/10 sproutly-dash-pulse" />
              <div className="mt-2.5 h-2.5 w-14 rounded-full bg-emerald-900/6 sproutly-dash-pulse" />
            </div>
          ))}
        </div>

        {/* 趨勢圖（寬）＋ 熱銷商品（窄）雙欄 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
            <div className="h-2 w-16 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
            <div className="mt-2.5 h-5 w-40 rounded-md bg-emerald-900/10 sproutly-dash-pulse" />
            {/* 14 根長條，對齊 flex items-end h-40 的趨勢圖；高低交錯模擬資料起伏 */}
            <div className="mt-6 flex items-end gap-1.5 h-40">
              {[40, 65, 30, 80, 55, 70, 45, 90, 35, 60, 50, 75, 42, 68].map(
                (h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-emerald-900/8 sproutly-dash-pulse"
                    style={{ height: `${h}%` }}
                  />
                )
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
            <div className="h-2 w-16 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
            <div className="mt-2.5 h-5 w-24 rounded-md bg-emerald-900/10 sproutly-dash-pulse" />
            <div className="mt-2 h-2.5 w-20 rounded-full bg-emerald-900/6 sproutly-dash-pulse mb-5" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-900/8 sproutly-dash-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="h-3 w-28 rounded-full bg-emerald-900/9 sproutly-dash-pulse" />
                    <div className="mt-1.5 h-2 w-16 rounded-full bg-emerald-900/6 sproutly-dash-pulse" />
                  </div>
                  <div className="h-3 w-12 rounded-full bg-emerald-900/8 sproutly-dash-pulse flex-shrink-0" />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 近期訂單 */}
        <section className="bg-white rounded-2xl p-6 shadow-lg shadow-emerald-700/5">
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="h-2 w-14 rounded-full bg-emerald-900/8 sproutly-dash-pulse" />
              <div className="mt-2.5 h-5 w-24 rounded-md bg-emerald-900/10 sproutly-dash-pulse" />
            </div>
            <div className="h-2.5 w-12 rounded-full bg-emerald-900/6 sproutly-dash-pulse" />
          </div>
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <div className="h-2.5 w-12 rounded-full bg-emerald-900/7 sproutly-dash-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3 w-24 rounded-full bg-emerald-900/9 sproutly-dash-pulse" />
                  <div className="mt-1.5 h-2 w-20 rounded-full bg-emerald-900/6 sproutly-dash-pulse" />
                </div>
                <div className="h-5 w-14 rounded-full bg-emerald-900/7 sproutly-dash-pulse flex-shrink-0" />
                <div className="h-3 w-16 rounded-full bg-emerald-900/8 sproutly-dash-pulse flex-shrink-0" />
              </div>
            ))}
          </div>
        </section>
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
    </>
  );
}
