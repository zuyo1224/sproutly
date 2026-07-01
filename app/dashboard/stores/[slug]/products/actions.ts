"use server";

import { createClient } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/storage";
import { yuanToCents } from "@/lib/format-price";
import { redirect } from "next/navigation";

const BUCKET = "sproutly-products";

async function authorizedStore(slug: string) {
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
  if (!store) redirect("/dashboard");

  return { supabase, store };
}

function parsePrice(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("價格必須是非負數");
  return n;
}

function parseStock(raw: string): number | null {
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error("庫存必須是非負數或留空");
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

export async function createProduct(slug: string, formData: FormData) {
  const baseRedirect = `/dashboard/stores/${slug}/products/new`;
  const { supabase, store } = await authorizedStore(slug);

  const name = String(formData.get("name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const imageUrlRaw = String(formData.get("image_url") ?? "").trim();
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

  const { error } = await supabase.from("sproutly_products").insert({
    merchant_id: store.id,
    name,
    description,
    price_cents: yuanToCents(price!),
    currency: "TWD",
    image_urls: imageUrls,
    stock: stock!,
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

  const name = String(formData.get("name") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
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
