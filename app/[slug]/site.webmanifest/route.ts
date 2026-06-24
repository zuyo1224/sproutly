import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../_theme";

type Params = Promise<{ slug: string }>;

// 每間店各自的 web manifest。
// 平台只有根目錄一份 manifest（名字固定「Sproutly」、綠色 favicon）——客人從
// 某店面「加到主畫面」時，拿到的卻是平台身分，不是這間店的店名與 logo。
// 這支按 slug 回各店自己的 name / 描述 / 主色 / logo，加到主畫面就是店家自己。
export async function GET(
  _request: Request,
  { params }: { params: Params }
) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("sproutly_merchants")
    .select("name, description, theme")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!store) {
    return new NextResponse("Not found", { status: 404 });
  }

  const theme = resolveTheme(store.theme);
  const logoUrl = theme.logoUrl;

  const manifest = {
    name: store.name,
    // short_name 在主畫面圖示下方顯示，太長會被系統截斷，控在 12 字內
    short_name: store.name.slice(0, 12),
    description:
      store.description ?? `${store.name} · 在 Sproutly 上的線上店面`,
    // 進入點與範圍都鎖在這間店底下，加到主畫面開的是店面而非平台首頁
    start_url: `/${slug}`,
    scope: `/${slug}`,
    display: "minimal-ui",
    background_color: theme.bg,
    theme_color: theme.primary,
    icons: logoUrl
      ? [
          {
            src: logoUrl,
            sizes: "any",
            type: "image/png",
          },
        ]
      : [
          {
            src: "/favicon.ico",
            sizes: "any",
            type: "image/x-icon",
          },
        ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      // 店家改店名/主色/logo 後不該被舊 manifest 卡住，給短快取就好
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
