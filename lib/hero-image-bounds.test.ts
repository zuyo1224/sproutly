// lib/hero-image-bounds.ts 的行為固定測試：normalizeHeroImageBounds（DB／編輯器進來的清洗）、
// pickHeroImageBounds（存的邊界只在「就是這張圖」時才能用）、detectHeroImageBounds（瀏覽器裡
// 抓照片中央縱條、逐 row 算變異度找主體上下緣）。
//
// 為什麼要有這份：這支決定滿版 hero 第一屏 SSR 畫多高。清洗放太鬆，DB 裡一筆 bottomPct 30
// topPct 60 的壞資料會讓 banner 算出負高度；放太嚴，商家剛存好的偵測結果讀不回來，每位客人
// 開店面第一屏又跳一下。pick 少比 url，商家換了照片還套舊圖的邊界，直式照片被切成橫式的框。
// 偵測那段的門檻與「主體不到 10% 當整張」的退路改壞，米色留白會被算成主體、或乾淨的照片
// 被亂切。這些在畫面上只會看到「框高怪怪的」，不會噴錯。
//
// Node 沒有 Image / canvas，這裡用一個假的 window.Image（設 src 就在下一個 microtask 觸發
// onload 或 onerror）與假的 document.createElement("canvas")（getImageData 依「像素函式」
// 現算一塊 RGBA），每個 it 用 scene 描述那張假照片長怎樣，測完把 globalThis 還原。
// 跟其他 lib 測試同一套：node:test + node:assert，import 一律帶 .ts。
import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clampHeroPreviewAspect,
  clampHeroSplitPhotoAspect,
  detectHeroImageBounds,
  heroBannerGeometry,
  HERO_FULL_HEIGHT_VH,
  HERO_IMAGE_MAX_HEIGHT_VH,
  HERO_TEXT_GAP_SCALE,
  heroTextGapMargins,
  heroTextGapScale,
  padX,
  padY,
  HERO_SPLIT_HEIGHT_VH,
  HERO_PREVIEW_ASPECT_MAX,
  HERO_PREVIEW_ASPECT_MIN,
  HERO_SPLIT_PHOTO_ASPECT_MAX,
  HERO_SPLIT_PHOTO_ASPECT_MIN,
  normalizeHeroImageBounds,
  pickHeroImageBounds,
  type HeroImageBounds,
} from "./hero-image-bounds.ts";

const good: HeroImageBounds = {
  url: "https://cdn.example.com/hero.jpg",
  topPct: 12.5,
  bottomPct: 87.5,
  fileAspect: 1.5,
};

describe("normalizeHeroImageBounds（任何來源進來都走這支）", () => {
  it("四欄齊全、數字合理就原樣回來（url 去頭尾空白），不帶多餘欄位", () => {
    const out = normalizeHeroImageBounds({ ...good, url: `  ${good.url}  `, extra: 1 });
    assert.deepEqual(out, good);
  });

  it("不是物件的一律回 null：null、undefined、字串、數字、陣列", () => {
    for (const v of [null, undefined, "x", 1, [], [good], true]) {
      assert.equal(normalizeHeroImageBounds(v), null, String(v));
    }
  });

  it("url 缺、不是字串、空白字串都回 null", () => {
    assert.equal(normalizeHeroImageBounds({ ...good, url: undefined }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, url: 123 }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, url: "   " }), null);
  });

  it("url 超過 500 字截到 500", () => {
    const long = "https://x/" + "a".repeat(600);
    const out = normalizeHeroImageBounds({ ...good, url: long });
    assert.equal(out?.url.length, 500);
    assert.equal(out?.url, long.slice(0, 500));
  });

  it("三個數字欄位任一不是 number（含數字字串）就回 null", () => {
    assert.equal(normalizeHeroImageBounds({ ...good, topPct: "12" }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, bottomPct: undefined }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, fileAspect: null }), null);
  });

  it("NaN / Infinity 回 null", () => {
    assert.equal(normalizeHeroImageBounds({ ...good, topPct: NaN }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, bottomPct: Infinity }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, fileAspect: -Infinity }), null);
  });

  it("topPct < 0、bottomPct > 100、bottom <= top 都回 null", () => {
    assert.equal(normalizeHeroImageBounds({ ...good, topPct: -0.1 }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, bottomPct: 100.1 }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, topPct: 50, bottomPct: 50 }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, topPct: 60, bottomPct: 30 }), null);
  });

  it("整張都是主體（0 到 100）是合法的", () => {
    const out = normalizeHeroImageBounds({ ...good, topPct: 0, bottomPct: 100 });
    assert.deepEqual(out, { ...good, topPct: 0, bottomPct: 100 });
  });

  it("寬高比只收 0.05 到 20：邊界收、超出丟", () => {
    assert.equal(normalizeHeroImageBounds({ ...good, fileAspect: 0.05 })?.fileAspect, 0.05);
    assert.equal(normalizeHeroImageBounds({ ...good, fileAspect: 20 })?.fileAspect, 20);
    assert.equal(normalizeHeroImageBounds({ ...good, fileAspect: 0.049 }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, fileAspect: 20.01 }), null);
    assert.equal(normalizeHeroImageBounds({ ...good, fileAspect: 0 }), null);
  });

  it("不動傳進來的物件", () => {
    const input = { ...good, url: `  ${good.url}` };
    normalizeHeroImageBounds(input);
    assert.equal(input.url, `  ${good.url}`);
  });
});

