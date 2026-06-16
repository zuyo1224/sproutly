import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateStore } from "./actions";
import { SubmitButton } from "@/app/_components/submit-button";
import {
  PRESETS,
  PRESET_LABELS,
  FONT_LABELS,
  resolveTheme,
  HOMEPAGE_DEFAULTS,
  HOMEPAGE_DEFAULT_COLLECTIONS,
  HERO_STYLES,
  type PresetKey,
  type FontKey,
} from "@/app/[slug]/_theme";
import { AIEditPanel } from "@/app/_components/ai-edit-panel";
import { UnsavedChangesGuard } from "@/app/_components/unsaved-changes-guard";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ error?: string; saved?: string }>;

export default async function StoreSettingsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { error, saved } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("*")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  const updateBound = updateStore.bind(null, slug);

  const businessHoursText =
    typeof store.business_hours === "object" && store.business_hours !== null
      ? ((store.business_hours as { text?: string }).text ?? "")
      : "";
  const faqText =
    typeof store.faq === "object" && store.faq !== null
      ? ((store.faq as { text?: string }).text ?? "")
      : "";

  const theme = resolveTheme(store.theme);

  // 給 AI panel 用的 theme 快照（client component 用）
  const themeSnapshot = {
    primary: theme.primary,
    accent: theme.accent,
    tagline: theme.tagline,
    layout: theme.layout,
    homepage: {
      promise: theme.homepage.promise,
      collectionsIntro: theme.homepage.collectionsIntro,
      visitTitle: theme.homepage.visitTitle,
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div>
      <div className="mb-8">
        <p
          className="text-emerald-700/70"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.4em",
          }}
        >
          Settings · 店面設定
        </p>
        <span className="block mt-3 h-px w-12 bg-emerald-600/60" />
        <h2
          className="mt-4 text-3xl sm:text-4xl font-medium text-emerald-950 tracking-tight"
          style={{ lineHeight: 1.15 }}
        >
          店面設定
        </h2>
        <p
          className="mt-3 text-emerald-900/65"
          style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
        >
          基本資訊、聯絡、視覺風格、首頁文案都在這裡。改完按最下面的儲存
        </p>
      </div>

      {error && (
        <div
          className="mb-6 rounded-2xl bg-red-50/80 p-5 border border-red-200/70"
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
      {saved && (
        <div
          className="mb-6 rounded-2xl bg-emerald-50/80 p-5 border border-emerald-200/70 animate-in fade-in slide-in-from-top-2"
          style={{
            boxShadow:
              "0 1px 2px rgba(6,78,59,0.04), 0 8px 24px rgba(6,78,59,0.06)",
          }}
        >
          <p
            className="text-emerald-700/80"
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.4em",
            }}
          >
            Saved · 已儲存
          </p>
          <p
            className="mt-2 text-emerald-900/75"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            你的店面資訊已更新
            {store.is_published && (
              <>
                。客人現在能在{" "}
                <Link
                  href={`/${store.slug}`}
                  target="_blank"
                  className="underline hover:text-emerald-900"
                >
                  sproutly.app/{store.slug}
                </Link>{" "}
                看到
              </>
            )}
          </p>
        </div>
      )}

      <form id="store-settings-form" action={updateBound} className="space-y-6">
        {/* 店面設定一頁要填的東西多（基本資訊/聯絡/營業/FAQ/視覺/首頁文案/版面），
            填到一半手滑關分頁或重整最痛——沿用商品表單同一套未存提醒先攔下 */}
        <UnsavedChangesGuard />
        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg shadow-emerald-700/5">
          <div className="mb-5">
            <p
              className="text-emerald-700/70"
              style={{
                fontSize: "0.6875rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.4em",
              }}
            >
              Status · 發布狀態
            </p>
            <span className="block mt-3 h-px w-10 bg-emerald-600/60" />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="is_published"
              defaultChecked={store.is_published}
              className="mt-1 w-5 h-5 rounded text-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
            <div>
              <p className="font-medium text-emerald-950">
                公開到 sproutly.app/{store.slug}
              </p>
              <p className="text-sm text-emerald-900/60 mt-1">
                打勾後客人就能直接看到你的店和商品。取消打勾會變回草稿狀態
              </p>
            </div>
          </label>
        </section>

        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg shadow-emerald-700/5 space-y-5">
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
              About · 基本資訊
            </p>
            <span className="block mt-3 h-px w-10 bg-emerald-600/60" />
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              店名 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              defaultValue={store.name}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              店介紹
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={store.description ?? ""}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg shadow-emerald-700/5 space-y-5">
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
              Contact · 聯絡資訊
            </p>
            <span className="block mt-3 h-px w-10 bg-emerald-600/60" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                電話
              </label>
              <input
                name="contact_phone"
                type="tel"
                defaultValue={store.contact_phone ?? ""}
                placeholder="0912-345-678"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                Email
              </label>
              <input
                name="contact_email"
                type="email"
                defaultValue={store.contact_email ?? ""}
                placeholder="hi@example.com"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              地址
            </label>
            <input
              name="address"
              type="text"
              defaultValue={store.address ?? ""}
              placeholder="台北市 ..."
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg shadow-emerald-700/5 space-y-5">
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
              Hours · 營業資訊
            </p>
            <span className="block mt-3 h-px w-10 bg-emerald-600/60" />
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              營業時間
            </label>
            <textarea
              name="business_hours"
              rows={5}
              defaultValue={businessHoursText}
              placeholder={"週一 - 週五 10:00-19:00\n週六 11:00-20:00\n週日 公休"}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none font-mono text-sm"
            />
            <div className="mt-2 rounded-lg bg-emerald-50/60 border border-emerald-100 p-3 text-xs text-emerald-900/70 space-y-1">
              <p className="font-medium text-emerald-900">怎麼填？</p>
              <p>· 一行一筆，自由格式</p>
              <p>· 範例：<span className="font-mono">週一 - 週五 10:00-19:00</span></p>
              <p>· 公休那天可以寫：<span className="font-mono">週日 公休</span></p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              常見問題 FAQ
            </label>
            <textarea
              name="faq"
              rows={10}
              defaultValue={faqText}
              placeholder={
                "Q: 有出貨到外島嗎？\nA: 有，但外島地區運費另計。\n\nQ: 可以面交嗎？\nA: 可以，地點為台北車站。"
              }
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none text-sm"
            />
            <div className="mt-2 rounded-lg bg-emerald-50/60 border border-emerald-100 p-3 text-xs text-emerald-900/70 space-y-1">
              <p className="font-medium text-emerald-900">怎麼填？</p>
              <p>· 問題用 <span className="font-mono">Q:</span> 開頭，答案用 <span className="font-mono">A:</span> 開頭</p>
              <p>· 一組 Q+A 之間空一行</p>
              <p>· 範例：</p>
              <pre className="font-mono whitespace-pre-wrap text-emerald-900/60 pl-3 border-l-2 border-emerald-200">{`Q: 有出貨到外島嗎？
A: 有，運費另計。

Q: 可以面交嗎？
A: 可以，地點為台北車站。`}</pre>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg shadow-emerald-700/5 space-y-6">
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
              Style · 視覺風格
            </p>
            <span className="block mt-3 h-px w-10 bg-emerald-600/60" />
            <p className="text-xs text-emerald-900/50 mt-3" style={{ lineHeight: 1.7 }}>
              改完按最下面的「儲存設定」，公開店面立刻變樣
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-3">
              選風格底
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
                const p = PRESETS[key];
                const meta = PRESET_LABELS[key];
                return (
                  <label key={key} className="cursor-pointer block">
                    <input
                      type="radio"
                      name="theme_preset"
                      value={key}
                      defaultChecked={theme.preset === key}
                      className="peer sr-only"
                    />
                    <div className="rounded-xl border-2 border-emerald-100 peer-checked:border-emerald-600 peer-checked:bg-emerald-50/40 p-3 transition hover:border-emerald-300">
                      <div className="flex gap-1 mb-2">
                        <div
                          className="flex-1 h-10 rounded-md"
                          style={{ background: p.bg }}
                        />
                        <div
                          className="w-6 h-10 rounded-md"
                          style={{ background: p.primary }}
                        />
                        <div
                          className="w-4 h-10 rounded-md"
                          style={{ background: p.accent }}
                        />
                      </div>
                      <p className="text-sm font-medium text-emerald-900">
                        {meta.label}
                      </p>
                      <p className="text-xs text-emerald-900/50 mt-0.5">
                        {meta.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label htmlFor="theme_primary" className="block text-sm font-medium text-emerald-900 mb-1.5">
                主色（按鈕、連結）
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="theme_primary"
                  name="theme_primary"
                  type="color"
                  defaultValue={theme.primary}
                  className="w-14 h-12 rounded-lg border border-emerald-100 cursor-pointer"
                />
                <span className="text-sm text-emerald-900/60 font-mono">
                  {theme.primary}
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="theme_accent" className="block text-sm font-medium text-emerald-900 mb-1.5">
                強調色（標語、價格）
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="theme_accent"
                  name="theme_accent"
                  type="color"
                  defaultValue={theme.accent}
                  className="w-14 h-12 rounded-lg border border-emerald-100 cursor-pointer"
                />
                <span className="text-sm text-emerald-900/60 font-mono">
                  {theme.accent}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              字體
            </label>
            <select
              name="theme_font"
              defaultValue={theme.font}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition bg-white"
            >
              {(Object.keys(FONT_LABELS) as FontKey[]).map((key) => (
                <option key={key} value={key}>
                  {FONT_LABELS[key].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              Logo
            </label>
            {theme.logoUrl && (
              <div className="mb-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={theme.logoUrl}
                  alt="Logo"
                  className="h-14 w-14 rounded-lg object-contain bg-emerald-50 border border-emerald-100"
                />
                <label className="text-sm text-emerald-900/70 flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="theme_remove_logo"
                    className="w-4 h-4 rounded text-red-600"
                  />
                  移除 Logo
                </label>
              </div>
            )}
            <input
              name="theme_logo_file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="block w-full text-sm text-emerald-900/80 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 file:transition"
            />
            <p className="mt-1.5 text-xs text-emerald-900/50">
              建議方型或 SVG。沒上傳時店面 header 會顯示店名文字
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              Hero 大圖（首頁頂部）
            </label>
            {theme.heroUrl && (
              <div className="mb-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={theme.heroUrl}
                  alt="Hero"
                  className="h-20 w-32 rounded-lg object-cover bg-emerald-50 border border-emerald-100"
                />
                <label className="text-sm text-emerald-900/70 flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="theme_remove_hero"
                    className="w-4 h-4 rounded text-red-600"
                  />
                  移除 Hero
                </label>
              </div>
            )}
            <input
              name="theme_hero_file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-emerald-900/80 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 file:transition"
            />
            <p className="mt-1.5 text-xs text-emerald-900/50">
              建議 1920×1080 以上，會自動 cover 縮放
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-3">
              顯示哪些區塊
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "section_about", label: "關於頁", defaultChecked: theme.sections.about },
                { name: "section_contact", label: "聯絡資訊", defaultChecked: theme.sections.contact },
                { name: "section_hours", label: "營業時間", defaultChecked: theme.sections.hours },
                { name: "section_faq", label: "FAQ", defaultChecked: theme.sections.faq },
                { name: "section_social", label: "頁尾社群連結", defaultChecked: theme.sections.social },
              ].map((s) => (
                <label key={s.name} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-100 hover:bg-emerald-50/40 transition cursor-pointer">
                  <input
                    type="checkbox"
                    name={s.name}
                    defaultChecked={s.defaultChecked}
                    className="w-4 h-4 rounded text-emerald-700"
                  />
                  <span className="text-sm text-emerald-900">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-emerald-900">
              社群連結（會出現在頁尾，只有勾選「頁尾社群連結」才顯示）
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label htmlFor="social_instagram" className="text-xs text-emerald-900/60 w-20">Instagram</label>
                <input
                  id="social_instagram"
                  name="social_instagram"
                  type="url"
                  defaultValue={theme.social.instagram ?? ""}
                  placeholder="https://www.instagram.com/your-store"
                  className="flex-1 rounded-lg border border-emerald-100 px-3 py-2 outline-none focus:border-emerald-400 transition text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="social_facebook" className="text-xs text-emerald-900/60 w-20">Facebook</label>
                <input
                  id="social_facebook"
                  name="social_facebook"
                  type="url"
                  defaultValue={theme.social.facebook ?? ""}
                  placeholder="https://www.facebook.com/your-store"
                  className="flex-1 rounded-lg border border-emerald-100 px-3 py-2 outline-none focus:border-emerald-400 transition text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="social_line" className="text-xs text-emerald-900/60 w-20">LINE OA</label>
                <input
                  id="social_line"
                  name="social_line"
                  type="url"
                  defaultValue={theme.social.line ?? ""}
                  placeholder="https://line.me/R/ti/p/@xxx"
                  className="flex-1 rounded-lg border border-emerald-100 px-3 py-2 outline-none focus:border-emerald-400 transition text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              底部標語（選填）
            </label>
            <input
              name="theme_tagline"
              type="text"
              defaultValue={theme.tagline ?? ""}
              placeholder="例如：手作好物，從生活開始"
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>
        </section>

        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg shadow-emerald-700/5 space-y-6">
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
              Homepage · 首頁文案
            </p>
            <span className="block mt-3 h-px w-10 bg-emerald-600/60" />
            <p className="text-xs text-emerald-900/50 mt-3" style={{ lineHeight: 1.7 }}>
              選物提案標題、Promise 承諾、來店標題、動畫開關。留空就用預設文字
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              選物提案中標
            </label>
            <textarea
              name="hp_collections_intro"
              rows={2}
              defaultValue={
                theme.homepage.collectionsIntro ??
                HOMEPAGE_DEFAULTS.collectionsIntro
              }
              placeholder={HOMEPAGE_DEFAULTS.collectionsIntro}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
            />
            <p className="mt-1 text-xs text-emerald-900/50">
              用逗號 / 句號自動分行
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-3">
              選物提案 6 個（標題空白 = 不顯示這格）
            </label>
            <div className="space-y-3">
              {HOMEPAGE_DEFAULT_COLLECTIONS.map((def) => {
                const userVal = theme.homepage.collectionItems.find(
                  (c) => c.key === def.key
                );
                const title = userVal?.title ?? def.title;
                const subtitle = userVal?.subtitle ?? def.subtitle;
                return (
                  <div
                    key={def.key}
                    className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-2 items-center bg-emerald-50/40 rounded-xl p-3"
                  >
                    <span className="text-xs font-mono text-emerald-900/60 uppercase">
                      {def.key}
                    </span>
                    <input
                      name={`hp_collection_${def.key}_title`}
                      type="text"
                      defaultValue={title}
                      placeholder={def.title}
                      className="rounded-lg border border-emerald-100 px-3 py-2 outline-none focus:border-emerald-400 transition text-sm"
                    />
                    <input
                      name={`hp_collection_${def.key}_subtitle`}
                      type="text"
                      defaultValue={subtitle}
                      placeholder={def.subtitle}
                      className="rounded-lg border border-emerald-100 px-3 py-2 outline-none focus:border-emerald-400 transition text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              Promise 承諾文字（一行一句）
            </label>
            <textarea
              name="hp_promise"
              rows={4}
              defaultValue={theme.homepage.promise ?? HOMEPAGE_DEFAULTS.promise}
              placeholder={HOMEPAGE_DEFAULTS.promise}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              來店標題
            </label>
            <input
              name="hp_visit_title"
              type="text"
              defaultValue={
                theme.homepage.visitTitle ?? HOMEPAGE_DEFAULTS.visitTitle
              }
              placeholder={HOMEPAGE_DEFAULTS.visitTitle}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="hp_enable_animation"
              defaultChecked={theme.homepage.enableAnimation}
              className="mt-1 w-5 h-5 rounded text-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
            <div>
              <p className="font-medium text-emerald-950">
                啟用首頁滾動動畫
              </p>
              <p className="text-sm text-emerald-900/60 mt-1">
                打開後每個 section 進入視窗時會有克制版的 fade in（1 秒淡入 + 上滑 24px）。關閉就完全靜止
              </p>
            </div>
          </label>
        </section>

        {/* ===== 版面設計（hero variant + section order）===== */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg shadow-emerald-700/5 space-y-6">
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
              Layout · 版面設計
            </p>
            <span className="block mt-3 h-px w-10 bg-emerald-600/60" />
            <p className="text-xs text-emerald-900/50 mt-3" style={{ lineHeight: 1.7 }}>
              4 種首屏 layout 變體 + 拖曳調整首頁 section 順序
            </p>
          </div>

          <div>
            <label
              htmlFor="layout_hero_style"
              className="block text-sm font-medium text-emerald-900 mb-2"
            >
              Hero 樣式
            </label>
            <select
              id="layout_hero_style"
              name="layout_hero_style"
              defaultValue={theme.layout.heroStyle}
              className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              {HERO_STYLES.map((h) => (
                <option key={h.key} value={h.key}>
                  {h.label} — {h.description}
                </option>
              ))}
            </select>
            <p className="text-xs text-emerald-900/55 mt-2">
              full-image / magazine 需要 Hero 圖；minimal 不需要；split 也建議放圖。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="layout_hero_eyebrow"
                className="block text-sm font-medium text-emerald-900 mb-2"
              >
                Hero Eyebrow（小標）
              </label>
              <input
                id="layout_hero_eyebrow"
                name="layout_hero_eyebrow"
                type="text"
                defaultValue={theme.layout.heroEyebrow ?? ""}
                placeholder="Est. 2019 / Issue 03 / Spring Collection..."
                className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <p className="text-xs text-emerald-900/55 mt-2">
                Magazine / Split / Minimal 樣式會顯示，全大寫小字
              </p>
            </div>
            <div>
              <label
                htmlFor="layout_hero_image_side"
                className="block text-sm font-medium text-emerald-900 mb-2"
              >
                Split 圖片位置
              </label>
              <select
                id="layout_hero_image_side"
                name="layout_hero_image_side"
                defaultValue={theme.layout.heroImageSide}
                className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="left">圖在左、文字在右</option>
                <option value="right">文字在左、圖在右</option>
              </select>
              <p className="text-xs text-emerald-900/55 mt-2">
                只在 Hero 樣式選「左右分割」時生效
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="layout_hero_subtitle"
              className="block text-sm font-medium text-emerald-900 mb-2"
            >
              Hero 副標 / 引文（選填）
            </label>
            <textarea
              id="layout_hero_subtitle"
              name="layout_hero_subtitle"
              defaultValue={theme.layout.heroSubtitle ?? ""}
              rows={2}
              placeholder="一段詩意的副標，給 Split / Magazine / Minimal 用..."
              className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 resize-none"
            />
          </div>

          <div>
            <label
              htmlFor="layout_section_order"
              className="block text-sm font-medium text-emerald-900 mb-2"
            >
              首頁 Section 順序
            </label>
            <input
              id="layout_section_order"
              name="layout_section_order"
              type="text"
              defaultValue={theme.layout.sectionOrder.join(",")}
              className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-mono outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="text-xs text-emerald-900/55 mt-2">
              逗號分隔（不要空白）。可用 key：
              <code className="px-1 mx-0.5 bg-emerald-50 rounded">hero</code>
              <code className="px-1 mx-0.5 bg-emerald-50 rounded">collections</code>
              <code className="px-1 mx-0.5 bg-emerald-50 rounded">featured</code>
              <code className="px-1 mx-0.5 bg-emerald-50 rounded">journal</code>
              <code className="px-1 mx-0.5 bg-emerald-50 rounded">promise</code>
              <code className="px-1 mx-0.5 bg-emerald-50 rounded">visit</code>
              。沒列到的 section 自動 append 在尾巴。
            </p>
          </div>
        </section>

        <div className="pt-2 flex gap-3">
          <SubmitButton
            pendingText="儲存中..."
            className="flex-1 rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 tracking-tight"
          >
            儲存設定
          </SubmitButton>
          <Link
            href={`/dashboard/stores/${slug}`}
            className="rounded-full border border-emerald-200 bg-white px-6 py-3.5 text-emerald-800 font-medium hover:bg-emerald-50 transition tracking-tight"
          >
            取消
          </Link>
        </div>
      </form>
      </div>

      {/* AI 助手 panel（對標 Wix Aria）— sticky 右側 360px */}
      <div className="hidden lg:block">
        <AIEditPanel
          currentTheme={themeSnapshot}
          formId="store-settings-form"
        />
      </div>
    </div>
  );
}
