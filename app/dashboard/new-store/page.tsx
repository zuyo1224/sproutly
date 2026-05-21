import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createStore } from "./actions";

type SearchParams = Promise<{ error?: string }>;

export default async function NewStorePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50">
      <header className="px-8 py-6 max-w-4xl mx-auto w-full">
        <Link
          href="/dashboard"
          className="text-sm text-emerald-900/70 hover:text-emerald-900 transition inline-flex items-center gap-1"
        >
          ← 回後台
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-8 pb-16">
        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-emerald-700/5">
          <p className="text-xs tracking-widest uppercase text-emerald-600 mb-3">
            New Store
          </p>
          <h1 className="text-3xl font-bold text-emerald-950">開一間店</h1>
          <p className="mt-2 text-emerald-900/60">
            填基本資訊就好，其他細節之後再慢慢補
          </p>

          {error && (
            <div className="mt-6 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form action={createStore} className="mt-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                店名 <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                placeholder="例如：Plantae Market"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                店面網址 <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center rounded-xl border border-emerald-100 overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition">
                <span className="px-4 py-3 bg-emerald-50 text-sm text-emerald-700 border-r border-emerald-100">
                  sproutly.app /
                </span>
                <input
                  name="slug"
                  type="text"
                  required
                  pattern="[a-z0-9\-]+"
                  minLength={3}
                  maxLength={32}
                  placeholder="plantaemarket"
                  className="flex-1 px-4 py-3 outline-none"
                />
              </div>
              <p className="mt-1.5 text-xs text-emerald-900/50">
                小寫英文、數字、連字號（-）。例如 plantaemarket、taihe-studio
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                店介紹（選填）
              </label>
              <textarea
                name="description"
                rows={3}
                placeholder="一兩句話介紹你的店，例如：來自台北的小型植物選物店，專注稀有觀葉與多肉。"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                  聯絡電話（選填）
                </label>
                <input
                  name="contact_phone"
                  type="tel"
                  placeholder="0912-345-678"
                  className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                  聯絡 Email（選填）
                </label>
                <input
                  name="contact_email"
                  type="email"
                  placeholder="hi@example.com"
                  className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                地址（選填）
              </label>
              <input
                name="address"
                type="text"
                placeholder="台北市大安區 ... "
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20"
              >
                建立店面
              </button>
              <Link
                href="/dashboard"
                className="rounded-full border-2 border-emerald-100 bg-white px-6 py-3.5 text-emerald-900/70 font-medium hover:bg-emerald-50 transition"
              >
                取消
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
