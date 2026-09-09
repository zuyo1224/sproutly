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
import {
  detectHeroImageBounds,
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
