// 滿版（full-image）hero 照片的「主體邊界」——偵測結果的型別、正規化、與偵測本身。
//
// 為什麼要存：HeroAdaptiveBanner 一直是在客人的瀏覽器裡偵測照片自帶的留白（米色邊、
// 純色塊），偵測完才知道 banner 該多高。伺服器端不知道，只能先畫一個 2:1 的框頂著，
// 偵測完再換成真的比例——每一位客人每一次打開店面第一屏都會跳一下：直式照片偵測完
// 框突然長高、橫式照片框突然縮矮，底下的店名跟按鈕跟著上下位移。這支把偵測結果連同
// 是哪一張圖存進 theme.layout.heroImageBounds，公開頁 SSR 就能用正確的比例畫第一張，
// 不用等偵測、也不會跳。偵測在編輯器裡跑（商家換照片時自動），客人那邊只在沒存到
// 或存的是舊圖時才退回原本的偵測。
//
// 存的是百分比不是像素：換了 CDN 尺寸、縮圖、retina 都不影響。

export type HeroImageBounds = {
  /** 偵測時的照片網址。跟現在的 heroUrl 對不上就當沒存過（商家換了圖）。 */
  url: string;
  /** 主體上緣，佔整張圖高度的百分比（0-100）。 */
  topPct: number;
  /** 主體下緣，佔整張圖高度的百分比（0-100），一定 > topPct。 */
  bottomPct: number;
  /** 整個檔案的寬高比（naturalWidth / naturalHeight）。 */
  fileAspect: number;
};

const MAX_URL = 500;

/** 任何來源（DB JSON、編輯器 payload）進來都走這支；對不上型別或數字不合理一律回 null。 */
export function normalizeHeroImageBounds(value: unknown): HeroImageBounds | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim().slice(0, MAX_URL) : "";
  const topPct = typeof o.topPct === "number" ? o.topPct : NaN;
  const bottomPct = typeof o.bottomPct === "number" ? o.bottomPct : NaN;
  const fileAspect = typeof o.fileAspect === "number" ? o.fileAspect : NaN;
  if (!url) return null;
  if (![topPct, bottomPct, fileAspect].every(Number.isFinite)) return null;
  if (topPct < 0 || bottomPct > 100 || bottomPct <= topPct) return null;
  // 寬高比合理範圍：比 1:20 更瘦或比 20:1 更扁的圖不可能是 hero 照片，多半是壞資料。
  if (fileAspect < 0.05 || fileAspect > 20) return null;
  return { url, topPct, bottomPct, fileAspect };
}

/** 存下來的邊界只有在「就是現在這張圖」時才能用。 */
export function pickHeroImageBounds(
  saved: HeroImageBounds | null | undefined,
  heroUrl: string | null | undefined
): HeroImageBounds | null {
  if (!saved || !heroUrl) return null;
  return saved.url === heroUrl ? saved : null;
}

/**
 * 只能在瀏覽器裡跑。抓照片中央 5% 寬的縱條，逐 row 算 RGB 變異度：留白整片同色
 * 變異度 ≈ 0、有內容就高，第一個 / 最後一個超過門檻的 row 就是主體邊界。
 * 圖載不到、CORS 拿不到像素、或偵測不出東西（主體不到 10%）→ 回 null，
 * 呼叫端自己決定退路（HeroAdaptiveBanner 是退回整張）。
 */
export function detectHeroImageBounds(url: string): Promise<HeroImageBounds | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !url) {
      resolve(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(null);
          return;
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);

        const stripW = Math.max(10, Math.min(60, Math.floor(w * 0.05)));
        const stripX = Math.floor((w - stripW) / 2);
        const data = ctx.getImageData(stripX, 0, stripW, h).data;

        const rowStddev: number[] = new Array(h);
        for (let y = 0; y < h; y++) {
          let sumR = 0,
            sumG = 0,
            sumB = 0;
          for (let x = 0; x < stripW; x++) {
            const i = (y * stripW + x) * 4;
            sumR += data[i];
            sumG += data[i + 1];
            sumB += data[i + 2];
          }
          const meanR = sumR / stripW;
          const meanG = sumG / stripW;
          const meanB = sumB / stripW;
          let varSum = 0;
          for (let x = 0; x < stripW; x++) {
            const i = (y * stripW + x) * 4;
            varSum +=
              (data[i] - meanR) ** 2 +
              (data[i + 1] - meanG) ** 2 +
              (data[i + 2] - meanB) ** 2;
          }
          rowStddev[y] = Math.sqrt(varSum / stripW / 3);
        }

        let maxStd = 0;
        for (let y = 0; y < h; y++) if (rowStddev[y] > maxStd) maxStd = rowStddev[y];
        // 門檻：最大值的 15% 或絕對值 8（完全乾淨的圖也不會誤判）
        const threshold = Math.max(8, maxStd * 0.15);

        let top = 0;
        let bottom = h - 1;
        while (top < h && rowStddev[top] < threshold) top++;
        while (bottom > 0 && rowStddev[bottom] < threshold) bottom--;

        // 偵測不到（主體不到 10%）→ 當整張都是主體
        if (bottom - top < h * 0.1) {
          top = 0;
          bottom = h - 1;
        }

        resolve({
          url,
          topPct: (top / h) * 100,
          bottomPct: (bottom / h) * 100,
          fileAspect: w / h,
        });
      } catch {
        // getImageData 因 CORS 失敗
        resolve(null);
      }
    };
    img.src = url;
  });
}
