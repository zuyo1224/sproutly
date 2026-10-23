// app/[slug]/_theme.ts 的 resolveTheme／themeToCssVars 行為固定測試。
//
// 為什麼要有這份：店面、編輯器、設定頁讀 stores.theme（jsonb）都只走 resolveTheme 這一道。
// DB 裡的值可能是舊版資料、手改、或型別塞錯；這支一壞，不會噴錯，只會讓整家店的配色、
// 區段順序、Hero 縮放安靜地跑掉，甚至把任意網站掛進地圖 iframe。底下各支小 helper 已有
// 自己的測試，這裡只鎖「組起來之後」的結果：沒填用 preset 預設、型別不對當沒填、
// 只填一半的條目要留著、全空的丟掉、撞 key 只留第一筆、舊欄位會被搬到新欄位。
//
// _theme.ts 用 @/ 路徑別名，node --test 不認得；這裡用 registerHooks 把 @/ 對到專案根目錄
// （先試補 .ts，沒有再原樣），只影響這個測試檔的載入，不動 tsconfig、不動其他測試。
import * as nodeModule from "node:module";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// 專案裝的 @types/node 還沒有 registerHooks 的型別（Node 22.15+ 才有），這裡自己補最小一份。
type ResolveResult = { url: string };
type ResolveNext = (specifier: string, context: unknown) => ResolveResult;
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: {
    resolve: (specifier: string, context: unknown, next: ResolveNext) => ResolveResult;
  }) => void;
};

const ROOT = new URL("../", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const target = ROOT + specifier.slice(2);
      try {
        return next(target + ".ts", context);
      } catch {
        return next(target, context);
      }
    }
    return next(specifier, context);
  },
});

const themeUrl = pathToFileURL(
  new URL("../app/[slug]/_theme.ts", import.meta.url).pathname
).href;
const { resolveTheme, themeToCssVars, PRESETS, FONT_LABELS, DEFAULT_SECTION_ORDER } =
  (await import(themeUrl)) as typeof import("../app/[slug]/_theme.ts");

const MAP = "https://www.google.com/maps/embed?pb=!1m18!1m12";

describe("resolveTheme 頂層", () => {
  it("null／陣列／字串都當空物件，套 aesop 預設", () => {
    for (const raw of [null, undefined, [], "x", 3]) {
      const t = resolveTheme(raw);
      assert.equal(t.preset, "aesop");
      assert.equal(t.primary, PRESETS.aesop.primary);
      assert.equal(t.font, PRESETS.aesop.font);
      assert.equal(t.logoUrl, null);
      assert.equal(t.tagline, null);
      assert.deepEqual(t.collections, {});
    }
  });

  it("不認得的 preset／font 退回預設，認得的照用", () => {
    assert.equal(resolveTheme({ preset: "wix" }).preset, "aesop");
    const t = resolveTheme({ preset: "nordic", font: "comic-sans" });
    assert.equal(t.preset, "nordic");
    assert.equal(t.font, PRESETS.nordic.font);
    assert.equal(resolveTheme({ preset: "nordic", font: "lora" }).font, "lora");
  });

  it("主色可蓋，但底色／文字色永遠跟 preset 走", () => {
    const t = resolveTheme({ preset: "modern", primary: "#123456", bg: "#000000" });
    assert.equal(t.primary, "#123456");
    assert.equal(t.bg, PRESETS.modern.bg);
    assert.equal(t.text, PRESETS.modern.text);
  });

  it("型別塞錯的主色當沒填", () => {
    assert.equal(resolveTheme({ primary: 123 }).primary, PRESETS.aesop.primary);
  });

  it("logo／hero／標語空字串當沒填", () => {
    const t = resolveTheme({ logo_url: "", hero_url: "", tagline: "" });
    assert.equal(t.logoUrl, null);
    assert.equal(t.heroUrl, null);
    assert.equal(t.tagline, null);
    assert.equal(resolveTheme({ logo_url: "https://a/b.png" }).logoUrl, "https://a/b.png");
  });

  it("情境照表只留非空字串", () => {
    const t = resolveTheme({ collections: { a: "https://x/1.jpg", b: "", c: 5, d: null } });
    assert.deepEqual(t.collections, { a: "https://x/1.jpg" });
  });
});

