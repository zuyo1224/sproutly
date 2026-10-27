import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { safeNextPath, withErrorParam } from "@/lib/url";
import { MERCHANT_AUTH_TEXTS, authErrorMessage } from "@/lib/auth-error-message";
import { isStoreSlugShaped } from "@/lib/store-slug";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const kind = searchParams.get("kind"); // "customer" → 客人 magic link
  // slug 跟 next 一樣是任何人都能改的網址參數，下面會直接接進路徑，
  // 長得不像店面網址（帶 ../、?、#、/ 或乾脆沒帶）就當沒有。
  const rawSlug = searchParams.get("slug");
  const slug = isStoreSlugShaped(rawSlug) ? rawSlug : null;

  if (!code) {
    return NextResponse.redirect(withErrorParam(`${origin}/login`, MERCHANT_AUTH_TEXTS.invalidLink));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // 英文原文（「invalid request: both auth code and code verifier should be
    // non-empty」這種）只留伺服器紀錄，網址上帶中文說明。
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    const message = authErrorMessage(error);
    if (kind === "customer" && slug) {
      return NextResponse.redirect(
        withErrorParam(`${origin}/${slug}/account/login`, message),
      );
    }
    return NextResponse.redirect(withErrorParam(`${origin}/login`, message));
  }

  // 客人流程：upsert sproutly_customers，然後跳回客人指定的 next
  if (kind === "customer") {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (user) {
      await supabase
        .from("sproutly_customers")
        .upsert(
          {
            id: user.id,
            email: user.email ?? null,
            display_name:
              (user.user_metadata?.name as string | undefined) ?? null,
          },
          { onConflict: "id" }
        );
    }
    // 沒有可用的 slug 時退回首頁；原本會組出 `//account` 這種壞路徑。
    const safeNext = safeNextPath(next, slug ? `/${slug}/account` : "/");
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  // 商家流程：跳 dashboard 或 next。next 跟客人流程同一個不可信來源，守門規則
  // 見 lib/url.ts 的 safeNextPath，不合格退回 dashboard。
  const safeNext = safeNextPath(next, "/dashboard");
  return NextResponse.redirect(`${origin}${safeNext}`);
}