describe("clampHeroSplitPhotoAspect（split hero「跟照片」的比例夾在 1:2 到 3:1）", () => {
  it("範圍常數就是 1:2 與 3:1", () => {
    assert.equal(HERO_SPLIT_PHOTO_ASPECT_MIN, 0.5);
    assert.equal(HERO_SPLIT_PHOTO_ASPECT_MAX, 3);
  });
  it("範圍內原樣回、比 1:2 更直夾到 0.5、比 3:1 更扁夾到 3", () => {
    assert.equal(clampHeroSplitPhotoAspect(1.5), 1.5);
    assert.equal(clampHeroSplitPhotoAspect(0.5), 0.5);
    assert.equal(clampHeroSplitPhotoAspect(3), 3);
    assert.equal(clampHeroSplitPhotoAspect(0.2), 0.5);
    assert.equal(clampHeroSplitPhotoAspect(8), 3);
  });
});

describe("clampHeroPreviewAspect（編輯器 Hero 預覽框比例夾在 3:4 到 3:1）", () => {
  it("下限比 split 的寬（面板窄，太直會撐長整欄），上限一樣 3:1", () => {
    assert.equal(HERO_PREVIEW_ASPECT_MIN, 0.75);
    assert.equal(HERO_PREVIEW_ASPECT_MAX, 3);
    assert.ok(HERO_PREVIEW_ASPECT_MIN > HERO_SPLIT_PHOTO_ASPECT_MIN);
  });
  it("範圍內回同一個數（呼叫端靠 === 判斷有沒有被夾過）、超出就夾", () => {
    assert.equal(clampHeroPreviewAspect(1.786), 1.786);
    assert.equal(clampHeroPreviewAspect(0.6), 0.75);
    assert.equal(clampHeroPreviewAspect(4), 3);
  });
});