describe("resolveTheme layout", () => {
  it("空 layout 的預設值", () => {
    const l = resolveTheme({}).layout;
    assert.equal(l.heroStyle, "full-image");
    assert.equal(l.heroImageSide, "left");
    assert.deepEqual(l.sectionOrder, [...DEFAULT_SECTION_ORDER]);
    assert.equal(l.heroZoom, 1);
    assert.equal(l.heroZoomMobile, 1.5);
    assert.equal(l.heroZoomTablet, 1.3);
    assert.equal(l.heroZoomDesktop, 1);
    assert.equal(l.heroTaglineFontScaleMobile, null);
    assert.equal(l.featuredCount, 6);
    assert.equal(l.fontScale, 1);
    assert.equal(l.mapEmbedUrl, null);
    assert.deepEqual(l.freePositions, {});
  });

  it("舊版只存 heroZoom：三種裝置都沿用它（夾過範圍）", () => {
    const l = resolveTheme({ layout: { heroZoom: 2 } }).layout;
    assert.equal(l.heroZoomMobile, 2);
    assert.equal(l.heroZoomTablet, 2);
    assert.equal(l.heroZoomDesktop, 2);
    const big = resolveTheme({ layout: { heroZoom: 99, heroZoomMobile: 1.1 } }).layout;
    assert.equal(big.heroZoom, 2.5);
    assert.equal(big.heroZoomMobile, 1.1);
    assert.equal(big.heroZoomDesktop, 2.5);
  });

  it("精選商品數量夾在 3–12、小數無條件捨去，字串當沒填", () => {
    assert.equal(resolveTheme({ layout: { featuredCount: 50 } }).layout.featuredCount, 12);
    assert.equal(resolveTheme({ layout: { featuredCount: 1 } }).layout.featuredCount, 3);
    assert.equal(resolveTheme({ layout: { featuredCount: 7.9 } }).layout.featuredCount, 7);
    assert.equal(resolveTheme({ layout: { featuredCount: "9" } }).layout.featuredCount, 6);
  });

  it("基本區段沒列到的補在後面，不重複", () => {
    const order = resolveTheme({ layout: { sectionOrder: ["visit", "hero", "visit"] } }).layout
      .sectionOrder;
    assert.equal(order[0], "visit");
    assert.equal(order[1], "hero");
    assert.equal(new Set(order).size, order.length);
    for (const k of DEFAULT_SECTION_ORDER) assert.ok(order.includes(k));
  });

  it("顧客評語：半填留著、全空丟掉、前後空白修掉、職稱空白變 null", () => {
    const l = resolveTheme({
      layout: {
        testimonials: [
          { quote: "  好喝  ", author: "", role: "  " },
          { quote: " ", author: "  " },
          "not-object",
          null,
          { quote: "讚", author: "王", role: " 常客 " },
        ],
      },
    }).layout;
    assert.deepEqual(l.testimonials, [
      { quote: "好喝", author: "", role: null },
      { quote: "讚", author: "王", role: "常客" },
    ]);
  });

  it("常見問題／數字／合作夥伴：半填留著、全空丟掉", () => {
    const l = resolveTheme({
      layout: {
        faqItems: [{ question: "營業時間？" }, { question: "", answer: "" }],
        stats: [{ value: "10", label: "" }, { value: 10, label: 3 }],
        partners: [{ name: "", logoUrl: "https://x/l.png", href: "  " }, { name: " " }],
      },
    }).layout;
    assert.deepEqual(l.faqItems, [{ question: "營業時間？", answer: "" }]);
    assert.deepEqual(l.stats, [{ value: "10", label: "" }]);
    assert.deepEqual(l.partners, [{ name: "", logoUrl: "https://x/l.png", href: null }]);
  });

  it("照片牆沒網址的整筆丟掉，空說明變 null", () => {
    const l = resolveTheme({
      layout: { gallery: [{ url: "", caption: "x" }, { url: " https://x/g.jpg ", caption: " " }] },
    }).layout;
    assert.deepEqual(l.gallery, [{ url: "https://x/g.jpg", caption: null }]);
  });

  it("地圖只收 Google 嵌入網址，其他網站一律 null", () => {
    assert.equal(resolveTheme({ layout: { mapEmbedUrl: MAP } }).layout.mapEmbedUrl, MAP);
    assert.equal(
      resolveTheme({ layout: { mapEmbedUrl: "https://evil.example/embed" } }).layout.mapEmbedUrl,
      null
    );
    assert.equal(resolveTheme({ layout: { mapEmbedUrl: 5 } }).layout.mapEmbedUrl, null);
  });

  it("Hero 副標／小標空白變 null，有字就修掉前後空白", () => {
    const l = resolveTheme({ layout: { heroSubtitle: "  ", heroEyebrow: " 春季 " } }).layout;
    assert.equal(l.heroSubtitle, null);
    assert.equal(l.heroEyebrow, "春季");
  });

  it("不認得的選項值退回預設", () => {
    const l = resolveTheme({
      layout: { heroStyle: "carousel", heroImageSide: "top", buttonRadius: "blob" },
    }).layout;
    assert.equal(l.heroStyle, "full-image");
    assert.equal(l.heroImageSide, "left");
    assert.equal(l.buttonRadius, "pill");
  });

  it("自由定位：壞座標丟掉；舊 heroTaglinePosition 搬進 hero-tagline", () => {
    const l = resolveTheme({
      layout: {
        freePositions: { a: { x: 0.2, y: 0.3 }, b: { x: "1", y: 0 }, c: null },
        heroTaglinePosition: { x: 0.5, y: 0.5 },
      },
    }).layout;
    assert.deepEqual(l.freePositions, {
      a: { x: 0.2, y: 0.3 },
      "hero-tagline": { x: 0.5, y: 0.5 },
    });
  });

  it("新欄位已有 hero-tagline 時，舊座標不蓋過去", () => {
    const l = resolveTheme({
      layout: {
        freePositions: { "hero-tagline": { x: 0.1, y: 0.1 } },
        heroTaglinePosition: { x: 0.9, y: 0.9 },
      },
    }).layout;
    assert.deepEqual(l.freePositions["hero-tagline"], { x: 0.1, y: 0.1 });
  });
});

