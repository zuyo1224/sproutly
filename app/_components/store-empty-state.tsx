import type { ReactNode } from "react";

// 客人端各頁「空空的」狀態共用的版面：accent 小字 eyebrow「Empty」+ 一截 accent 短線
// + 大標 + 一句說明，需要時下面再接一條「去逛逛」之類的下一步連結（傳 children）。
//
// 收藏空了、購物車空車、會員還沒下過單、店家還沒寫故事 / 還沒留聯絡方式——這五頁原本
// 各自 inline 同一份逐字相同的這塊 JSX，只有文字、對齊用的 padding、要不要接 CTA 不同。
// 日後想改空狀態的長相（換 eyebrow 字、改短線粗細、調標題級距）得五頁同步，漏一頁就有
// 一頁長得不一樣。收成這一支，五頁吃同一個版面、只各自傳自己的文字。
//
// 顏色來源刻意當 prop 傳進來而不在這裡寫死：server 頁（about / contact / 會員訂單）拿得到
// resolveTheme 算好的 theme.accent / theme.text / theme.textMuted 物件值；client 頁（收藏 /
// 購物車）拿不到 theme，只能吃 CSS 的 --store-* 變數。兩種值都是字串，這裡照收照套，
// 預設值就是 client 頁那組 var(--store-*)，server 頁再各自覆寫成 theme.* 即可。
// titleColor 沒傳時標題不發 color（沿用收藏 / 購物車原本「不設色、吃繼承」的寫法），
// 不會硬塞一個 color 進去改變既有輸出。
export function StoreEmptyState({
  title,
  description,
  accentColor = "var(--store-accent, currentColor)",
  titleColor,
  descriptionColor = "var(--store-text-muted, rgba(0,0,0,0.6))",
  className = "py-16 max-w-md",
  children,
}: {
  title: ReactNode;
  description: ReactNode;
  accentColor?: string;
  titleColor?: string;
  descriptionColor?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className}>
      <p
        className="text-[0.6875rem] uppercase font-medium"
        style={{ color: accentColor, letterSpacing: "0.4em" }}
      >
        Empty
      </p>
      <div
        className="mt-5 h-px w-10"
        style={{ background: accentColor, opacity: 0.4 }}
      />
      <p
        className="mt-6 text-2xl sm:text-3xl font-medium"
        style={
          titleColor
            ? {
                color: titleColor,
                fontFamily: "var(--store-font)",
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
              }
            : {
                fontFamily: "var(--store-font)",
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
              }
        }
      >
        {title}
      </p>
      <p
        className="mt-5 text-[0.9375rem]"
        style={{ color: descriptionColor, lineHeight: 1.7 }}
      >
        {description}
      </p>
      {children}
    </div>
  );
}
