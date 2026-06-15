import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProduct, deleteProduct } from "../../actions";
import { SubmitButton } from "@/app/_components/submit-button";
import { ImageFilePicker } from "@/app/_components/image-file-picker";
import { UnsavedChangesGuard } from "@/app/_components/unsaved-changes-guard";

type Params = Promise<{ slug: string; id: string }>;
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
  const imageCount = product.image_urls?.length ?? 0;

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
            Edit Product · 編輯商品
          </p>
          <span className="block mt-4 h-px w-12 bg-emerald-600/60" />
          <h1
            className="mt-4 text-3xl sm:text-4xl font-medium text-emerald-950 tracking-tight"
            style={{ lineHeight: 1.15 }}
          >
            {product.name}
          </h1>
          <p
            className="mt-3 text-emerald-900/65"
            style={{ fontSize: "0.9375rem", lineHeight: 1.7 }}
          >
            {product.is_active ? "上架中" : "停售中"} ·{" "}
            {imageCount === 0
              ? "沒有圖片"
              : `${imageCount} 張圖片`}
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

        <form action={updateBound} className="mt-10 space-y-6">
          <UnsavedChangesGuard />
          <div>
            <label className="block text-emerald-700/70 mb-2" style={LABEL_STYLE}>
              Name · 商品名稱 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              required
              defaultValue={product.name}
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
                inputMode="numeric"
                min="0"
                step="1"
                required
                defaultValue={price}
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
                inputMode="numeric"
                min="0"
                step="1"
                defaultValue={product.stock ?? ""}
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
              defaultValue={product.description ?? ""}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition resize-none"
              style={{ lineHeight: 1.7 }}
            />
          </div>

          <div>
            <label className="block text-emerald-700/70 mb-3" style={LABEL_STYLE}>
              Photos · 商品照片
            </label>

            {product.image_urls && product.image_urls.length > 0 && (
              <div className="mb-5">
                <p
                  className="text-emerald-900/55 mb-3"
                  style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}
                >
                  現有圖片（勾選打勾的會被刪除）
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
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
                        <span
                          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-emerald-700 text-white"
                          style={{
                            fontSize: "0.625rem",
                            letterSpacing: "0.3em",
                            textTransform: "uppercase",
                          }}
                        >
                          Cover
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <p
                  className="mt-3 text-emerald-900/55"
                  style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}
                >
                  第一張是主圖。要換主圖：刪掉現在主圖，剩下的第一張會自動變主圖
                </p>
              </div>
            )}

            <p
              className="text-emerald-900/55 mb-2"
              style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}
            >
              加新圖片（可選多張）
            </p>
            <ImageFilePicker
              className="block w-full text-sm text-emerald-900/80 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-800 hover:file:bg-emerald-100 file:transition"
            />
            <p
              className="mt-2 text-emerald-900/55"
              style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}
            >
              jpg / png / webp / gif，每張最大 10MB。新加的會接在現有圖片後面
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              defaultChecked={product.is_active}
              className="w-4 h-4 rounded text-emerald-700 focus:ring-2 focus:ring-emerald-100"
            />
            <label
              htmlFor="is_active"
              className="text-emerald-900/80"
              style={{ fontSize: "0.875rem", lineHeight: 1.7 }}
            >
              上架中（取消打勾 = 停售，客人看不到）
            </label>
          </div>

          <div className="pt-4 flex gap-3">
            <SubmitButton
              pendingText="儲存中..."
              className="flex-1 rounded-full bg-emerald-700 px-8 py-3.5 text-white font-medium hover:bg-emerald-800 shadow-lg shadow-emerald-700/20 tracking-tight"
            >
              儲存變更
            </SubmitButton>
            <Link
              href={`/dashboard/stores/${slug}/products`}
              className="rounded-full border border-emerald-200 bg-white px-6 py-3.5 text-emerald-800 font-medium hover:bg-emerald-50 transition tracking-tight"
            >
              取消
            </Link>
          </div>
        </form>

        <hr className="my-10 border-emerald-100/60" />

        <form action={deleteBound}>
          <details>
            <summary
              className="cursor-pointer inline-block text-red-600 hover:text-red-700 transition"
              style={BACK_LINK_STYLE}
            >
              Danger · 刪除這個商品
            </summary>
            <div
              className="mt-4 rounded-2xl bg-red-50/80 p-5 border border-red-200/70"
              style={{ boxShadow: "0 1px 2px rgba(127,29,29,0.04)" }}
            >
              <p className="text-red-700" style={LABEL_STYLE}>
                Confirm · 確認
              </p>
              <p
                className="mt-2 text-sm text-red-800"
                style={{ lineHeight: 1.7 }}
              >
                確定要刪除「{product.name}」嗎？此動作無法復原。
              </p>
              <button
                type="submit"
                className="mt-4 rounded-full bg-red-600 px-6 py-2.5 text-white text-sm font-medium hover:bg-red-700 transition tracking-tight"
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
