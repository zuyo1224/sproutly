import Link from "next/link";
import { signUp } from "@/app/auth/actions";

type SearchParams = Promise<{ error?: string; sent?: string }>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center p-8">
        <div className="max-w-md text-center bg-white rounded-3xl p-12 shadow-xl shadow-emerald-700/5">
          <div className="text-6xl mb-4">📬</div>
          <h1 className="text-2xl font-bold text-emerald-950">
            確認信寄出去囉
          </h1>
          <p className="mt-4 text-emerald-900/70 leading-relaxed">
            我們寄了一封確認信到 <br />
            <strong className="text-emerald-900">{sent}</strong>
            <br />
            <br />
            打開信點裡面的連結就完成註冊。
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block text-emerald-700 hover:text-emerald-900 text-sm font-medium"
          >
            前往登入 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="block text-center text-emerald-900 font-bold text-xl tracking-tight mb-8"
        >
          Sproutly
        </Link>

        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-emerald-700/5">
          <h1 className="text-2xl font-bold text-emerald-950 text-center">
            開一間店
          </h1>
          <p className="mt-2 text-sm text-emerald-900/60 text-center">
            註冊後就能設定你的線上店面
          </p>

          {error && (
            <div className="mt-6 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form action={signUp} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                你的名字
              </label>
              <input
                name="name"
                type="text"
                placeholder="王小芽"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                密碼
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="至少 6 個字"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
            >
              建立帳號
            </button>
          </form>

          <p className="mt-6 text-sm text-emerald-900/60 text-center">
            已經有帳號了？{" "}
            <Link
              href="/login"
              className="text-emerald-700 hover:text-emerald-900 font-medium"
            >
              登入
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
