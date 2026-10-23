"use server";
import { formString } from "@/lib/form-fields";
import { normalizeEmail } from "@/lib/email-normalize";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildUrl, safeNextPath, withErrorParam } from "@/lib/url";
import { isStoreSlugShaped } from "@/lib/store-slug";
import { authErrorMessage } from "@/lib/auth-error-message";

export async function sendCustomerMagicLink(formData: FormData) {
  const email = normalizeEmail(formString(formData, "email"));
  const slug = formString(formData, "slug");
  // slug、next 都是表單值，誰都能改。slug 不像店家網址就不接進任何路徑（帶 ../、?、#
  // 或 / 會把錯誤跳轉送到站內別頁），直接回首頁；next 不是站內路徑就退回會員頁，
  // 免得把一條外站網址塞進寄出去的登入信裡（auth/callback 也會再擋一次）。
  if (!isStoreSlugShaped(slug)) redirect("/");
  const next = safeNextPath(formString(formData, "next"), `/${slug}/account`);

  if (!email) {
    redirect(withErrorParam(`/${slug}/account/login`, "請填寫 email"));
  }

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const callbackUrl = buildUrl(`${origin}/auth/callback`, {
    next,
    kind: "customer",
    slug,
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(withErrorParam(`/${slug}/account/login`, authErrorMessage(error)));
  }

  redirect(buildUrl(`/${slug}/account/login`, { sent: 1, email }));
}

export async function customerSignOut(formData: FormData) {
  const slug = formString(formData, "slug");
  const supabase = await createClient();
  await supabase.auth.signOut();
  // slug 填 "/evil.com" 會組出 "//evil.com"，瀏覽器當成外站網址；不像店家網址就回首頁。
  redirect(isStoreSlugShaped(slug) ? `/${slug}` : "/");
}