describe("heroBannerGeometry（公開頁 banner 與編輯器預覽框共用的框幾何）", () => {
  it("1:1 的檔、主體 22%–78%：框比例 1 / 0.56，主體中點 50%", () => {
    const g = heroBannerGeometry({ url: "https://x/a.jpg", topPct: 22, bottomPct: 78, fileAspect: 1 });
    assert.equal(g.aspect, 1 / 0.56);
    assert.equal(g.contentMid, 50);
    assert.equal(g.objectPosition, "50% 50.00%");
  });

  it("主體偏上：object-position 對到主體中點、兩位小數", () => {
    const g = heroBannerGeometry({ url: "https://x/b.jpg", topPct: 10, bottomPct: 43.333, fileAspect: 1.5 });
    assert.equal(g.contentMid, (10 + 43.333) / 2);
    assert.equal(g.objectPosition, "50% 26.67%");
    assert.equal(g.aspect, 1.5 / ((43.333 - 10) / 100));
  });

  it("整張都是主體（0–100）：框比例就是檔案比例", () => {
    const g = heroBannerGeometry({ url: "https://x/c.jpg", topPct: 0, bottomPct: 100, fileAspect: 2 });
    assert.equal(g.aspect, 2);
    assert.equal(g.objectPosition, "50% 50.00%");
  });

  it("HERO_IMAGE_MAX_HEIGHT_VH：screen 是整個螢幕、short 比它矮，兩檔都在 0–100", () => {
    assert.equal(HERO_IMAGE_MAX_HEIGHT_VH.screen, 100);
    assert.ok(HERO_IMAGE_MAX_HEIGHT_VH.short > 0 && HERO_IMAGE_MAX_HEIGHT_VH.short < 100);
  });

  it("HERO_SPLIT_HEIGHT_VH：normal 是整個螢幕（md:min-h-screen）、compact 七成，圖欄寬跟 CSS 段高吃同一個數", () => {
    assert.equal(HERO_SPLIT_HEIGHT_VH.normal, 100);
    assert.equal(HERO_SPLIT_HEIGHT_VH.compact, 70);
    assert.ok(HERO_SPLIT_HEIGHT_VH.compact < HERO_SPLIT_HEIGHT_VH.normal);
  });

  it("HERO_TEXT_GAP_SCALE：緊小於 1、鬆大於 1（倍率乘在原 rem 上，1 就等於沒動）", () => {
    assert.ok(HERO_TEXT_GAP_SCALE.tight > 0 && HERO_TEXT_GAP_SCALE.tight < 1);
    assert.ok(HERO_TEXT_GAP_SCALE.loose > 1);
  });

  // 四種版型（滿版／分欄／雜誌／極簡）各一格，都走這支：normal 回 null（不覆寫 inline
  // style，既有店家一個像素都不動），另外兩檔查表。
  it("heroTextGapScale：normal 回 null、tight／loose 回表裡的倍率", () => {
    assert.equal(heroTextGapScale("normal"), null);
    assert.equal(heroTextGapScale("tight"), HERO_TEXT_GAP_SCALE.tight);
    assert.equal(heroTextGapScale("loose"), HERO_TEXT_GAP_SCALE.loose);
  });

  // 滿版／雜誌／極簡三個版型的上下、左右內距那幾格都走這兩支：同一串 clamp 要同時套
  // 兩邊，以前逐字寫兩次、改一邊漏另一邊就變成上緊下鬆。
  it("heroTextGapMargins：normal 兩邊都回空物件（inline 不輸出）、tight／loose 乘上倍率並只給該邊的 key", () => {
    const normal = heroTextGapMargins("normal");
    assert.deepEqual(normal.top(2), {});
    assert.deepEqual(normal.bottom(2), {});
    const tight = heroTextGapMargins("tight");
    assert.deepEqual(tight.top(2), { marginTop: `${2 * HERO_TEXT_GAP_SCALE.tight}rem` });
    assert.deepEqual(tight.bottom(1.5), { marginBottom: `${1.5 * HERO_TEXT_GAP_SCALE.tight}rem` });
    const loose = heroTextGapMargins("loose");
    assert.deepEqual(loose.top(1), { marginTop: `${HERO_TEXT_GAP_SCALE.loose}rem` });
  });

  it("padY／padX：同一個值套到成對的兩邊，且只有那兩個 key", () => {
    assert.deepEqual(padY("clamp(2rem, 5vw, 3rem)"), {
      paddingTop: "clamp(2rem, 5vw, 3rem)",
      paddingBottom: "clamp(2rem, 5vw, 3rem)",
    });
    assert.deepEqual(padX("1.5rem"), { paddingLeft: "1.5rem", paddingRight: "1.5rem" });
  });

  it("HERO_FULL_HEIGHT_VH：矮 < 高 < 全屏，全屏就是整個螢幕", () => {
    assert.equal(HERO_FULL_HEIGHT_VH.full, 100);
    assert.ok(HERO_FULL_HEIGHT_VH.short < HERO_FULL_HEIGHT_VH.tall);
    assert.ok(HERO_FULL_HEIGHT_VH.tall < HERO_FULL_HEIGHT_VH.full);
  });

  // 公開頁桌機那格是 Tailwind class，class 名得寫死在原始碼裡讓 Tailwind 掃得到、沒法從表插值；
  // 這裡直接讀 page.tsx 原始碼，確認三個 class 帶的數字跟表一樣（手機 CSS 與編輯器 hint 都查表，
  // 表改了 class 沒跟上，桌機跟手機就會撐出不同高度、面板寫的數字也跟客人看到的對不上）。
  it("HERO_FULL_HEIGHT_VH：公開頁 page.tsx 手寫的 min-h class 跟表對得上", () => {
    const src = readFileSync(new URL("../app/[slug]/page.tsx", import.meta.url), "utf8");
    assert.ok(src.includes(`"min-h-[${HERO_FULL_HEIGHT_VH.short}vh]"`), "short 那檔的 class 跟表不一樣");
    assert.ok(src.includes(`"min-h-[${HERO_FULL_HEIGHT_VH.tall}vh]"`), "tall 那檔的 class 跟表不一樣");
    // full 是 100vh，Tailwind 內建的 min-h-screen；表上 full 不是 100 時 class 也得換掉
    assert.equal(HERO_FULL_HEIGHT_VH.full, 100);
    assert.ok(src.includes('"min-h-screen"'));
  });
});

