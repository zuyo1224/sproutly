"use server";
import { formString, formStringOrNull } from "@/lib/form-fields";

import { requireUser } from "@/lib/require-user";
import { uploadImage } from "@/lib/storage";
import { yuanToCents } from "@/lib/format-price";
// 調順序要先拿到整家店「照現在順序排好」的完整清單，破千的店不能只撈第一頁。
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { redirect } from "next/navigation";

const BUCKET = "sproutly-products";

async function authorizedStore(slug: string) {
  const { supabase, user } = await requireUser();

  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!store) redirect("/dashboard");

  return { supabase, store };
}

// 價格上限（元）：DB 的 price_cents 是 integer，上限 21 億多「分」、換成元只有兩千
// 一百多萬。商家手滑多打幾個 0（或想拿超大數字當「面議」）就會打爆，Postgres 丟一串
// 英文「value out of range for type integer」回來，看不懂哪裡錯。先在這裡擋成中文。
// 一千萬元離 DB 上限還有一倍空間，台灣小店也不會有單件破千萬的商品。
const MAX_PRICE_YUAN = 10_000_000;

// 庫存上限：同一個 integer 欄位、同一種打爆法。以前只有列表那格「直接改庫存」擋，
// 新增／編輯頁走的是這支 parseStock，沒擋，同一個數字在列表被中文攔下、在編輯頁卻
// 噴英文原始錯誤。收進 parse 函式讓三條路同一套。
const MAX_STOCK = 1_000_000;

function parsePrice(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("價格必須是非負數");
  if (n > MAX_PRICE_YUAN) {
    throw new Error(
      `價格最多 ${MAX_PRICE_YUAN.toLocaleString("zh-TW")} 元，確認一下是不是多打了幾個 0`
    );
  }
  return n;
}

function parseStock(raw: string): number | null {
  if (raw === "") return null;
  const n = Number(raw);
  // 必須是非負整數：庫存欄只在瀏覽器端靠 <input type="number" step="1"> 擋小數，
  // 那層驗證能被繞過（停用 JS 直接送表單、或行動裝置數字鍵盤本來就打得出小數點）。
  // 沒有這條，"5.5" 會通過這裡、一路送進 DB 的 integer 欄位，Postgres 直接丟出
  // 「invalid input syntax for type integer」這種原始錯誤字串給商家看，看不懂哪裡錯。
  // 跟 lib/product-quantity 的 isValidQty（Number.isInteger 同時擋 NaN／小數／負數）
  // 同一個態度，這裡在插入前就攔下、換成看得懂的中文訊息。
  if (!Number.isInteger(n) || n < 0) throw new Error("庫存必須是非負整數或留空");
  if (n > MAX_STOCK) {
    throw new Error(`庫存最多 ${MAX_STOCK.toLocaleString("zh-TW")} 件，確認一下是不是多打了幾個 0`);
  }
  return n;
}

async function uploadFiles(files: File[], merchantId: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    if (file && file.size > 0) {
      const url = await uploadImage(file, BUCKET, merchantId);
      urls.push(url);
    }
  }
  return urls;
}

type StoreClient = Awaited<ReturnType<typeof authorizedStore>>["supabase"];

// 新商品該拿幾號：列表與客人端逛街頁的預設排序都是 sort_order 升冪、同值再照
// 建立時間新到舊，所以剛上架的那件本來就露在最前面。建店預設每件都是 0，順序
// 其實是靠 created_at 決勝負的；商家一按過箭頭調順序，整批就被重編成 0,1,2…，
// 這時新商品若還是拿 0，就會跟原本的第一件同分，位置又要回頭靠建立時間才決定。
// 直接給「目前最小值 − 1」：不管這家店有沒有調過順序，新商品都明確落在第一格，
// 顯示位置跟以前一模一樣，但序號是它自己的，之後按箭頭不必再靠同分規則推。
// 撈不到（空店、或查詢出錯）就退回 0，不讓排序這件小事擋住上架。
async function topSortOrder(supabase: StoreClient, merchantId: string) {
  const { data } = await supabase
    .from("sproutly_products")
    .select("sort_order")
    .eq("merchant_id", merchantId)
    // sort_order 允許為 null，Postgres 升冪排序把 null 放最後，所以這裡拿到的是
    // 最小的非 null 值；整家店都是 null 時當成 0，新商品的 −1 一樣排在最前面。
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data?.sort_order ?? 0) - 1;
}

