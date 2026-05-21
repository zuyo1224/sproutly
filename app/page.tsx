import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="text-emerald-900 font-bold text-xl tracking-tight">
          Sproutly
        </div>
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
        <div className="max-w-3xl text-center">
          <div className="mb-6 inline-block rounded-full bg-emerald-100 px-4 py-1.5 text-sm text-emerald-800 tracking-wide">
            給台灣小商家的建站平台 · 開發中
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-emerald-950 leading-tight tracking-tight">
            讓你的小生意
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              發芽
            </span>
          </h1>
          <p className="mt-8 text-lg md:text-xl text-emerald-900/70 leading-relaxed max-w-xl mx-auto">
            為小商家打造的線上店面。
            商品、訂單、付款，整齊收在你的網址。
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="rounded-full bg-emerald-700 px-8 py-4 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
            >
              免費開一間店 →
            </Link>
            <Link
              href="/login"
              className="rounded-full border-2 border-emerald-200 bg-white px-8 py-4 text-emerald-900 font-medium hover:bg-emerald-50 transition"
            >
              已經有帳號
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-8 py-6 text-center text-sm text-emerald-900/50">
        © 2026 Sproutly · 在台灣設計 · 給台灣商家
      </footer>
    </div>
  );
}
