import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "../_theme";
import { displayableImageUrl, imageMimeTypeFromUrl } from "@/lib/image-url";
import { PLATFORM_MANIFEST_ICONS } from "@/lib/platform-icons";

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
  // 主畫面圖示只掛判得過的 logo（https:// 完整網址，跟 layout 的 icons 同一口徑）：
  // http:// 或半截網址的舊值裝置抓不到，加到主畫面會是一塊空白，不如退回平台 favicon。
  const logoUrl = displayableImageUrl(theme.logoUrl);
  // type 從副檔名推（Storage 上傳的 jpg／webp／svg、Pexels 的 .jpeg 都不是 png），
  // 認不出就整個 key 不放：manifest 規格允許省略，瀏覽器會用回應的 Content-Type 判，
  // 填錯反而可能讓 Safari／部分 Android 啟動器跳過這個圖示。
  const logoType = imageMimeTypeFromUrl(logoUrl);

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
            ...(logoType ? { type: logoType } : {}),
          },
        ]
      : [
          {
            src: "/favicon.ico",
            sizes: "any",
            type: "image/x-icon",
          },
          // 沒 logo 的店退到平台圖示。只放在這條沒 logo 的路上：有 logo 的店若也列
          // 平台這兩張，Android 挑圖示時會偏好標明尺寸的那個，主畫面就變成 Sproutly
          // 的芽而不是店家自己。favicon.ico 不能單獨撐著——Android 要 192 以上的
          // 點陣圖才肯讓客人把店面裝到主畫面。
          ...PLATFORM_MANIFEST_ICONS,
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
