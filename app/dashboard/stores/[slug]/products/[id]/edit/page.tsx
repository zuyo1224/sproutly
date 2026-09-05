import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/require-user";
import { updateProduct, deleteProduct, duplicateProduct } from "../../actions";
import { SubmitButton } from "@/app/_components/submit-button";
import { ImageFilePicker } from "@/app/_components/image-file-picker";
import { UnsavedChangesGuard } from "@/app/_components/unsaved-changes-guard";
import { currencySymbol } from "@/lib/format-price";
import { isUuid } from "@/lib/uuid";
import { isPastedRemoteImageUrl } from "@/lib/image-url";
import {
  MAX_PRICE_YUAN,
  MAX_STOCK,
  MAX_PRODUCT_NAME_LEN,
  MAX_PRODUCT_DESC_LEN,
} from "@/lib/product-limits";

type Params = Promise<{ slug: string; id: string }>;
type SearchParams = Promise<{ error?: string; copied?: string }>;

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
  // 網址上的商品 id 不是 UUID 就直接 404，別拿去查 uuid 欄位（見 lib/uuid.ts）。
  if (!isUuid(id)) notFound();
  const { error, copied } = await searchParams;

  const { supabase, user } = await requireUser();

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
  const duplicateBound = duplicateProduct.bind(null, slug, product.id);
  const price = (product.price_cents / 100).toFixed(0);
  const imageCount = product.image_urls?.length ?? 0;
  // 店面掛不出來的圖：DB 裡更早存進去的 http:// 或漏了網域的半截網址。後台這頁是普通
  // <img>、瀏覽器本機多半照樣顯示得出來，商家看不出哪張有問題；但 https 店面載 http://
  // 圖會被當混合內容擋掉、半截網址會去抓 sproutly 自己網域底下不存在的檔，那張開天窗。
  // 寫入端（貼網址那格）現在已經用同一支 isPastedRemoteImageUrl 擋了，這裡是讓舊值有
  // 地方被看見：判不過就在縮圖上標出來、下面多一句提醒，讓商家勾掉重上傳。
  // 上傳走 Supabase Storage 的公開網址是 https，判得過，不會被誤標。
  const brokenImageCount = (product.image_urls ?? []).filter(
    (u: string) => !isPastedRemoteImageUrl(u),
  ).length;
  // 價格 label 跟著這件商品實際的幣別走，非台幣的商品不再硬寫 NT$（共用 currencySymbol）
  const currencyLabel = currencySymbol(product.currency);

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

        {copied && (
          <div
            role="status"
            className="mt-8 rounded-2xl bg-emerald-50/80 p-5 border border-emerald-200/70"
            style={{ boxShadow: "0 1px 2px rgba(6,78,59,0.04)" }}
          >
            <p className="text-emerald-700" style={LABEL_STYLE}>
              Copied · 已複製
            </p>
            <p
              className="mt-2 text-sm text-emerald-900"
              style={{ lineHeight: 1.7 }}
            >
              這是剛複製出來的副本，目前是停售狀態、客人還看不到。
              改好名稱和價格後勾回「上架中」再儲存就會出現在店裡。
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
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
            <label htmlFor="name" className="block text-emerald-700/70 mb-2" style={LABEL_STYLE}>
              Name · 商品名稱{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
              <span className="sr-only">（必填）</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              aria-required="true"
              maxLength={MAX_PRODUCT_NAME_LEN}
              defaultValue={product.name}
              className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="price"
                className="block text-emerald-700/70 mb-2"
                style={LABEL_STYLE}
              >
                Price · 價格 {currencyLabel}{" "}
                <span className="text-red-500" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">（必填）</span>
              </label>
              <input
                id="price"
                name="price"
                type="number"
                inputMode="numeric"
                min="0"
                max={MAX_PRICE_YUAN}
                step="1"
                required
                aria-required="true"
                defaultValue={price}
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="stock"
                className="block text-emerald-700/70 mb-2"
                style={LABEL_STYLE}
              >
                Stock · 庫存（選填）
              </label>
              <input
                id="stock"
                name="stock"
                type="number"
                inputMode="numeric"
                min="0"
                max={MAX_STOCK}
                step="1"
                defaultValue={product.stock ?? ""}
                placeholder="留空 = 不追蹤庫存"
                className="w-full rounded-xl border border-emerald-100 px-4 py-3 text-emerald-950 placeholder:text-emerald-900/30 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition tabular-nums"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-emerald-700/70 mb-2" style={LABEL_STYLE}>
              About · 商品描述（選填）
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={MAX_PRODUCT_DESC_LEN}
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
                      {!isPastedRemoteImageUrl(url) && (
                        <span
                          className="absolute inset-x-2 bottom-2 px-2 py-1 rounded-lg bg-amber-500 text-white text-center leading-tight"
                          style={{ fontSize: "0.6875rem" }}
                        >
                          店面顯示不出來
                        </span>
                      )}
                      {idx === 0 && (
                        <span
                          className={`absolute left-2 px-2 py-0.5 rounded-full bg-emerald-700 text-white ${
                            isPastedRemoteImageUrl(url) ? "bottom-2" : "top-2"
                          }`}
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
                {brokenImageCount > 0 && (
                  <p
                    className="mt-2 text-amber-700"
                    style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}
                  >
                    有 {brokenImageCount} 張標了「店面顯示不出來」：網址不是 https://
                    開頭的完整網址，客人在店面會看到空白。建議勾掉刪除，再用下面的上傳補回來。
                  </p>
                )}
              </div>
            )}

            <label
              htmlFor="image_files"
              className="block text-emerald-900/55 mb-2"
              style={{ fontSize: "0.8125rem", lineHeight: 1.7 }}
            >
              加新圖片（可選多張）
            </label>
            <ImageFilePicker
              id="image_files"
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

        {/* 複製：店裡常有一批只差品種 / 尺寸的商品，每件都從零填太費工。
            副本帶走名稱（加「（副本）」）、描述、價格、庫存與整批圖片，
            以停售狀態建立，按下去直接跳到副本的編輯頁接著改。 */}
        <form
          action={duplicateBound}
          className="flex items-center justify-between gap-4 flex-wrap"
        >
          <div>
            <p className="text-emerald-700/70" style={LABEL_STYLE}>
              Duplicate · 複製
            </p>
            <p
              className="mt-2 text-sm text-emerald-900/65"
              style={{ lineHeight: 1.7 }}
            >
              要上一件很像的商品？複製這件當底稿，改幾個字就能上架。
              <br />
              副本會先停售，客人不會看到兩件一樣的。
            </p>
          </div>
          <SubmitButton
            pendingText="複製中..."
            className="rounded-full border border-emerald-200 bg-white px-6 py-2.5 text-emerald-800 text-sm font-medium hover:bg-emerald-50 transition tracking-tight"
          >
            複製這件商品
          </SubmitButton>
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
              <SubmitButton
                pendingText="刪除中..."
                className="mt-4 rounded-full bg-red-600 px-6 py-2.5 text-white text-sm font-medium hover:bg-red-700 tracking-tight"
              >
                確定刪除
              </SubmitButton>
            </div>
          </details>
        </form>
      </div>
    </div>
  );
}
