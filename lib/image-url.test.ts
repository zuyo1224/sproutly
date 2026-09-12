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
  brokenImageCount,
  storefrontCoverIndex,
  displayableImageUrls,
  displayableImageUrl,
  imageMimeTypeFromUrl,
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

  it("後台標記那條同口徑：brokenImageCount + displayable 張數 = 原始去重前的張數（沒有重複時）", () => {
    const input = ["http://a.example/old.jpg", "https://a.example/2.jpg", "/photo.jpg", "https://a.example/1.jpg", "  "];
    assert.equal(brokenImageCount(input) + displayableImageUrls(input).length, input.length);
  });
});

describe("brokenImageCount（後台琥珀點／提醒句：image_urls 裡店面不會放的張數）", () => {
  it("非陣列輸入回 0；全部判得過回 0", () => {
    assert.equal(brokenImageCount(null), 0);
    assert.equal(brokenImageCount(undefined), 0);
    assert.equal(brokenImageCount([]), 0);
    assert.equal(brokenImageCount(["https://a.example/1.jpg", " https://a.example/2.jpg "]), 0);
  });

  it("http://、半截網址、空白、null 各算一格；同一張壞網址貼兩次算兩格（不去重）", () => {
    assert.equal(
      brokenImageCount(["http://a.example/old.jpg", "/photo.jpg", "  ", null, "https://a.example/ok.jpg", "/photo.jpg"]),
      5,
    );
  });
});

describe("storefrontCoverIndex（後台「店面主圖」標記：客人看到的主圖是第幾格）", () => {
  it("非陣列、空陣列、全部判不過都回 -1", () => {
    assert.equal(storefrontCoverIndex(null), -1);
    assert.equal(storefrontCoverIndex(undefined), -1);
    assert.equal(storefrontCoverIndex([]), -1);
    assert.equal(storefrontCoverIndex(["http://a.example/old.jpg", "/photo.jpg", "  ", null]), -1);
  });

  it("第一張判得過回 0；第一張判不過時回後面第一個判得過的索引，且跟 displayableImageUrls 第一張同一格", () => {
    assert.equal(storefrontCoverIndex(["https://a.example/1.jpg", "http://a.example/old.jpg"]), 0);
    const input = ["http://a.example/old.jpg", "/photo.jpg", " https://a.example/2.jpg ", "https://a.example/1.jpg"];
    const idx = storefrontCoverIndex(input);
    assert.equal(idx, 2);
    assert.equal(input[idx].trim(), displayableImageUrls(input)[0]);
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

describe("imageMimeTypeFromUrl（webmanifest icons[].type：從副檔名推，認不出回 null）", () => {
  it("八種常見副檔名對到對應 MIME，jpg 與 jpeg 都是 image/jpeg", () => {
    const cases: [string, string][] = [
      ["https://a.example/logo.png", "image/png"],
      ["https://a.example/logo.jpg", "image/jpeg"],
      ["https://a.example/logo.jpeg", "image/jpeg"],
      ["https://a.example/logo.webp", "image/webp"],
      ["https://a.example/logo.gif", "image/gif"],
      ["https://a.example/logo.svg", "image/svg+xml"],
      ["https://a.example/logo.avif", "image/avif"],
      ["/favicon.ico", "image/x-icon"],
    ];
    for (const [input, expected] of cases) {
      assert.equal(imageMimeTypeFromUrl(input), expected, `input=${input}`);
    }
  });

  it("副檔名不分大小寫", () => {
    assert.equal(imageMimeTypeFromUrl("https://a.example/LOGO.PNG"), "image/png");
    assert.equal(imageMimeTypeFromUrl("https://a.example/logo.JpG"), "image/jpeg");
  });

  it("只看 pathname：Pexels 那種 .jpeg 後面接 query 的網址、帶 hash 的都判得出來", () => {
    assert.equal(
      imageMimeTypeFromUrl("https://images.pexels.com/photos/1/pexels-photo-1.jpeg?auto=compress&cs=tinysrgb&w=1260"),
      "image/jpeg",
    );
    assert.equal(imageMimeTypeFromUrl("https://a.example/logo.webp#top"), "image/webp");
    // query 裡的 .png 不算副檔名
    assert.strictEqual(imageMimeTypeFromUrl("https://a.example/render?file=logo.png"), null);
  });

  it("Supabase Storage 那種多層路徑，只看最後一段的副檔名", () => {
    assert.equal(
      imageMimeTypeFromUrl("https://x.supabase.co/storage/v1/object/public/store-assets/abc/logo-2.webp"),
      "image/webp",
    );
    // 路徑中段有點、最後一段沒副檔名 → null
    assert.strictEqual(imageMimeTypeFromUrl("https://x.supabase.co/v1.2/object/logo"), null);
  });

  it("沒副檔名、只有點、點在結尾、不認得的副檔名、非網址、空白、null、undefined 都回 null（不是 undefined）", () => {
    for (const v of [
      "https://a.example/logo",
      "https://a.example/.png",
      "https://a.example/logo.",
      "https://a.example/logo.bmp",
      "https://a.example/logo.pdf",
      "https://a.example/",
      "not a url at all",
      "   ",
      "",
      null,
      undefined,
    ]) {
      assert.strictEqual(imageMimeTypeFromUrl(v), null, `input=${JSON.stringify(v)}`);
    }
  });

  it("去前後空白後再判", () => {
    assert.equal(imageMimeTypeFromUrl("  https://a.example/logo.png  "), "image/png");
  });
});
