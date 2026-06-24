import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import PasswordInput from "@/app/_components/password-input";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center px-6 py-20 sm:py-28">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="block text-center text-emerald-900 font-medium text-lg tracking-tight mb-10"
        >
          Sproutly
        </Link>

        <div
          className="rounded-2xl bg-white p-8 sm:p-10 border border-emerald-100/60"
          style={{
            boxShadow:
              "0 1px 2px rgba(6,78,59,0.04), 0 8px 24px rgba(6,78,59,0.06)",
          }}
        >
          <div className="text-center">
            <p
              className="text-[0.6875rem] font-medium uppercase text-emerald-700/70"
              style={{ letterSpacing: "0.4em" }}
            >
              Sign In · 登入
            </p>
            <span className="block mt-4 mx-auto h-px w-12 bg-emerald-600/60" />
            <h1
              className="mt-4 text-3xl sm:text-4xl font-medium text-emerald-950 tracking-tight"
              style={{ lineHeight: 1.15 }}
            >
              歡迎回來
            </h1>
            <p
              className="mt-3 text-emerald-900/65"
              style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
            >
              登入後就能管理你的店面
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-8 rounded-2xl bg-red-50/80 p-5 border border-red-200/70"
              style={{ boxShadow: "0 1px 2px rgba(127,29,29,0.04)" }}
            >
              <p
                className="text-[0.6875rem] font-medium uppercase text-red-700"
                style={{ letterSpacing: "0.4em" }}
              >
                Notice · 提醒
              </p>
              <p className="mt-2 text-sm text-red-800" style={{ lineHeight: 1.7 }}>
                {error}
              </p>
            </div>
          )}

          <form action={signIn} className="mt-8 space-y-5">
            <div>
              <label
                className="block text-[0.6875rem] font-medium uppercase text-emerald-700/70 mb-2"
                style={{ letterSpacing: "0.4em" }}
              >
                Email{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">（必填）</span>
              </label>
              <input
                name="email"
                type="email"
                required
                aria-required="true"
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <div>
              <label
                className="block text-[0.6875rem] font-medium uppercase text-emerald-700/70 mb-2"
                style={{ letterSpacing: "0.4em" }}
              >
                Password · 密碼{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">（必填）</span>
              </label>
              <PasswordInput
                name="password"
                required
                ariaRequired
                autoComplete="current-password"
                placeholder="密碼"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20 tracking-tight"
            >
              登入
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-emerald-100/70 text-center">
            <p
              className="text-[0.6875rem] font-medium uppercase text-emerald-700/70 mb-3"
              style={{ letterSpacing: "0.3em" }}
            >
              New Here · 第一次來
            </p>
            <Link
              href="/signup"
              className="text-emerald-800 hover:text-emerald-950 text-sm font-medium tracking-tight"
            >
              建立一間自己的店 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
