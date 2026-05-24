import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProduct } from "../actions";
import { SubmitButton } from "@/app/_components/submit-button";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ error?: string }>;

const LABEL_STYLE = {
  fontSize: "0.6875rem",
  fontWeight: 500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.4em",
};

const BACK_LINK_STYLE = {
  fontSize: "0.6875rem",
  fontWeight: 500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.3em",
};

export default async function NewProductPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id, name")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  const createWithSlug = createProduct.bind(null, slug);

  return (
    <div>
      <Link
        href={`/dashboard/stores/${slug}/products`}
        className="inline-flex items-center gap-2 text-emerald-800 hover:text-emerald-950 transition mb-6"
        style={BACK_LINK_STYLE}
      >
        ← Back · 商品列表
      </Link>

      <div
        className="rounded-2xl bg-white p-8 sm:p-10 border border-emerald-100/60"
        style={{
          boxShadow:
            "0 1px 2px rgba(6,78,59,0.04), 0 8px 24px rgba(6,78,59,0.06)",
        }}
      >
        <div>
          <p className="text-emerald-700/70" style={LABEL_STYLE}>
            New Product · 新商品
          </p>
          <span className="block mt-4 h-px w-12 bg-emerald-600/60" />
          <h1
            className="mt-4 text-3xl sm:text-4xl font-medium text-emerald-950 tracking-tight"
            style={{ lineHeight: 1.15 }}
          >
            上架新商品
          </h1>
          <p
            className="mt-3 text-emerald-900/65"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            在「{store.name}」加一件新商品，必填欄位填完就能存草稿
          </p>
        </div>

        {error && (
          <div
            className="mt-8 rounded-2xl bg-red-50/80 p-5 border border-red-200/70"
            style={{ boxShadow: "0 1px 2px rgba(127,29,29,0.04)" }}
          >
            <p className="text-red-700" style={LABEL_STYLE}>
              Notice · 提醒
            </p>
            <p
              className="mt-2 text-sm text-red-800"
              style={{ lineHeight: 1.7 }}
            >
              {error}
            </p>
          </div>
        )}

        <form action={createWithSlug} className="mt-10 space-y-6">
          <div>
            <label className="block text-emerald-700/70 mb-2" style={LABEL_STYLE}>
              Name · 商品名稱 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="例如：龜背芋 6 吋盆"
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label
                className="block text-emerald-700/70 mb-2"
                style={LABEL_STYLE}
              >
                Price · 價格 NT$ <span className="text-red-500">*</span>
              </label>
              <input
                name="price"
                type="number"
                min="0"
                step="1"
                required
                placeholder="850"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition tabular-nums"
              />
            </div>
            <div>
              <label
                className="block text-emerald-700/70 mb-2"
                style={LABEL_STYLE}
              >
                Stock · 庫存（選填）
              </label>
              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                placeholder="留空 = 不追蹤庫存"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-emerald-700/70 mb-2" style={LABEL_STYLE}>
              About · 商品描述（選填）
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder="尺寸、照顧方式、特色說明..."
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
              style={{ lineHeight: 1.7 }}
            />
          </div>

          <div>
            <label className="block text-emerald-700/70 mb-2" style={LABEL_STYLE}>
              Photos · 商品照片（選填，可選多張）
            </label>
            <input
              name="image_files"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="block w-full text-sm text-emerald-900/80 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 file:transition"
            />
            <p
              className="mt-2 text-emerald-900/55"
              style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}
            >
              jpg / png / webp / gif，每張最大 10MB。第一張會當主圖。可按 Cmd 或 Shift 一次選多張
            </p>
            <details className="mt-4">
              <summary
                className="cursor-pointer text-emerald-900/55 hover:text-emerald-900/80 transition"
                style={{ fontSize: "0.8125rem" }}
              >
                或貼網路圖片 URL（進階，沒上傳檔案時生效）
              </summary>
              <input
                name="image_url"
                type="url"
                placeholder="https://..."
                className="mt-3 w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition text-sm"
              />
            </details>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded text-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
            <label
              htmlFor="is_active"
              className="text-emerald-900/80"
              style={{ fontSize: "0.875rem", lineHeight: 1.7 }}
            >
              立即上架（取消打勾 = 先存草稿，客人看不到）
            </label>
          </div>

          <div className="pt-4 flex gap-3">
            <SubmitButton
              pendingText="上傳中，請稍候..."
              className="flex-1 rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 tracking-tight"
            >
              新增商品
            </SubmitButton>
            <Link
              href={`/dashboard/stores/${slug}/products`}
              className="rounded-full border border-emerald-200 bg-white px-6 py-3.5 text-emerald-800 font-medium hover:bg-emerald-50 transition tracking-tight"
            >
              取消
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
