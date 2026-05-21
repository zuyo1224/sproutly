import Link from "next/link";
import { signIn } from "@/app/auth/actions";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

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
            歡迎回來
          </h1>
          <p className="mt-2 text-sm text-emerald-900/60 text-center">
            登入後就能管理你的店面
          </p>

          {error && (
            <div className="mt-6 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form action={signIn} className="mt-6 space-y-4">
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
                placeholder="密碼"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
            >
              登入
            </button>
          </form>

          <p className="mt-6 text-sm text-emerald-900/60 text-center">
            還沒有帳號？{" "}
            <Link
              href="/signup"
              className="text-emerald-700 hover:text-emerald-900 font-medium"
            >
              建立一間店
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
