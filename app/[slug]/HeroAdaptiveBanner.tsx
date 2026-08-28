"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  detectHeroImageBounds,
  type HeroImageBounds,
} from "@/lib/hero-image-bounds";

/**
 * 自適應 banner：用 canvas 偵測圖片自帶的 padding（米色邊 / 純色塊），
 * 把 banner aspect 自動算成「剛好框住植物本體」的比例 — 不論這張圖
 * padding 是 0% / 12% / 22% / 還是不對稱，都會自動裁掉，banner 高度也
 * 跟著動。
 *
 * 偵測結果能事先存好：編輯器換照片時就跑同一支偵測、把邊界存進
 * theme.layout.heroImageBounds，公開頁拿到 initialBounds 就在伺服器端
 * 直接畫出正確比例——第一屏不用先頂著 2:1 等偵測、不會跳。沒存到
 *（舊店、偵測失敗、換了圖還沒存）才在客人這邊照舊偵測。
 */
export default function HeroAdaptiveBanner({
  url,
  alt,
  maxHeight,
  fit,
  bg,
  initialBounds,
}: {
  url: string;
  alt: string;
  /** 商家在「照片最高佔多少螢幕」那格挑的上限（CSS 長度）。沒設就不限，
      banner 高度照自適應算出來的比例走，跟以前一模一樣。 */
  maxHeight?: string;
  /** 被 maxHeight 收到上限之後超出的那截怎麼辦。不傳 = cover（照原本對齊主體
      裁上下）；"contain" = 主體整個縮進框裡不裁，放不滿的邊露出底下的底色。
      縮的是「偵測出來的主體那塊」不是整個檔案：整個檔案縮進去會把圖自帶的
      米色邊、純色塊重新露出來，框底色跟圖自己的留白接成兩截色；主體那塊縮
      進去，框裡露出來的只有框底色一種顏色，左右留白也自然對稱。
      偵測還沒完成（或 CORS 拿不到像素）時退回整個檔案 contain，主體一樣不會被裁。 */
  fit?: "contain";
  /** contain 時放不滿的邊露出來的底色（六碼 hex）。不傳 = 不輸出 backgroundColor，
      透出 section 的底色（全站底色），跟以前一模一樣。 */
  bg?: string;
  /** 編輯器先存好的主體邊界（同一支偵測算出來的）。傳了就直接用、不再偵測，
      SSR 第一張就是正確比例。呼叫端要先確認它是這張 url 的（pickHeroImageBounds）。 */
  initialBounds?: HeroImageBounds | null;
}) {
  const [bounds, setBounds] = useState<HeroImageBounds | null>(
    initialBounds ?? null
  );

  useEffect(() => {
    if (!url) return;
    // 存好的邊界就是這張圖的，不用再算一次（算了也是同一個結果）。
    if (initialBounds && initialBounds.url === url) {
      setBounds(initialBounds);
      return;
    }
    let cancelled = false;
    setBounds(null);
    detectHeroImageBounds(url).then((b) => {
      if (!cancelled && b) setBounds(b);
    });
    return () => {
      cancelled = true;
    };
  }, [url, initialBounds]);

  // SSR fallback：2:1（沒存邊界的店客人看到的初始）。client 偵測完會 swap 成精確值。
  let aspectRatio: string = "2 / 1";
  let objectPosition = "center";

  if (bounds) {
    const contentH = bounds.bottomPct - bounds.topPct; // 0-100
    const contentMid = (bounds.topPct + bounds.bottomPct) / 2;
    // banner_aspect = file_aspect / (content_h_fraction)
    // 1:1 file with content 22-78% (56%) → aspect = 1 / 0.56 = 1.786
    const ar = bounds.fileAspect / (contentH / 100);
    aspectRatio = String(ar);
    // object-position 把 image 的 content_mid% 對齊 container 中心
    objectPosition = `50% ${contentMid.toFixed(2)}%`;
  }

  const image = (
    <Image
      src={url}
      alt={alt}
      fill
      sizes="100vw"
      priority
      style={
        fit === "contain" && !bounds
          ? { objectFit: "contain", objectPosition: "center" }
          : { objectFit: "cover", objectPosition }
      }
    />
  );

  return (
    <div
      className="relative w-full overflow-hidden"
      // maxHeight 只壓上限：算出來比它矮的圖完全不受影響。被壓到的圖是
      // 高度被截、寬度照舊，底下那張 Image 是 object-fit: cover 加上算好的
      // objectPosition，裁掉的是上下兩端、主體仍對齊中央。
      style={{ aspectRatio, maxHeight, ...(bg ? { backgroundColor: bg } : {}) }}
    >
      {fit === "contain" && bounds ? (
        // 整張顯示：外框被 maxHeight 壓扁之後，裡面再放一個「主體比例」的內框，
        // 高度貼齊外框（上下撐滿）、寬度由比例算出來、左右置中。內框裡的圖走跟
        // cover 一樣的裁法（裁掉的只有圖自帶的留白），所以框裡看到的正好是主體
        // 整個、一點都沒切；外框沒被壓到時內框寬度算出來剛好等於外框，跟 cover
        // 一模一樣。
        <div
          className="absolute inset-y-0 left-1/2 max-w-full -translate-x-1/2"
          style={{ aspectRatio }}
        >
          {image}
        </div>
      ) : (
        image
      )}
    </div>
  );
}
