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

import { isFiniteNumber } from "./is-finite-number.ts";

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
  const { topPct, bottomPct, fileAspect } = o;
  if (!url) return null;
  if (!isFiniteNumber(topPct) || !isFiniteNumber(bottomPct) || !isFiniteNumber(fileAspect)) return null;
  if (topPct < 0 || bottomPct > 100 || bottomPct <= topPct) return null;
  // 寬高比合理範圍：比 1:20 更瘦或比 20:1 更扁的圖不可能是 hero 照片，多半是壞資料。
  if (fileAspect < 0.05 || fileAspect > 20) return null;
  return { url, topPct, bottomPct, fileAspect };
}

/**
 * 從主體邊界算出 banner 要畫的幾何：框的寬高比（整檔寬高比 ÷ 主體佔的高度比例，
 * 例：1:1 的檔、主體在 22%–78% 共 56% → 1 / 0.56 = 1.786）與 object-position（把
 * 主體中點對到框的中央，裁掉的只會是上下的留白）。
 *
 * 公開頁 HeroAdaptiveBanner 與編輯器「Hero 圖片」預覽框都走這一支，兩邊算出來的框
 * 才會是同一個：以前各抄一份，商家在面板看到的框跟客人看到的框有沒有對上，全靠
 * 兩處手寫的算式碰巧一樣。
 */
export function heroBannerGeometry(b: HeroImageBounds): {
  /** 框的寬高比（數字，直接 String() 進 CSS aspect-ratio）。 */
  aspect: number;
  /** 主體中點佔整張圖高度的百分比（0-100）。 */
  contentMid: number;
  /** CSS object-position，`50% <contentMid>%`（兩位小數）。 */
  objectPosition: string;
} {
  const contentH = b.bottomPct - b.topPct; // 0-100
  const contentMid = (b.topPct + b.bottomPct) / 2;
  return {
    aspect: b.fileAspect / (contentH / 100),
    contentMid,
    objectPosition: `50% ${contentMid.toFixed(2)}%`,
  };
}

/**
 * 「照片最高佔多少螢幕」（heroImageMaxHeight）每一檔對應的螢幕高度百分比。
 * 公開頁拿它組 max-height 的 vh，編輯器預覽框拿它除以 100 算「畫布高 × 上限」；
 * "none" 不在表裡（不限高，兩邊都不套）。
 */
export const HERO_IMAGE_MAX_HEIGHT_VH = { screen: 100, short: 68 } as const;

/**
 * 左右分欄（split）hero「跟照片」那幾檔用的照片寬高比範圍：1:2 到 3:1。
 * 比 1:2 更直的照片在手機上會撐到兩個螢幕高、店名被推到看不見；比 3:1 更扁的圖框
 * 會矮到像一條橫幅。公開頁三處（圖欄寬、平板以上 aspect-ratio、手機圖框）以前各抄一份
 * Math.min(3, Math.max(0.5, fileAspect))，範圍只靠三處碰巧一樣才對得上。
 */
export const HERO_SPLIT_PHOTO_ASPECT_MIN = 0.5;
export const HERO_SPLIT_PHOTO_ASPECT_MAX = 3;

export function clampHeroSplitPhotoAspect(fileAspect: number): number {
  return Math.min(HERO_SPLIT_PHOTO_ASPECT_MAX, Math.max(HERO_SPLIT_PHOTO_ASPECT_MIN, fileAspect));
}

/**
 * split hero「這一段有多高」寫死的那兩檔對應的螢幕高度百分比：七成螢幕 70vh、跟預設
 * 100vh（平板以上 class 上的 md:min-h-screen）。layout.tsx 的 CSS 拿它寫 min-height，
 * 公開頁「跟照片」那檔拿它算圖欄寬（段高 × 照片比例）——欄寬算的段高要跟 CSS 真的
 * 撐出來的段高是同一個數，以前兩邊各寫一份 70，只靠碰巧一樣才對得上。
 * "content" 不在表裡（段高由文字撐出來、render 時不知道，兩邊都不套）。
 */
export const HERO_SPLIT_HEIGHT_VH = { compact: 70, normal: 100 } as const;

/**
 * 滿版（full-image）hero「Hero 高度」三檔對應的螢幕高度百分比：矮 60vh、高 80vh、
 * 全屏 100vh。同一把尺散在三個地方：layout.tsx 手機那格（heroHeightMobile）的 CSS
 * min-height、編輯器兩組按鈕的 hint 字（讓商家看到的數字就是真的套上去的數字）、
 * 公開頁桌機那格的 Tailwind class（min-h-[60vh] / min-h-[80vh] / min-h-screen）。
 * 前兩處直接查表；Tailwind 的 class 名得寫死在原始碼裡讓它掃得到、沒法插值，所以
 * page.tsx 那三個 class 仍是手寫，由測試對著這張表掃原始碼確認沒漂。
 * "auto" 不在表裡（跟著照片比例，不設 min-height）。
 */
export const HERO_FULL_HEIGHT_VH = { short: 60, tall: 80, full: 100 } as const;