describe("pickHeroImageBounds（存的邊界只有在就是現在這張圖時才算數）", () => {
  it("沒存、或現在沒有 hero 圖，都回 null", () => {
    assert.equal(pickHeroImageBounds(null, good.url), null);
    assert.equal(pickHeroImageBounds(undefined, good.url), null);
    assert.equal(pickHeroImageBounds(good, null), null);
    assert.equal(pickHeroImageBounds(good, undefined), null);
    assert.equal(pickHeroImageBounds(good, ""), null);
  });

  it("url 完全相同就回同一個物件", () => {
    assert.equal(pickHeroImageBounds(good, good.url), good);
  });

  it("商家換了圖（url 不同，哪怕只差查詢字串或大小寫）就當沒存過", () => {
    assert.equal(pickHeroImageBounds(good, good.url + "?v=2"), null);
    assert.equal(pickHeroImageBounds(good, good.url.toUpperCase()), null);
  });
});

// ---- detectHeroImageBounds：假瀏覽器 ----

type Rgb = [number, number, number];
type Scene = {
  w: number;
  h: number;
  pixel: (x: number, y: number) => Rgb;
  /** 模擬各種失敗：圖載不到、拿不到 2d context、getImageData 因 CORS 丟例外 */
  fail?: "load" | "context" | "cors";
};

const BEIGE: Rgb = [240, 230, 210];
/** 有內容的像素：同一 row 內左右顏色差很多，變異度高 */
const busy = (x: number, y: number): Rgb => [
  (x * 53 + y * 7) % 256,
  (x * 97 + y * 13) % 256,
  (x * 31 + y * 3) % 256,
];

let scene: Scene | null = null;
const imageDataCalls: Array<[number, number, number, number]> = [];

class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_v: string) {
    queueMicrotask(() => {
      const s = scene;
      if (!s || s.fail === "load") {
        this.onerror?.();
        return;
      }
      this.naturalWidth = s.w;
      this.naturalHeight = s.h;
      this.onload?.();
    });
  }
}

function fakeCanvas() {
  const s = scene!;
  return {
    width: 0,
    height: 0,
    getContext(kind: string) {
      assert.equal(kind, "2d");
      if (s.fail === "context") return null;
      return {
        drawImage() {},
        getImageData(x: number, y: number, w: number, h: number) {
          imageDataCalls.push([x, y, w, h]);
          if (s.fail === "cors") throw new Error("SecurityError: tainted canvas");
          const data = new Uint8ClampedArray(w * h * 4);
          for (let yy = 0; yy < h; yy++) {
            for (let xx = 0; xx < w; xx++) {
              const [r, g, b] = s.pixel(x + xx, y + yy);
              const i = (yy * w + xx) * 4;
              data[i] = r;
              data[i + 1] = g;
              data[i + 2] = b;
              data[i + 3] = 255;
            }
          }
          return { data };
        },
      };
    },
  };
}

const g = globalThis as Record<string, unknown>;
const saved = { window: g.window, document: g.document };

