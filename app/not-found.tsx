import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link
          href="/"
          className="text-emerald-900 font-bold text-xl tracking-tight hover:opacity-70 transition"
        >
          Sproutly
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6 text-sm">
          <Link
            href="/login"
            className="text-emerald-900/70 hover:text-emerald-900 transition"
          >
            登入
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 transition"
          >
            免費試用
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="max-w-2xl text-center">
          <div className="mb-8 text-[0.7rem] uppercase tracking-[0.4em] text-emerald-700/60">
            404 · Page Not Found
          </div>
          <h1 className="text-5xl md:text-7xl font-medium text-emerald-950 leading-[1.05] tracking-tight">
            這條路
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              沒有店面
            </span>
          </h1>
          <p className="mt-8 text-lg text-emerald-900/65 leading-[1.85] max-w-md mx-auto">
            你找的網址可能拼錯了，
            <br />
            或這間店還沒準備好開門。
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="rounded-full bg-emerald-700 px-8 py-4 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
            >
              回到首頁
            </Link>
            <Link
              href="/signup"
              className="rounded-full border-2 border-emerald-200 bg-white px-8 py-4 text-emerald-900 font-medium hover:bg-emerald-50 transition"
            >
              開一間自己的店
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-8 py-6 text-center text-[0.7rem] uppercase tracking-[0.32em] text-emerald-900/40">
        Sproutly · 在台灣設計
      </footer>
    </div>
  );
}
