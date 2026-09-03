import Link from "next/link";

// Botanic Lab signature —— 兩片子葉從一條莖長出的嫩芽。
// 同時當 header logo（小尺寸）與 hero 焦點（放大、進場抽長）。
function SproutMark({
  className,
  animate = false,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* 莖 */}
      <path
        d="M16 39 V19"
        stroke="var(--sproutly-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        className={animate ? "anim-sprout" : undefined}
        style={animate ? { animationDelay: "0.05s" } : undefined}
      />
      {/* 左子葉 — 葉綠 */}
      <path
        d="M16 24C11.5 24 7 21 5.5 14.5C12 13.5 15.5 18 16 24Z"
        fill="var(--sproutly-leaf)"
        className={animate ? "anim-rise" : undefined}
        style={animate ? { animationDelay: "0.45s" } : undefined}
      />
      {/* 右子葉 — 草綠 sprout */}
      <path
        d="M16 21C20 20.5 24 17 24.5 10C18.5 11 15.5 15.5 16 21Z"
        fill="var(--sproutly-sprout)"
        className={animate ? "anim-rise" : undefined}
        style={animate ? { animationDelay: "0.62s" } : undefined}
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div
      className="relative min-h-screen flex flex-col bg-white"
      style={{
        // 極淡的「實驗室方格」底紋 —— maker / lab 氣質，不靠 emerald 漸層。
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(21,36,27,0.045) 1px, transparent 0)",
        backgroundSize: "28px 28px",
      }}
    >
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between max-w-6xl mx-auto w-full">
        <Link
          href="/"
          className="flex items-center gap-2 group"
          aria-label="Sproutly 首頁"
        >
          <SproutMark className="h-7 w-auto transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span className="text-emerald-900 font-semibold text-lg tracking-tight">
            Sproutly
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-5 text-sm">
          <Link
            href="/login"
            className="px-3 py-2 rounded-lg text-emerald-900/70 hover:text-emerald-900 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.97] transition tracking-tight"
          >
            登入
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:scale-[0.97] transition tracking-tight"
            style={{ boxShadow: "var(--sproutly-elev-1)" }}
          >
            免費試用
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-14 sm:py-20 text-center">
        {/* hero 焦點：放大的嫩芽，從基線抽長 */}
        <SproutMark className="h-16 w-auto mb-8" animate />

        <p
          className="anim-rise font-mono text-[0.7rem] font-medium uppercase text-emerald-700"
          style={{ letterSpacing: "0.32em", animationDelay: "0.15s" }}
        >
          Early Access · 為台灣小商家而生
        </p>

        <h1
          className="anim-rise mt-6 max-w-3xl text-4xl sm:text-5xl md:text-6xl font-semibold text-emerald-950 tracking-tight"
          style={{ lineHeight: 1.12, animationDelay: "0.25s" }}
        >
          讓你的小生意，
          <br />
          長成自己的<span className="text-emerald-600">店</span>。
        </h1>

        <p
          className="anim-rise mt-7 max-w-xl text-emerald-900/65"
          style={{
            fontSize: "1.0625rem",
            lineHeight: 1.75,
            animationDelay: "0.35s",
          }}
        >
          商品、訂單、付款，整齊收在你自己的網址。
          <br className="hidden sm:block" />
          不用懂程式，五分鐘把生意種上線。
        </p>

        <div
          className="anim-rise mt-10 flex flex-col sm:flex-row gap-3 justify-center"
          style={{ animationDelay: "0.45s" }}
        >
          <Link
            href="/signup"
            className="rounded-full bg-emerald-700 px-8 py-4 text-white font-medium hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:scale-[0.98] transition tracking-tight"
            style={{ boxShadow: "var(--sproutly-elev-2)" }}
          >
            免費開一間店 →
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-emerald-200 bg-white/80 px-8 py-4 text-emerald-900 font-medium hover:bg-emerald-50 hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98] transition tracking-tight"
          >
            已經有帳號
          </Link>
        </div>

        {/* lab-style 數據條 —— mono 數字，maker 的量化感，取代多餘裝飾 */}
        <dl
          className="anim-rise mt-16 grid grid-cols-3 gap-px max-w-lg w-full rounded-2xl overflow-hidden border border-emerald-100 bg-emerald-100"
          style={{ animationDelay: "0.55s", boxShadow: "var(--sproutly-elev-1)" }}
        >
          {[
            { n: "$0", l: "開店成本" },
            { n: "5 min", l: "上線時間" },
            { n: "100%", l: "你的網址" },
          ].map((s) => (
            <div key={s.l} className="bg-white px-4 py-5">
              <dt className="font-mono text-xl sm:text-2xl font-semibold text-emerald-900 tracking-tight">
                {s.n}
              </dt>
              <dd className="mt-1 text-[0.7rem] text-emerald-900/55 tracking-wide">
                {s.l}
              </dd>
            </div>
          ))}
        </dl>
      </main>

      <footer className="px-6 sm:px-10 py-8 max-w-6xl mx-auto w-full">
        <div className="border-t border-emerald-100 pt-6 flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-between text-emerald-900/50">
          <p
            className="font-mono text-[0.7rem] font-medium uppercase"
            style={{ letterSpacing: "0.22em" }}
          >
            © 2026 Sproutly · Made in Taiwan
          </p>
          <p
            className="font-mono text-[0.7rem] font-medium uppercase"
            style={{ letterSpacing: "0.22em" }}
          >
            For Small Makers
          </p>
        </div>
      </footer>
    </div>
  );
}
