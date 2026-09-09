import { ImageResponse } from "next/og";
import { PLATFORM_ICON_SIZES } from "@/lib/platform-icons";

// 平台的點陣圖示（Android「加到主畫面」與各家啟動器用的那種）。
// 以前 app/ 底下的圖示只有 favicon.ico（16／32 那種小尺寸）與 apple-icon.tsx（180，
// 只有 iOS 吃）。Android 的 Chrome 判斷一個網站能不能「安裝」時，要求 manifest 的
// icons 至少有一張 192 以上的點陣圖，favicon.ico 不算——所以平台首頁與沒設 logo 的店
// 在 Android 上根本跳不出安裝提示，硬加到主畫面也只有一張放大糊掉的 16px ico。
// 這支用 next/og 在 build 時畫 192 與 512 兩張 png（前者是安裝門檻，後者給啟動器與
// splash 畫面用），Next 會自動掛成 <link rel="icon">，manifest 那邊也直接列這兩個網址。
//
// 圖形跟 apple-icon、opengraph-image 的 SproutMark 同一顆（同一組 path、同一套 Botanic
// Lab 品牌色）。底一樣是實色白：Android 的 maskable 會把圖示切成圓形／方角等各家形狀，
// 透明處在部分啟動器上會變黑。芽只佔畫布 58% 高，落在 maskable 規定的安全區（畫布
// 中央直徑 80% 的圓）內，所以下面 purpose 才敢同時寫 any 與 maskable。
const INK = "#15241b";
const LEAF = "#2e7d52";
const SPROUT = "#7aa82e";

export function generateImageMetadata() {
  return PLATFORM_ICON_SIZES.map((size) => ({
    id: String(size),
    contentType: "image/png",
    size: { width: size, height: size },
    alt: "Sproutly",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  // 芽佔畫布 58% 高，寬照 32:40 的 viewBox 比例換算
  const markHeight = Math.round(size * 0.58);
  const markWidth = Math.round((markHeight * 32) / 40);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <svg
          width={markWidth}
          height={markHeight}
          viewBox="0 0 32 40"
          fill="none"
        >
          <path
            d="M16 39 V19"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M16 24C11.5 24 7 21 5.5 14.5C12 13.5 15.5 18 16 24Z"
            fill={LEAF}
          />
          <path
            d="M16 21C20 20.5 24 17 24.5 10C18.5 11 15.5 15.5 16 21Z"
            fill={SPROUT}
          />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
