"use server";
import { formString, formStringOrNull } from "@/lib/form-fields";

import { requireUser } from "@/lib/require-user";
import { redirect } from "next/navigation";

// app/ 底下的頂層靜態路由段（含 Next 自動掛在根路徑的 metadata 圖），
// 靜態段優先於 [slug]，slug 撞名整間店面會被平台頁蓋掉、永遠打不開
const RESERVED_SLUGS = new Set([
  "api",
  "auth",
  "dashboard",
  "login",
  "signup",
  "opengraph-image",
  "twitter-image",
]);

export async function createStore(formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = formString(formData, "name");
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const description =
    formStringOrNull(formData, "description");
  const contact_phone =
    formStringOrNull(formData, "contact_phone");
  const contact_email =
    formStringOrNull(formData, "contact_email");
  const address = formStringOrNull(formData, "address");

  if (!name) {
    redirect("/dashboard/new-store?error=" + encodeURIComponent("請填店名"));
  }
  if (!slug) {
    redirect("/dashboard/new-store?error=" + encodeURIComponent("請填店面網址"));
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    redirect(
      "/dashboard/new-store?error=" +
        encodeURIComponent("店面網址只能小寫英文、數字、連字號（-）")
    );
  }
  if (slug.length < 3 || slug.length > 32) {
    redirect(
      "/dashboard/new-store?error=" +
        encodeURIComponent("店面網址 3 到 32 個字")
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    redirect(
      "/dashboard/new-store?error=" +
        encodeURIComponent(`網址「${slug}」是系統保留字，換一個試試`)
    );
  }

  // 檢查 slug 是否被別人佔用
  const { data: existing } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    redirect(
      "/dashboard/new-store?error=" +
        encodeURIComponent(`網址「${slug}」已被使用，換一個試試`)
    );
  }

  const { error } = await supabase.from("sproutly_merchants").insert({
    owner_id: user.id,
    name,
    slug,
    description,
    contact_phone,
    contact_email,
    address,
    is_published: false,
  });

  if (error) {
    redirect("/dashboard/new-store?error=" + encodeURIComponent(error.message));
  }

  redirect("/dashboard");
}