export async function createProduct(slug: string, formData: FormData) {
  const baseRedirect = `/dashboard/stores/${slug}/products/new`;
  const { supabase, store } = await authorizedStore(slug);

  const name = formString(formData, "name");
  const description =
    formStringOrNull(formData, "description");
  const priceRaw = formString(formData, "price");
  const stockRaw = formString(formData, "stock");
  const imageUrlRaw = formString(formData, "image_url");
  const isActive = formData.get("is_active") === "on";
  const imageFiles = formData.getAll("image_files") as File[];

  if (!name) {
    redirect(baseRedirect + "?error=" + encodeURIComponent("請填商品名稱"));
  }
  if (!priceRaw) {
    redirect(baseRedirect + "?error=" + encodeURIComponent("請填價格"));
  }

  let price: number;
  let stock: number | null;
  try {
    price = parsePrice(priceRaw);
    stock = parseStock(stockRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "輸入錯誤";
    redirect(baseRedirect + "?error=" + encodeURIComponent(msg));
  }

  let imageUrls: string[] = [];
  if (imageFiles.length > 0) {
    try {
      imageUrls = await uploadFiles(imageFiles, store.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "圖片處理失敗";
      redirect(baseRedirect + "?error=" + encodeURIComponent(msg));
    }
  }
  if (imageUrls.length === 0 && imageUrlRaw) {
    imageUrls = [imageUrlRaw];
  }

  const sortOrder = await topSortOrder(supabase, store.id);

  const { error } = await supabase.from("sproutly_products").insert({
    merchant_id: store.id,
    name,
    description,
    price_cents: yuanToCents(price!),
    currency: "TWD",
    image_urls: imageUrls,
    stock: stock!,
    sort_order: sortOrder,
    is_active: isActive,
  });

  if (error) {
    redirect(baseRedirect + "?error=" + encodeURIComponent(error.message));
  }

  redirect(`/dashboard/stores/${slug}/products`);
}

export async function updateProduct(
  slug: string,
  productId: string,
  formData: FormData
) {
  const baseRedirect = `/dashboard/stores/${slug}/products/${productId}/edit`;
  const { supabase, store } = await authorizedStore(slug);

  const { data: existing } = await supabase
    .from("sproutly_products")
    .select("id, image_urls")
    .eq("id", productId)
    .eq("merchant_id", store.id)
    .maybeSingle();
  if (!existing) {
    redirect(`/dashboard/stores/${slug}/products`);
  }

  const name = formString(formData, "name");
  const description =
    formStringOrNull(formData, "description");
  const priceRaw = formString(formData, "price");
  const stockRaw = formString(formData, "stock");
  const isActive = formData.get("is_active") === "on";
  const imageFiles = formData.getAll("image_files") as File[];
  const removeImageUrls = new Set(
    formData.getAll("remove_image_urls").map(String)
  );

  if (!name) {
    redirect(baseRedirect + "?error=" + encodeURIComponent("請填商品名稱"));
  }
  if (!priceRaw) {
    redirect(baseRedirect + "?error=" + encodeURIComponent("請填價格"));
  }

  let price: number;
  let stock: number | null;
  try {
    price = parsePrice(priceRaw);
    stock = parseStock(stockRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "輸入錯誤";
    redirect(baseRedirect + "?error=" + encodeURIComponent(msg));
  }

  const existingImages: string[] = existing.image_urls ?? [];
  const remaining = existingImages.filter((u) => !removeImageUrls.has(u));

  let newUrls: string[] = [];
  if (imageFiles.length > 0) {
    try {
      newUrls = await uploadFiles(imageFiles, store.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "圖片處理失敗";
      redirect(baseRedirect + "?error=" + encodeURIComponent(msg));
    }
  }

  const finalImages = [...remaining, ...newUrls];

  const { error } = await supabase
    .from("sproutly_products")
    .update({
      name,
      description,
      price_cents: yuanToCents(price!),
      image_urls: finalImages,
      stock: stock!,
      is_active: isActive,
    })
    .eq("id", productId);

  if (error) {
    redirect(baseRedirect + "?error=" + encodeURIComponent(error.message));
  }

  redirect(`/dashboard/stores/${slug}/products`);
}

export async function duplicateProduct(slug: string, productId: string) {
  const { supabase, store } = await authorizedStore(slug);

  const { data: original } = await supabase
    .from("sproutly_products")
    .select("name, description, price_cents, currency, image_urls, stock, sort_order")
    .eq("id", productId)
    .eq("merchant_id", store.id)
    .maybeSingle();
  if (!original) {
    redirect(`/dashboard/stores/${slug}/products`);
  }

  // 副本一律停售起步：商家是要拿去改成另一件（同盆器換品種、同品種換尺寸），
  // 不是要讓店面同時出現兩件一模一樣的在賣。名稱加「（副本）」讓列表分得出
  // 哪件是剛複製的；圖片直接沿用同一批網址不重新上傳，商家編輯時想換再換。
  // sort_order 照抄，副本才會排在原件旁邊，不會掉到列表最尾端找不到。
  const { data: copy, error } = await supabase
    .from("sproutly_products")
    .insert({
      merchant_id: store.id,
      name: `${original.name}（副本）`,
      description: original.description,
      price_cents: original.price_cents,
      currency: original.currency,
      image_urls: original.image_urls,
      stock: original.stock,
      sort_order: original.sort_order,
      is_active: false,
    })
    .select("id")
    .single();

  if (error || !copy) {
    redirect(
      `/dashboard/stores/${slug}/products/${productId}/edit?error=` +
        encodeURIComponent(error?.message ?? "複製失敗，再試一次")
    );
  }

  redirect(`/dashboard/stores/${slug}/products/${copy.id}/edit?copied=1`);
}

// 列表直接改庫存：補到貨、或線下賣掉幾件，以前都得點進商品編輯頁、捲過整個圖片區、
// 改掉數字、按存檔、再退回列表——跟一鍵上下架、訂單一鍵推進是同一個痛點，只是這一格
// 要打數字而不是按一下。
//
// 這裡刻意「不」做上下架那套「原值還是剛剛讀到那個才生效」的比對：上下架是翻面，
// 帶著過期的舊值去翻會把別的分頁剛做的切換又蓋回去；改庫存是商家看著手上實際有幾件
// 打一個絕對值進來，晚打的那個本來就該是對的，比對只會讓正常的修改被擋下來。
//
// 只做「改數字」這一格：欄位留空代表「不再管這件的庫存」（會變成永遠有貨），語意跟
// 打錯字清空太像，留在編輯頁做，列表這裡直接擋下來。
export async function setProductStock(
  slug: string,
  productId: string,
  returnQs: string,
  formData: FormData
) {
  const { supabase, store } = await authorizedStore(slug);
  const listUrl = `/dashboard/stores/${slug}/products${returnQs ? `?${returnQs}` : ""}`;
  // 出錯要跳回原本的篩選＋搜尋，只是多帶一個 error 讓列表把訊息顯出來，
  // 不然商家會被丟回全部列表、還不知道剛剛那筆到底存進去沒有。
  const errorUrl = (msg: string) => {
    const sp = new URLSearchParams(returnQs);
    sp.set("error", msg);
    return `/dashboard/stores/${slug}/products?${sp.toString()}`;
  };

  const raw = formString(formData, "stock");
  if (!raw) {
    redirect(errorUrl("請填庫存數字。要改成不管這件的庫存，請進商品編輯頁把庫存清空"));
  }

  // 上限檢查跟新增／編輯頁一起收在 parseStock 裡，三條路同一句中文。
  let stock: number | null;
  try {
    stock = parseStock(raw);
  } catch (e) {
    redirect(errorUrl(e instanceof Error ? e.message : "庫存輸入錯誤"));
  }

  const { data: product } = await supabase
    .from("sproutly_products")
    .select("id, stock")
    .eq("id", productId)
    .eq("merchant_id", store.id)
    .maybeSingle();
  // 找不到這件就安靜跳回列表：兩個分頁同時開著時，別頁可能剛把它刪掉，
  // 這頁的欄位本來就可能是過期的，不當成錯誤。
  if (!product) {
    redirect(listUrl);
  }
  // 數字沒動就別白寫一趟 DB（商家點進欄位又原樣按存的情況很常見）。
  if (product.stock === stock!) {
    redirect(listUrl);
  }

  const { error } = await supabase
    .from("sproutly_products")
    .update({ stock: stock! })
    .eq("id", productId)
    .eq("merchant_id", store.id);

  if (error) {
    redirect(errorUrl(error.message));
  }

  redirect(listUrl);
}

export async function toggleProductActive(
  slug: string,
  productId: string,
  returnQs: string
) {
  const { supabase, store } = await authorizedStore(slug);
  const listUrl = `/dashboard/stores/${slug}/products${returnQs ? `?${returnQs}` : ""}`;

  // 先讀當前狀態再翻面，而不是讓列表把「目標狀態」傳進來：兩個分頁同時開著
  // 列表時，畫面上的狀態可能已經過期，帶目標值會把別頁剛做的切換又蓋回去。
  const { data: product } = await supabase
    .from("sproutly_products")
    .select("id, is_active")
    .eq("id", productId)
    .eq("merchant_id", store.id)
    .maybeSingle();
  if (!product) {
    redirect(listUrl);
  }

  const { error } = await supabase
    .from("sproutly_products")
    .update({ is_active: !product.is_active })
    .eq("id", productId)
    .eq("merchant_id", store.id);

  if (error) {
    redirect(
      `/dashboard/stores/${slug}/products?error=` +
        encodeURIComponent(error.message)
    );
  }

  redirect(listUrl);
}

export async function deleteProduct(slug: string, productId: string) {
  const { supabase, store } = await authorizedStore(slug);

  const { error } = await supabase
    .from("sproutly_products")
    .delete()
    .eq("id", productId)
    .eq("merchant_id", store.id);

  if (error) {
    redirect(
      `/dashboard/stores/${slug}/products?error=` +
        encodeURIComponent(error.message)
    );
  }

  redirect(`/dashboard/stores/${slug}/products`);
}

// 每次寫回 sort_order 同時發幾筆——Supabase 沒有「一次寫多列不同值」的 API，
// 只能一列一支 update。全部序列跑，商品多的店按一次箭頭要等好幾秒；全部同時發
// 又會把連線塞爆，所以切成小批。
const REORDER_WRITE_CHUNK = 20;

export async function moveProductOrder(
  slug: string,
  productId: string,
  direction: "up" | "down",
  returnQs: string
) {
  const { supabase, store } = await authorizedStore(slug);
  const listUrl = `/dashboard/stores/${slug}/products${returnQs ? `?${returnQs}` : ""}`;

  // 排序條件必須跟商品列表、跟客人端逛街頁的預設排序（sort_order 升冪、同值
  // 再看新舊）逐字一樣，不然商家在後台看到的順序跟客人看到的對不起來，
  // 「往上移一格」會移到別的地方去。分頁撈齊避免破千的店少算尾巴。
  const rows = await fetchAllRows<{ id: string; sort_order: number | null }>(
    async (from, to) =>
      supabase
        .from("sproutly_products")
        .select("id, sort_order")
        .eq("merchant_id", store.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
  );

  const index = rows.findIndex((r) => r.id === productId);
  const target = direction === "up" ? index - 1 : index + 1;
  // 找不到這件、或已經在頭／尾：安靜跳回列表，不當成錯誤。兩個分頁同時開著時
  // 別頁可能剛把它刪掉或移走，畫面上的箭頭本來就可能是過期的。
  if (index < 0 || target < 0 || target >= rows.length) {
    redirect(listUrl);
  }

  [rows[index], rows[target]] = [rows[target], rows[index]];

  // 建店預設每件的 sort_order 都是 0（順序其實是靠新舊決定的），所以第一次調整
  // 一定要把整批重新編號，之後每次就只剩被交換的那兩列真的要寫。
  const pending = rows
    .map((r, i) => ({ id: r.id, sortOrder: i }))
    .filter((r, i) => rows[i].sort_order !== i);

  for (let i = 0; i < pending.length; i += REORDER_WRITE_CHUNK) {
    const chunk = pending.slice(i, i + REORDER_WRITE_CHUNK);
    const results = await Promise.all(
      chunk.map((r) =>
        supabase
          .from("sproutly_products")
          .update({ sort_order: r.sortOrder })
          .eq("id", r.id)
          .eq("merchant_id", store.id)
      )
    );
    const failed = results.find((res) => res.error);
    if (failed?.error) {
      redirect(
        `/dashboard/stores/${slug}/products?error=` +
          encodeURIComponent(failed.error.message)
      );
    }
  }

  redirect(listUrl);
}
