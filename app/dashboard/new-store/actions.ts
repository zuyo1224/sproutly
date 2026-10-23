"use server";
import { formString, formStringOrNull } from "@/lib/form-fields";
import { storeTextLimitError } from "@/lib/store-limits";

import { requireUser } from "@/lib/require-user";
import { redirect } from "next/navigation";
import { withErrorParam } from "@/lib/url";
import { dbErrorMessage } from "@/lib/db-error-message";
import { normalizeStoreSlug, storeSlugError } from "@/lib/store-slug";

export async function createStore(formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = formString(formData, "name");
  const slug = normalizeStoreSlug(formData.get("slug"));
  const description =
    formStringOrNull(formData, "description");
  const contact_phone =
    formStringOrNull(formData, "contact_phone");
  const contact_email =
    formStringOrNull(formData, "contact_email");
  const address = formStringOrNull(formData, "address");

  if (!name) {
    redirect(withErrorParam("/dashboard/new-store", "請填店名"));
  }
  // 五個文字欄位的字數上限（表單 maxLength 吃同一份數字，這裡是伺服器端真正擋下）
  const tooLong = storeTextLimitError({
    name,
    description,
    contact_phone,
    contact_email,
    address,
  });
  if (tooLong) {
    redirect(withErrorParam("/dashboard/new-store", tooLong));
  }
  const slugError = storeSlugError(slug);
  if (slugError) {
    redirect(withErrorParam("/dashboard/new-store", slugError));
  }

  // 檢查 slug 是否被別人佔用
  const { data: existing } = await supabase
    .from("sproutly_merchants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    redirect(withErrorParam("/dashboard/new-store", `網址「${slug}」已被使用，換一個試試`));
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
    redirect(withErrorParam("/dashboard/new-store", dbErrorMessage(error, { "23505": `網址「${slug}」已被使用，換一個試試` })));
  }

  redirect("/dashboard");
}