/**
 * hero 文字段「這段字裡面的行距」（小標→主標→副標→按鈕那幾截 margin）收緊／放寬時
 * 乘在原本 rem 上的倍率：緊 0.5、鬆 1.75。四種版型各有自己的一格
 * （heroTextGap 滿版、heroSplitGap 分欄、heroMagazineTextGap 雜誌、heroMinimalGap 極簡），
 * 每格那幾截的原始 rem 各不一樣（6:5:8、6:6:10、4:8:4、8:8:10:12），但「緊到一半、鬆到
 * 快兩倍」這把尺是同一把——商家在四個面板看到的都是「緊／跟預設／鬆」三顆一樣的按鈕，
 * 換版型時同一顆按鈕的鬆緊感要一樣。以前 page.tsx 四段各手寫一份 0.5／1.75 三元式，
 * 只靠四處碰巧一樣才對得上。
 * "normal" 不在表裡（不覆寫，inline style 不輸出、既有店家算出來一模一樣），helper 回 null。
 */
export const HERO_TEXT_GAP_SCALE = { tight: 0.5, loose: 1.75 } as const;

export function heroTextGapScale(choice: "tight" | "normal" | "loose"): number | null {
  return choice === "tight" || choice === "loose" ? HERO_TEXT_GAP_SCALE[choice] : null;
}

/**
 * 把上面那個倍率變成真的能 spread 進 style 的兩支小函式：top(rem) 給 marginTop、
 * bottom(rem) 給 marginBottom，rem 是那一截原本 Tailwind class 寫死的值。
 * 「跟預設」時兩支都回 {}（inline 不輸出、class 上的 mt-/mb- 照舊），既有店家算出來一模一樣。
 * 以前 page.tsx 四種版型各自寫一對 `scale === null ? {} : { marginTop: … }` 閉包，
 * 八支形狀逐字相同、只有變數名不同；改成同一支 helper 產出，四個版型解構出來用。
 */
export function heroTextGapMargins(choice: "tight" | "normal" | "loose"): {
  top: (rem: number) => { marginTop?: string };
  bottom: (rem: number) => { marginBottom?: string };
} {
  const scale = heroTextGapScale(choice);
  return {
    top: (rem) => (scale === null ? {} : { marginTop: `${rem * scale}rem` }),
    bottom: (rem) => (scale === null ? {} : { marginBottom: `${rem * scale}rem` }),
  };
}

/**
 * hero 各版型「上下內距」／「左右內距」那幾格的 inline style：同一個 clamp() 值要同時
 * 塞給 paddingTop 與 paddingBottom（或 paddingLeft 與 paddingRight）。以前 page.tsx
 * 滿版／雜誌／極簡三個版型共十行都把同一串 clamp 逐字寫兩次，改一邊漏另一邊就變成
 * 上緊下鬆、左寬右窄——這種對稱寫錯肉眼在編輯器裡幾乎看不出來。
 * 這裡只包「同一個值套兩邊」這件事，值本身仍由各版型自己決定（每個版型的尺不同）。
 */
export function padY(value: string): { paddingTop: string; paddingBottom: string } {
  return { paddingTop: value, paddingBottom: value };
}

export function padX(value: string): { paddingLeft: string; paddingRight: string } {
  return { paddingLeft: value, paddingRight: value };
}

/**
 * 一道限了寬的欄「擺在段落的哪一邊」：靠左就把右邊 margin 留 auto 讓欄被推到左邊，
 * 靠右反過來；置中回 {}（inline 不輸出、class 上的 mx-auto 照舊），既有店家算出來一模一樣。
 * inline 的 marginLeft／marginRight 贏過 class 上的 mx-auto，所以只要給值就蓋得掉。
 * 以前 page.tsx 滿版圖版型（heroTextAlignX）與極簡版型（heroMinimalAlign）各手寫一份
 * 同樣的三元式，layout.tsx 給各區段內容欄的 data-content-align-x 兩條 CSS 也是同一組值
 * （那邊是 template literal 裡的 CSS 文字，沒法 spread 物件，註解指回這裡）。
 */
export function blockAlignMargins(align: "left" | "center" | "right"): {
  marginLeft?: 0 | "auto";
  marginRight?: 0 | "auto";
} {
  if (align === "left") return { marginLeft: 0, marginRight: "auto" };
  if (align === "right") return { marginLeft: "auto", marginRight: 0 };
  return {};
}

/**
 * 編輯器「Hero 圖片」預覽框的寬高比範圍：3:4 到 3:1。面板窄，太直的照片會把整欄撐得
 * 很長，所以下限比公開頁的 split 圖寬。主體框與「整張顯示」收過上限的外框都走這一支。
 * 呼叫端拿回傳值跟原值比（clamped === aspect）判斷「有沒有被夾過」，夾過的不畫上限提示。
 */
export const HERO_PREVIEW_ASPECT_MIN = 0.75;
export const HERO_PREVIEW_ASPECT_MAX = 3;

export function clampHeroPreviewAspect(aspect: number): number {
  return Math.min(HERO_PREVIEW_ASPECT_MAX, Math.max(HERO_PREVIEW_ASPECT_MIN, aspect));
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
