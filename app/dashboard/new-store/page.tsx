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
      <header className="max-w-3xl mx-auto w-full px-6 sm:px-10 pt-10 sm:pt-14">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-emerald-800 hover:text-emerald-950 transition"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.3em",
          }}
        >
          ← Back · 回後台
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 sm:px-10 py-12 sm:py-16">
        <div
          className="rounded-2xl bg-white p-8 sm:p-10 border border-emerald-100/60"
          style={{
            boxShadow:
              "0 1px 2px rgba(6,78,59,0.04), 0 8px 24px rgba(6,78,59,0.06)",
          }}
        >
          <div>
            <p
              className="text-emerald-700/70"
              style={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.4em",
              }}
            >
              New Store · 開店
            </p>
            <span className="block mt-4 h-px w-12 bg-emerald-600/60" />
            <h1
              className="mt-4 text-3xl sm:text-4xl font-medium text-emerald-950 tracking-tight"
              style={{ lineHeight: 1.15 }}
            >
              開一間店
            </h1>
            <p
              className="mt-3 text-emerald-900/65"
              style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
            >
              填基本資訊就好，其他細節之後再慢慢補
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-8 rounded-2xl bg-red-50/80 p-5 border border-red-200/70"
              style={{ boxShadow: "0 1px 2px rgba(127,29,29,0.04)" }}
            >
              <p
                className="text-red-700"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.4em",
                }}
              >
                Notice · 提醒
              </p>
              <p className="mt-2 text-sm text-red-800" style={{ lineHeight: 1.7 }}>
                {error}
              </p>
            </div>
          )}

          <form action={createStore} className="mt-10 space-y-6">
            <div>
              <label
                htmlFor="store-name"
                className="block text-emerald-700/70 mb-2"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.4em",
                }}
              >
                Name · 店名{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">（必填）</span>
              </label>
              <input
                id="store-name"
                name="name"
                type="text"
                required
                aria-required="true"
                placeholder="例如：Plantae Market"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>

            <div>
              <label
                htmlFor="store-slug"
                className="block text-emerald-700/70 mb-2"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.4em",
                }}
              >
                Slug · 店面網址{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">（必填）</span>
              </label>
              <div className="flex items-center rounded-xl border border-emerald-100 overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition">
                <span
                  className="px-4 py-3 bg-emerald-50 text-emerald-700 border-r border-emerald-100 tabular-nums"
                  style={{ fontSize: "0.8125rem", letterSpacing: "-0.005em" }}
                >
                  sproutly.app /
                </span>
                <input
                  id="store-slug"
                  name="slug"
                  type="text"
                  required
                  aria-required="true"
                  aria-describedby="store-slug-help"
                  pattern="[a-z0-9\-]+"
                  minLength={3}
                  maxLength={32}
                  placeholder="plantaemarket"
                  className="flex-1 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none"
                />
              </div>
              <p
                id="store-slug-help"
                className="mt-2 text-emerald-900/55"
                style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}
              >
                小寫英文、數字、連字號（-）。例如 plantaemarket、taihe-studio
              </p>
            </div>

            <div>
              <label
                htmlFor="store-description"
                className="block text-emerald-700/70 mb-2"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.4em",
                }}
              >
                About · 店介紹（選填）
              </label>
              <textarea
                id="store-description"
                name="description"
                rows={3}
                placeholder="一兩句話介紹你的店，例如：來自台北的小型植物選物店，專注稀有觀葉與多肉。"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
                style={{ lineHeight: 1.7 }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="store-phone"
                  className="block text-emerald-700/70 mb-2"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.4em",
                  }}
                >
                  Phone · 聯絡電話
                </label>
                <input
                  id="store-phone"
                  name="contact_phone"
                  type="tel"
                  placeholder="0912-345-678"
                  className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
                />
              </div>
              <div>
                <label
                  htmlFor="store-email"
                  className="block text-emerald-700/70 mb-2"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.4em",
                  }}
                >
                  Email · 聯絡信箱
                </label>
                <input
                  id="store-email"
                  name="contact_email"
                  type="email"
                  placeholder="hi@example.com"
                  className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="store-address"
                className="block text-emerald-700/70 mb-2"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.4em",
                }}
              >
                Address · 地址（選填）
              </label>
              <input
                id="store-address"
                name="address"
                type="text"
                placeholder="台北市大安區 ... "
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 transition shadow-lg shadow-emerald-700/20 tracking-tight"
              >
                建立店面
              </button>
              <Link
                href="/dashboard"
                className="rounded-full border border-emerald-200 bg-white px-6 py-3.5 text-emerald-800 font-medium hover:bg-emerald-50 transition tracking-tight"
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
