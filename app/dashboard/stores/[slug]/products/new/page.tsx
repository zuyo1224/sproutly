import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProduct } from "../actions";
import { SubmitButton } from "@/app/_components/submit-button";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ error?: string }>;

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
        className="text-sm text-emerald-900/70 hover:text-emerald-900 transition inline-block mb-4"
      >
        ← 商品列表
      </Link>

      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-emerald-700/5">
        <p className="text-xs tracking-widest uppercase text-emerald-600 mb-3">
          New Product
        </p>
        <h1 className="text-2xl font-bold text-emerald-950">新增商品</h1>
        <p className="mt-2 text-emerald-900/60">在「{store.name}」上架新商品</p>

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action={createWithSlug} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              商品名稱 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              placeholder="例如：龜背芋 6 吋盆"
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                價格（NT$）<span className="text-red-500">*</span>
              </label>
              <input
                name="price"
                type="number"
                min="0"
                step="1"
                required
                placeholder="850"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">
                庫存（選填）
              </label>
              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                placeholder="留空 = 不追蹤庫存"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              商品描述（選填）
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder="尺寸、照顧方式、特色說明..."
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              商品照片（選填，可選多張）
            </label>
            <input
              name="image_files"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="block w-full text-sm text-emerald-900/80 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 file:transition"
            />
            <p className="mt-1.5 text-xs text-emerald-900/50">
              jpg / png / webp / gif，每張最大 10MB。第一張會當主圖。可按 Cmd 或 Shift 一次選多張
            </p>
            <details className="mt-3">
              <summary className="text-xs text-emerald-900/50 cursor-pointer hover:text-emerald-900/70">
                或貼網路圖片 URL（進階，沒上傳檔案時生效）
              </summary>
              <input
                name="image_url"
                type="url"
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition text-sm"
              />
            </details>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded text-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
            <label
              htmlFor="is_active"
              className="text-sm text-emerald-900/80"
            >
              立即上架（取消打勾 = 先存草稿，客人看不到）
            </label>
          </div>

          <div className="pt-2 flex gap-3">
            <SubmitButton
              pendingText="上傳中，請稍候..."
              className="flex-1 rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 shadow-lg shadow-emerald-700/20"
            >
              新增商品
            </SubmitButton>
            <Link
              href={`/dashboard/stores/${slug}/products`}
              className="rounded-full border-2 border-emerald-100 bg-white px-6 py-3.5 text-emerald-900/70 font-medium hover:bg-emerald-50 transition"
            >
              取消
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
