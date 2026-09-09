import { ImageResponse } from "next/og";

// 平台的 apple-touch-icon（iOS「加到主畫面」與 Safari 書籤用的那張）。
// 以前 app/ 底下只有 favicon.ico：iOS 拿不到 apple-touch-icon 就退回用頁面截圖當
// 圖示，平台首頁與沒設 logo 的店加到主畫面都是一塊糊掉的網頁縮圖。這支用 next/og 在
// build 時畫一張 180×180 的 png（Apple 建議尺寸），Next 會自動掛成
// <link rel="apple-touch-icon">。各店 layout 在 logo 是 svg（iOS 不畫）時也明講退到
// 這張——Next 只在整條路徑都沒設過 icons 時才自動套 file-based 圖示，店家 layout
// 有設 icons 就不會自動補上。
//
// 圖形跟 opengraph-image 的 SproutMark 同一顆（同一組 path、同一套 Botanic Lab 品牌色）。
// 底一定要實色：iOS 會把透明處填成黑色，圓角由系統自己切，這裡不用畫。
const INK = "#15241b";
const LEAF = "#2e7d52";
const SPROUT = "#7aa82e";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        {/* 32×40 的 viewBox 放大到 104 高：留約兩成邊，主畫面上系統切圓角後葉子不會貼邊 */}
        <svg width="83" height="104" viewBox="0 0 32 40" fill="none">
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
    { ...size }
  );
}
