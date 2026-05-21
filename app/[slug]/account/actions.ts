"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function sendCustomerMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const next = String(formData.get("next") ?? `/${slug}/account`).trim();

  if (!email || !slug) {
    redirect(
      `/${slug}/account/login?error=${encodeURIComponent("請填寫 email")}`
    );
  }

  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(next)}&kind=customer&slug=${encodeURIComponent(slug)}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(
      `/${slug}/account/login?error=${encodeURIComponent(error.message)}`
    );
  }

  redirect(`/${slug}/account/login?sent=1&email=${encodeURIComponent(email)}`);
}

export async function customerSignOut(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${slug}`);
}