describe("resolveTheme homepage", () => {
  it("分類卡：沒 key 或沒標題的丟掉，撞 key 只留第一筆", () => {
    const h = resolveTheme({
      homepage: {
        collectionItems: [
          { key: "a", title: " 盆栽 ", subtitle: " 室內 " },
          { key: "", title: "無 key" },
          { key: "b", title: "  " },
          { key: "a", title: "重複" },
          "x",
        ],
      },
    }).homepage;
    assert.deepEqual(h.collectionItems, [{ key: "a", title: "盆栽", subtitle: "室內" }]);
  });

  it("文章卡：三欄全空才丟", () => {
    const h = resolveTheme({
      homepage: { journalCards: [{ eyebrow: "專欄" }, { title: " ", excerpt: "" }] },
    }).homepage;
    assert.deepEqual(h.journalCards, [{ eyebrow: "專欄", title: "", excerpt: "" }]);
  });

  it("標題類空白變 null；動畫只有明確 false 才關", () => {
    const h = resolveTheme({ homepage: { featuredTitle: "  ", shopTitle: " 商店 " } }).homepage;
    assert.equal(h.featuredTitle, null);
    assert.equal(h.shopTitle, "商店");
    assert.equal(h.enableAnimation, true);
    assert.equal(resolveTheme({ homepage: { enableAnimation: "false" } }).homepage.enableAnimation, true);
    assert.equal(resolveTheme({ homepage: { enableAnimation: false } }).homepage.enableAnimation, false);
  });
});

describe("themeToCssVars", () => {
  const vars = (raw: unknown) => themeToCssVars(resolveTheme(raw)) as Record<string, string>;

  it("顏色與字體從主題帶出", () => {
    const v = vars({ preset: "nordic", primary: "#abcdef", font: "lora" });
    assert.equal(v["--store-primary"], "#abcdef");
    assert.equal(v["--store-bg"], PRESETS.nordic.bg);
    assert.equal(v["--store-font"], FONT_LABELS.lora.family);
  });

  it("區段空白三檔對到倍率，預設 1", () => {
    assert.equal(vars({})["--store-section-pad"], "1");
    assert.equal(vars({ layout: { sectionPaddingScale: "compact" } })["--store-section-pad"], "0.6");
    assert.equal(vars({ layout: { sectionPaddingScale: "spacious" } })["--store-section-pad"], "1.4");
  });

  it("按鈕圓角三檔：藥丸、8px、直角", () => {
    assert.equal(vars({})["--store-btn-radius"], "9999px");
    assert.equal(vars({ layout: { buttonRadius: "soft" } })["--store-btn-radius"], "8px");
    assert.equal(vars({ layout: { buttonRadius: "square" } })["--store-btn-radius"], "0px");
  });

  it("全站字級換成百分比", () => {
    assert.equal(vars({}).fontSize, "100%");
  });
});
