"use server";
import { formString } from "@/lib/form-fields";
import { normalizeEmail } from "@/lib/email-normalize";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildUrl, withErrorParam } from "@/lib/url";

export async function sendCustomerMagicLink(formData: FormData) {
  const email = normalizeEmail(formString(formData, "email"));
  const slug = formString(formData, "slug");
  const next = String(formData.get("next") ?? `/${slug}/account`).trim();

  if (!email || !slug) {
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
    redirect(withErrorParam(`/${slug}/account/login`, error.message));
  }

  redirect(buildUrl(`/${slug}/account/login`, { sent: 1, email }));
}

export async function customerSignOut(formData: FormData) {
  const slug = formString(formData, "slug");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${slug}`);
}
