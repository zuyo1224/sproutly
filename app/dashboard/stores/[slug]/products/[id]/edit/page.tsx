import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProduct, deleteProduct } from "../../actions";
import { SubmitButton } from "@/app/_components/submit-button";

type Params = Promise<{ slug: string; id: string }>;
type SearchParams = Promise<{ error?: string }>;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug, id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) notFound();

  const { data: product } = await supabase
    .from("sproutly_products")
    .select("*")
    .eq("id", id)
    .eq("merchant_id", store.id)
    .maybeSingle();
  if (!product) notFound();

  const updateBound = updateProduct.bind(null, slug, product.id);
  const deleteBound = deleteProduct.bind(null, slug, product.id);
  const price = (product.price_cents / 100).toFixed(0);
  const currentImage =
    product.image_urls && product.image_urls.length > 0
      ? product.image_urls[0]
      : null;

  return (
    <div>
      <Link
        href={`/dashboard/stores/${slug}/products`}
        className="text-sm text-emerald-900/70 hover:text-emerald-900 transition inline-block mb-4"
      >
        ← 商品列表
      </Link>

      <div className="bg-white rounded-3xl p-8 shadow-xl shadow-emerald-700/5">
        <h1 className="text-2xl font-bold text-emerald-950">編輯商品</h1>

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action={updateBound} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">
              商品名稱 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              defaultValue={product.name}
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
                defaultValue={price}
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
                defaultValue={product.stock ?? ""}
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
              defaultValue={product.description ?? ""}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-3">
              商品照片
            </label>

            {product.image_urls && product.image_urls.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-emerald-900/60 mb-2">
                  現有圖片（勾選打勾的會被刪除）
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {product.image_urls.map((url: string, idx: number) => (
                    <label
                      key={url}
                      className="relative group cursor-pointer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`圖 ${idx + 1}`}
                        className="aspect-square w-full object-cover rounded-xl border border-emerald-100 group-has-[:checked]:opacity-40 group-has-[:checked]:ring-2 group-has-[:checked]:ring-red-400 transition"
                      />
                      <input
                        type="checkbox"
                        name="remove_image_urls"
                        value={url}
                        className="absolute top-2 right-2 w-5 h-5 rounded text-red-600 bg-white focus:ring-2 focus:ring-red-100 cursor-pointer"
                      />
                      {idx === 0 && (
                        <span className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-700 text-white">
                          主圖
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-emerald-900/50">
                  第一張是主圖。要換主圖：刪掉現在主圖，剩下的第一張會自動變主圖
                </p>
              </div>
            )}

            <p className="text-xs text-emerald-900/60 mb-2">
              加新圖片（可選多張）
            </p>
            <input
              name="image_files"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="block w-full text-sm text-emerald-900/80 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 file:transition"
            />
            <p className="mt-1.5 text-xs text-emerald-900/50">
              jpg / png / webp / gif，每張最大 10MB
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={product.is_active}
              className="w-4 h-4 rounded text-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
            <label
              htmlFor="is_active"
              className="text-sm text-emerald-900/80"
            >
              上架中（取消打勾 = 停售，客人看不到）
            </label>
          </div>

          <div className="pt-2 flex gap-3">
            <SubmitButton
              pendingText="儲存中..."
              className="flex-1 rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 shadow-lg shadow-emerald-700/20"
            >
              儲存變更
            </SubmitButton>
            <Link
              href={`/dashboard/stores/${slug}/products`}
              className="rounded-full border-2 border-emerald-100 bg-white px-6 py-3.5 text-emerald-900/70 font-medium hover:bg-emerald-50 transition"
            >
              取消
            </Link>
          </div>
        </form>

        <hr className="my-8 border-emerald-100" />

        <form action={deleteBound}>
          <details>
            <summary className="text-sm text-red-600 hover:text-red-700 cursor-pointer inline-block">
              刪除這個商品
            </summary>
            <div className="mt-3 rounded-xl bg-red-50 border border-red-100 p-4">
              <p className="text-sm text-red-700">
                確定要刪除「{product.name}」嗎？此動作無法復原。
              </p>
              <button
                type="submit"
                className="mt-3 rounded-full bg-red-600 px-6 py-2.5 text-white text-sm font-medium hover:bg-red-700 transition"
              >
                確定刪除
              </button>
            </div>
          </details>
        </form>
      </div>
    </div>
  );
}