describe("detectHeroImageBounds（抓中央縱條逐 row 算變異度）", () => {
  before(() => {
    g.window = { Image: FakeImage };
    g.document = {
      createElement(tag: string) {
        assert.equal(tag, "canvas");
        return fakeCanvas();
      },
    };
  });
  after(() => {
    g.window = saved.window;
    g.document = saved.document;
  });
  afterEach(() => {
    scene = null;
    imageDataCalls.length = 0;
  });

  it("沒有 window（伺服器端）直接回 null，不去碰 Image", async () => {
    const w = g.window;
    g.window = undefined;
    try {
      assert.equal(await detectHeroImageBounds("https://x/a.jpg"), null);
    } finally {
      g.window = w;
    }
  });

  it("空 url 回 null", async () => {
    scene = { w: 10, h: 10, pixel: busy };
    assert.equal(await detectHeroImageBounds(""), null);
  });

  it("圖載不到（onerror）回 null", async () => {
    scene = { w: 100, h: 100, pixel: busy, fail: "load" };
    assert.equal(await detectHeroImageBounds("https://x/broken.jpg"), null);
  });

  it("載到但尺寸是 0 回 null", async () => {
    scene = { w: 0, h: 0, pixel: busy };
    assert.equal(await detectHeroImageBounds("https://x/empty.jpg"), null);
  });

  it("拿不到 2d context 回 null", async () => {
    scene = { w: 100, h: 100, pixel: busy, fail: "context" };
    assert.equal(await detectHeroImageBounds("https://x/a.jpg"), null);
  });

  it("getImageData 因 CORS 丟例外：接住回 null，不讓例外往外冒", async () => {
    scene = { w: 100, h: 100, pixel: busy, fail: "cors" };
    assert.equal(await detectHeroImageBounds("https://x/a.jpg"), null);
  });

  it("上下各有一段純色留白：topPct 是第一個有內容的 row、bottomPct 是最後一個", async () => {
    // 100×100，row 0-29 米色、row 30-79 有內容、row 80-99 米色
    scene = {
      w: 100,
      h: 100,
      pixel: (x, y) => (y >= 30 && y <= 79 ? busy(x, y) : BEIGE),
    };
    const out = await detectHeroImageBounds("https://x/tall.jpg");
    assert.deepEqual(out, {
      url: "https://x/tall.jpg",
      topPct: 30,
      bottomPct: 79,
      fileAspect: 1,
    });
  });

  it("整張都有內容：0 到最後一 row，fileAspect 是寬除以高", async () => {
    scene = { w: 300, h: 200, pixel: busy };
    const out = await detectHeroImageBounds("https://x/full.jpg");
    assert.deepEqual(out, {
      url: "https://x/full.jpg",
      topPct: 0,
      bottomPct: 99.5,
      fileAspect: 1.5,
    });
  });

  it("整張都是純色（偵測不到主體）：當整張都是主體，不會算成負高度", async () => {
    scene = { w: 100, h: 100, pixel: () => BEIGE };
    const out = await detectHeroImageBounds("https://x/flat.jpg");
    assert.deepEqual(out, { url: "https://x/flat.jpg", topPct: 0, bottomPct: 99, fileAspect: 1 });
  });

  it("主體不到整張 10%（只有 5 row 有內容）：退回整張都是主體", async () => {
    scene = {
      w: 100,
      h: 100,
      pixel: (x, y) => (y >= 50 && y <= 54 ? busy(x, y) : BEIGE),
    };
    const out = await detectHeroImageBounds("https://x/tiny.jpg");
    assert.equal(out?.topPct, 0);
    assert.equal(out?.bottomPct, 99);
  });

  it("主體剛好 10%（11 row）就照實回，不退回整張", async () => {
    scene = {
      w: 100,
      h: 100,
      pixel: (x, y) => (y >= 40 && y <= 50 ? busy(x, y) : BEIGE),
    };
    const out = await detectHeroImageBounds("https://x/ok.jpg");
    assert.equal(out?.topPct, 40);
    assert.equal(out?.bottomPct, 50);
  });

  it("每一 row 自己是純色、只是上下 row 顏色不同（漸層天空）：不算主體，退回整張", async () => {
    // 演算法看的是同一 row 左右的變異度，不是上下 row 的差異
    scene = { w: 100, h: 100, pixel: (_x, y) => [y * 2, y * 2, y * 2] };
    const out = await detectHeroImageBounds("https://x/gradient.jpg");
    assert.equal(out?.topPct, 0);
    assert.equal(out?.bottomPct, 99);
  });

  it("只抓正中央 5% 寬的縱條：寬 400 取 20px、從 x=190 起、整個高度", async () => {
    scene = { w: 400, h: 200, pixel: busy };
    await detectHeroImageBounds("https://x/wide.jpg");
    assert.deepEqual(imageDataCalls, [[190, 0, 20, 200]]);
  });

  it("縱條寬度夾在 10 到 60px：窄圖至少 10、超寬圖最多 60", async () => {
    scene = { w: 100, h: 50, pixel: busy };
    await detectHeroImageBounds("https://x/narrow.jpg");
    scene = { w: 4000, h: 50, pixel: busy };
    await detectHeroImageBounds("https://x/huge.jpg");
    assert.deepEqual(imageDataCalls, [
      [45, 0, 10, 50],
      [1970, 0, 60, 50],
    ]);
  });

  it("主體只在中央、左右兩側整片留白：仍能靠中央縱條找到上下緣", async () => {
    // 400×200，內容只在 x 190-209、y 30-159；左右兩側全米色
    scene = {
      w: 400,
      h: 200,
      pixel: (x, y) => (x >= 190 && x < 210 && y >= 30 && y <= 159 ? busy(x, y) : BEIGE),
    };
    const out = await detectHeroImageBounds("https://x/center.jpg");
    assert.deepEqual(out, {
      url: "https://x/center.jpg",
      topPct: 15,
      bottomPct: 79.5,
      fileAspect: 2,
    });
  });

  it("偵測結果一定過得了 normalizeHeroImageBounds（兩邊口徑一致）", async () => {
    scene = {
      w: 640,
      h: 960,
      pixel: (x, y) => (y >= 100 && y <= 800 ? busy(x, y) : BEIGE),
    };
    const out = await detectHeroImageBounds("https://x/portrait.jpg");
    assert.ok(out);
    assert.deepEqual(normalizeHeroImageBounds(out), out);
  });
});
