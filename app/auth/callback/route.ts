import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const kind = searchParams.get("kind"); // "customer" → 客人 magic link
  const slug = searchParams.get("slug");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("確認連結無效或已過期")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (kind === "customer" && slug) {
      return NextResponse.redirect(
        `${origin}/${slug}/account/login?error=${encodeURIComponent(error.message)}`
      );
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
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
    const safeNext = next.startsWith("/") ? next : `/${slug ?? ""}/account`;
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  // 商家流程：照舊跳 dashboard 或 next
  return NextResponse.redirect(`${origin}${next}`);
}
