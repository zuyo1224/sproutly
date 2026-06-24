import Link from "next/link";

// 後台專屬的 404。dashboard 裡有十幾處 notFound()（商家找不到自己的店／商品／訂單時觸發），
// 若這個目錄沒有 not-found.tsx，會 fallback 到平台層 app/not-found.tsx——那是招商行銷頁
// （header「登入／免費試用」、CTA「開一間自己的店」、footer「在台灣設計」）。
// 一個已登入、人就在後台裡的商家，點到剛被刪掉的商品連結，不該被丟去一個叫他「免費試用」的頁。
// 沿用 dashboard/error.tsx 的後台視覺風，把商家帶回主後台而不是平台招商頁。
export default function DashboardNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center px-8 py-12">
      <div className="max-w-xl text-center">
        <div className="mb-8 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-700/60">
          404 · Not Found
        </div>
        <h1 className="text-3xl md:text-5xl font-medium text-emerald-950 leading-[1.15] tracking-tight">
          找不到
          <br />
          <span className="bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
            這個頁面
          </span>
        </h1>
        <p className="mt-8 text-base text-emerald-900/65 leading-[1.85]">
          你找的店面或商品可能已經移除，
          <br />
          或網址打錯了。
        </p>
        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="rounded-full bg-emerald-700 px-8 py-4 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
          >
            回主後台
          </Link>
          <Link
            href="/"
            className="rounded-full border-2 border-emerald-200 bg-white px-8 py-4 text-emerald-900 font-medium hover:bg-emerald-50 transition"
          >
            回 Sproutly 首頁
          </Link>
        </div>
      </div>
    </div>
  );
}
