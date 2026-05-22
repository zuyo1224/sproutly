"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Bounds = { topPct: number; bottomPct: number; fileAspect: number };

/**
 * 自適應 banner：用 canvas 偵測圖片自帶的 padding（米色邊 / 純色塊），
 * 把 banner aspect 自動算成「剛好框住植物本體」的比例 — 不論這張圖
 * padding 是 0% / 12% / 22% / 還是不對稱，都會自動裁掉，banner 高度也
 * 跟著動。
 */
export default function HeroAdaptiveBanner({
  url,
  alt,
}: {
  url: string;
  alt: string;
}) {
  const [bounds, setBounds] = useState<Bounds | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        // 抓中央 5% 寬的縱條，逐 row 算 RGB 變異度。padding 整片同色 →
        // variance ≈ 0；有內容 → variance 高。第一個 / 最後一個 variance
        // 超過 threshold 的 row 就是內容邊界。
        const stripW = Math.max(
          10,
          Math.min(60, Math.floor(img.naturalWidth * 0.05))
        );
        const stripX = Math.floor((img.naturalWidth - stripW) / 2);
        const stripData = ctx.getImageData(
          stripX,
          0,
          stripW,
          img.naturalHeight
        ).data;

        const rowStddev: number[] = new Array(img.naturalHeight);
        for (let y = 0; y < img.naturalHeight; y++) {
          let sumR = 0,
            sumG = 0,
            sumB = 0;
          for (let x = 0; x < stripW; x++) {
            const i = (y * stripW + x) * 4;
            sumR += stripData[i];
            sumG += stripData[i + 1];
            sumB += stripData[i + 2];
          }
          const meanR = sumR / stripW;
          const meanG = sumG / stripW;
          const meanB = sumB / stripW;
          let varSum = 0;
          for (let x = 0; x < stripW; x++) {
            const i = (y * stripW + x) * 4;
            varSum +=
              (stripData[i] - meanR) ** 2 +
              (stripData[i + 1] - meanG) ** 2 +
              (stripData[i + 2] - meanB) ** 2;
          }
          rowStddev[y] = Math.sqrt(varSum / stripW / 3);
        }

        const maxStd = Math.max(...rowStddev);
        // threshold：max 的 15% 或絕對值 8（避免完全乾淨的圖也誤判）
        const threshold = Math.max(8, maxStd * 0.15);

        let top = 0;
        let bottom = img.naturalHeight - 1;
        while (top < img.naturalHeight && rowStddev[top] < threshold) top++;
        while (bottom > 0 && rowStddev[bottom] < threshold) bottom--;

        // 邊界 sanity check：若偵測不到（top >= bottom 或內容只佔 < 10%），
        // 退回全圖
        if (bottom - top < img.naturalHeight * 0.1) {
          top = 0;
          bottom = img.naturalHeight - 1;
        }

        if (cancelled) return;
        setBounds({
          topPct: (top / img.naturalHeight) * 100,
          bottomPct: (bottom / img.naturalHeight) * 100,
          fileAspect: img.naturalWidth / img.naturalHeight,
        });
      } catch {
        // canvas getImageData 可能因 CORS fail → 保持 fallback
      }
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  // SSR fallback：2:1（user 看到的初始）。client 偵測完會 swap 成精確值。
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

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio }}
    >
      <Image
        src={url}
        alt={alt}
        fill
        sizes="100vw"
        priority
        style={{ objectFit: "cover", objectPosition }}
      />
    </div>
  );
}
