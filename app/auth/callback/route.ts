import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { safeNextPath, withErrorParam } from "@/lib/url";
import { authErrorMessage } from "@/lib/auth-error-message";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const kind = searchParams.get("kind"); // "customer" → 客人 magic link
  const slug = searchParams.get("slug");

  if (!code) {
    return NextResponse.redirect(withErrorParam(`${origin}/login`, "確認連結無效或已過期"));
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
    const safeNext = safeNextPath(next, `/${slug ?? ""}/account`);
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  // 商家流程：跳 dashboard 或 next。next 跟客人流程同一個不可信來源，守門規則
  // 見 lib/url.ts 的 safeNextPath，不合格退回 dashboard。
  const safeNext = safeNextPath(next, "/dashboard");
  return NextResponse.redirect(`${origin}${safeNext}`);
}
