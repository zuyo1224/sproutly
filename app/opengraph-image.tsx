import { ImageResponse } from "next/og";

export const alt = "Sproutly · 讓你的小生意發芽";
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
          background:
            "linear-gradient(135deg, #ecfdf5 0%, #ffffff 55%, #f7fee7 100%)",
          color: "#064e3b",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'PingFang TC', 'Noto Sans TC', sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 右上角光暈（emerald 圓） */}
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.32) 0%, rgba(16,185,129,0) 70%)",
          }}
        />
        {/* 左下角光暈（lime 圓） */}
        <div
          style={{
            position: "absolute",
            bottom: -200,
            left: -160,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, rgba(132,204,22,0.22) 0%, rgba(132,204,22,0) 70%)",
          }}
        />

        {/* Header：品牌 + eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#064e3b",
            }}
          >
            Sproutly
          </div>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: "#047857",
              opacity: 0.7,
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
            gap: 20,
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 28,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#047857",
              opacity: 0.78,
            }}
          >
            Build a home for your craft
          </div>
          <div
            style={{
              fontSize: 116,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              color: "#064e3b",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>讓你的小生意</span>
            <span
              style={{
                background:
                  "linear-gradient(120deg, #047857 0%, #65a30d 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              在這裡發芽
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
              color: "#065f46",
              opacity: 0.78,
              maxWidth: 720,
              lineHeight: 1.4,
            }}
          >
            為台灣小商家打造的線上店面 · 商品、訂單、付款，整齊收在你的網址。
          </div>
          <div
            style={{
              fontSize: 20,
              letterSpacing: "0.18em",
              color: "#047857",
              opacity: 0.7,
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
