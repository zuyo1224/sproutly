// lib/image-url.ts 四支 helper 的行為固定測試。
//
// 為什麼要有這份：這四支是「手貼圖片網址」整條線的口徑來源——寫入端（products/actions.ts、
// ImageUrlHintInput）、後台標記（商品編輯頁、列表頁、總覽）、店面渲染（詳情頁主圖、輪播、
// 首頁八處卡片）、對外報給 Google／社群（og:image、JSON-LD、sitemap）全部靠它們判。
// 哪一支放寬或收緊一個字元，後台標「店面不會放」的那幾張跟店面實際不掛的那幾張就對不上。
// 這裡把每支的邊界（空白、http://、相對路徑、// 開頭、去重、保排序、非陣列輸入）寫死，
// 之後有人改 helper，跑 `npm test` 就知道動到哪條線。
//
// 用 Node 內建的 node:test + node:assert，不裝 vitest／jest：專案 Node 24 原生剝除型別、
// 直接跑 .ts，少一套依賴要維護。Node 剝型別時不做副檔名補全，所以 import 要寫 ./image-url.ts
// （tsconfig 已開 allowImportingTsExtensions，noEmit 下這是合法的）。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  absoluteImageUrls,
  displayableImageUrls,
  displayableImageUrl,
  isOptimizableImageSrc,
  isPastedRemoteImageUrl,
} from "./image-url.ts";

describe("absoluteImageUrls（餵 Google／社群：只認絕對網址，http:// 也放行）", () => {
  it("非陣列輸入一律回空陣列", () => {
    assert.deepEqual(absoluteImageUrls(null), []);
    assert.deepEqual(absoluteImageUrls(undefined), []);
    assert.deepEqual(absoluteImageUrls("https://a.example/x.jpg" as unknown as string[]), []);
  });

  it("去前後空白、擋空字串與只有空白的列、擋非字串", () => {
    assert.deepEqual(
      absoluteImageUrls(["  https://a.example/x.jpg  ", "", "   ", null, undefined, 42 as unknown as string]),
      ["https://a.example/x.jpg"],
    );
  });

  it("相對路徑、// 開頭、非網址字串都擋；http:// 與 https:// 都放行（大小寫不拘）", () => {
    assert.deepEqual(
      absoluteImageUrls(["/photo.jpg", "//cdn.example/x.jpg", "abc", "my photo.jpg", "HTTP://a.example/x.jpg", "http://b.example/y.jpg"]),
      ["HTTP://a.example/x.jpg", "http://b.example/y.jpg"],
    );
  });

  it("去重並保持原排序（第一張仍是主圖）", () => {
    assert.deepEqual(
      absoluteImageUrls(["https://a.example/2.jpg", "https://a.example/1.jpg", " https://a.example/2.jpg", "https://a.example/1.jpg"]),
      ["https://a.example/2.jpg", "https://a.example/1.jpg"],
    );
  });
});

describe("isOptimizableImageSrc（渲染端保險：能不能交給 next/image 的 loader）", () => {
  it("非字串、空字串、只有空白都判不過", () => {
    assert.equal(isOptimizableImageSrc(null), false);
    assert.equal(isOptimizableImageSrc(undefined), false);
    assert.equal(isOptimizableImageSrc(""), false);
    assert.equal(isOptimizableImageSrc("   "), false);
  });

  it("站內相對路徑放行，// 開頭（protocol-relative）不放行", () => {
    assert.equal(isOptimizableImageSrc("/logo.png"), true);
    assert.equal(isOptimizableImageSrc("  /logo.png  "), true);
    assert.equal(isOptimizableImageSrc("//cdn.example/x.jpg"), false);
  });

  it("只有 https:// 絕對網址放行；http://、ftp://、data:、非網址都判不過", () => {
    assert.equal(isOptimizableImageSrc("https://a.example/x.jpg"), true);
    assert.equal(isOptimizableImageSrc("HTTPS://a.example/x.jpg"), true);
    assert.equal(isOptimizableImageSrc("http://a.example/x.jpg"), false);
    assert.equal(isOptimizableImageSrc("ftp://a.example/x.jpg"), false);
    assert.equal(isOptimizableImageSrc("data:image/png;base64,AAAA"), false);
    assert.equal(isOptimizableImageSrc("abc"), false);
    assert.equal(isOptimizableImageSrc("my photo.jpg"), false);
  });
});

