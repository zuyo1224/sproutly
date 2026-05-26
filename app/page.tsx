import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <Link
          href="/"
          className="text-emerald-900 font-medium text-lg tracking-tight"
        >
          Sproutly
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6 text-sm">
          <Link
            href="/login"
            className="text-emerald-900/70 hover:text-emerald-900 transition tracking-tight"
          >
            登入
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 transition tracking-tight"
          >
            免費試用
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 sm:px-10 py-16 sm:py-20">
        <div className="max-w-3xl text-center">
          <p
            className="text-[0.6875rem] font-medium uppercase text-emerald-700/70"
            style={{ letterSpacing: "0.4em" }}
          >
            Sproutly · Early Access
          </p>
          <span className="block mt-4 mx-auto h-px w-12 bg-emerald-600/60" />
          <h1
            className="mt-6 text-4xl sm:text-5xl md:text-6xl font-medium text-emerald-950 tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            讓你的小生意
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-lime-600 bg-clip-text text-transparent">
              發芽
            </span>
          </h1>
          <p
            className="mt-8 text-emerald-900/70 max-w-xl mx-auto"
            style={{ fontSize: "1.0625rem", lineHeight: 1.7 }}
          >
            為台灣小商家打造的線上店面。
            <br className="hidden sm:block" />
            商品、訂單、付款，整齊收在你自己的網址。
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="rounded-full bg-emerald-700 px-8 py-4 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20 tracking-tight"
            >
              免費開一間店 →
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-emerald-200 bg-white px-8 py-4 text-emerald-900 font-medium hover:bg-emerald-50 transition tracking-tight"
            >
              已經有帳號
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-6 sm:px-10 py-8 max-w-7xl mx-auto w-full">
        <div className="border-t border-emerald-100/70 pt-6 flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-between text-emerald-900/55">
          <p
            className="text-[0.6875rem] font-medium uppercase"
            style={{ letterSpacing: "0.3em" }}
          >
            © 2026 Sproutly · Made in Taiwan
          </p>
          <p
            className="text-[0.6875rem] font-medium uppercase"
            style={{ letterSpacing: "0.3em" }}
          >
            For Small Makers
          </p>
        </div>
      </footer>
    </div>
  );
}
