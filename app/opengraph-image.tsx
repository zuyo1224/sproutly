import { ImageResponse } from "next/og";

// Botanic Lab 品牌色（跟 globals.css 的 --sproutly-* 同一套，ImageResponse 走 Satori
// 渲染、讀不到 CSS var，這裡照抄成字面值）。
const INK = "#15241b";
const LEAF = "#2e7d52";
const SPROUT = "#7aa82e";

export const alt = "Sproutly · 讓你的小生意長成自己的店";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "84px 96px",
          background: "#ffffff",
          color: INK,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 實驗室方格底紋 —— 跟首頁同一套紋理，不用漸層當底 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(21,36,27,0.06) 1.5px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Header：SproutMark + 品牌名 + eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="34" height="42" viewBox="0 0 32 40" fill="none">
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
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: INK,
              }}
            >
              Sproutly
            </div>
          </div>
          <div
            style={{
              fontSize: 16,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: LEAF,
              opacity: 0.75,
            }}
          >
            For Small Makers
          </div>
        </div>

        {/* Main：大字 tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: LEAF,
              opacity: 0.85,
            }}
          >
            Early Access · 為台灣小商家而生
          </div>
          <div
            style={{
              fontSize: 108,
              fontWeight: 600,
              lineHeight: 1.14,
              letterSpacing: "-0.02em",
              color: INK,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>讓你的小生意，</span>
            <span>
              長成自己的<span style={{ color: LEAF }}>店</span>。
            </span>
          </div>
        </div>

        {/* Footer：副標 + URL */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 26,
              color: INK,
              opacity: 0.6,
              maxWidth: 720,
              lineHeight: 1.4,
            }}
          >
            商品、訂單、付款，整齊收在你自己的網址。不用懂程式，五分鐘把生意種上線。
          </div>
          <div
            style={{
              fontSize: 20,
              letterSpacing: "0.18em",
              color: LEAF,
              opacity: 0.75,
            }}
          >
            sproutly.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
