"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createStore(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const contact_phone =
    String(formData.get("contact_phone") ?? "").trim() || null;
  const contact_email =
    String(formData.get("contact_email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;

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