describe("isPastedRemoteImageUrl（寫入端口徑：商家手貼的字串能不能收）", () => {
  it("非字串、空字串、只有空白都判不過", () => {
    assert.equal(isPastedRemoteImageUrl(null), false);
    assert.equal(isPastedRemoteImageUrl(undefined), false);
    assert.equal(isPastedRemoteImageUrl(""), false);
    assert.equal(isPastedRemoteImageUrl("   "), false);
  });

  it("跟 isOptimizableImageSrc 的差別：站內相對路徑也不收（商家貼的多半是漏網域的半截網址）", () => {
    assert.equal(isPastedRemoteImageUrl("/photo.jpg"), false);
    assert.equal(isOptimizableImageSrc("/photo.jpg"), true);
  });

  it("只收 https:// 且有主機名的完整網址；前後空白容忍", () => {
    assert.equal(isPastedRemoteImageUrl("https://a.example/x.jpg"), true);
    assert.equal(isPastedRemoteImageUrl("  https://a.example/x.jpg  "), true);
    assert.equal(isPastedRemoteImageUrl("https://a.example"), true);
    assert.equal(isPastedRemoteImageUrl("http://a.example/x.jpg"), false);
    assert.equal(isPastedRemoteImageUrl("//cdn.example/x.jpg"), false);
    assert.equal(isPastedRemoteImageUrl("https://"), false);
    assert.equal(isPastedRemoteImageUrl("abc"), false);
    assert.equal(isPastedRemoteImageUrl("my photo.jpg"), false);
  });
});

describe("displayableImageUrls（店面實際掛的那批：只留 isPastedRemoteImageUrl 判得過的）", () => {
  it("非陣列輸入一律回空陣列；全部判不過也回空陣列（呼叫端走「沒有圖」佔位格）", () => {
    assert.deepEqual(displayableImageUrls(null), []);
    assert.deepEqual(displayableImageUrls(undefined), []);
    assert.deepEqual(displayableImageUrls(["http://a.example/x.jpg", "/photo.jpg", "  ", ""]), []);
  });

  it("http:// 那張跳過、拿後面第一張判得過的當主圖；去空白、去重、保排序", () => {
    assert.deepEqual(
      displayableImageUrls([
        "http://a.example/old.jpg",
        " https://a.example/2.jpg ",
        "/photo.jpg",
        "https://a.example/1.jpg",
        "https://a.example/2.jpg",
        null,
      ]),
      ["https://a.example/2.jpg", "https://a.example/1.jpg"],
    );
  });

  it("是 absoluteImageUrls 的子集：同一份輸入，displayable 的每一張都在 absolute 裡、且順序一致", () => {
    const input = ["http://a.example/old.jpg", "https://a.example/2.jpg", "/photo.jpg", "https://a.example/1.jpg", "HTTP://b.example/z.jpg"];
    const abs = absoluteImageUrls(input);
    const disp = displayableImageUrls(input);
    assert.deepEqual(disp, abs.filter((u) => disp.includes(u)));
    assert.deepEqual(abs, ["http://a.example/old.jpg", "https://a.example/2.jpg", "https://a.example/1.jpg", "HTTP://b.example/z.jpg"]);
    assert.deepEqual(disp, ["https://a.example/2.jpg", "https://a.example/1.jpg"]);
  });

  it("後台標記那條同口徑：image_urls 裡 isPastedRemoteImageUrl 判不過的張數 + displayable 張數 = 原始去重前的張數（沒有重複時）", () => {
    const input = ["http://a.example/old.jpg", "https://a.example/2.jpg", "/photo.jpg", "https://a.example/1.jpg", "  "];
    const broken = input.filter((u) => !isPastedRemoteImageUrl(u)).length;
    assert.equal(broken + displayableImageUrls(input).length, input.length);
  });
});

describe("displayableImageUrl（heroUrl／logoUrl 單值版）", () => {
  it("https:// 完整網址去前後空白後原樣回", () => {
    assert.equal(displayableImageUrl("  https://a.example/hero.jpg  "), "https://a.example/hero.jpg");
  });

  it("http://、站內相對路徑、空白、null、undefined 都回 null（不是 undefined）", () => {
    for (const v of ["http://a.example/hero.jpg", "/hero.jpg", "//a.example/hero.jpg", "   ", "", null, undefined, "abc"]) {
      assert.strictEqual(displayableImageUrl(v), null, `input=${JSON.stringify(v)}`);
    }
  });

  it("跟 displayableImageUrls([x])[0] 同口徑", () => {
    for (const v of ["https://a.example/1.jpg", "http://a.example/1.jpg", "/x.jpg", " https://b.example/2.png "]) {
      assert.strictEqual(displayableImageUrl(v), displayableImageUrls([v])[0] ?? null);
    }
  });
});
