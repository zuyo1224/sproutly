// lib/store-slug.ts 店面網址檢查的行為固定測試。
//
// 為什麼要有這份：[slug] 是 app/ 底下的萬用段，任何頂層靜態頁（login、dashboard、
// Next 自動產的 /icon、/apple-icon…）都比它優先。保留字漏一個不會噴錯，只會讓取到
// 那個名字的店家整間打不開——以前就漏了 icon 與 apple-icon。最後一個測試直接掃 app/
// 頂層，之後新增平台頁忘了加保留字，跑測試就會抓到。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import {
  RESERVED_STORE_SLUGS,
  isStoreSlugShaped,
  normalizeStoreSlug,
  storeSlugError,
} from "./store-slug.ts";

describe("normalizeStoreSlug", () => {
  it("去頭尾空白、轉小寫", () => {
    assert.equal(normalizeStoreSlug("  My-Shop \n"), "my-shop");
  });

  it("null／undefined 當空字串", () => {
    assert.equal(normalizeStoreSlug(null), "");
    assert.equal(normalizeStoreSlug(undefined), "");
  });
});

describe("storeSlugError", () => {
  it("合法網址回 null（含數字、連字號、剛好 3 與 32 字）", () => {
    assert.equal(storeSlugError("plant-shop-2"), null);
    assert.equal(storeSlugError("abc"), null);
    assert.equal(storeSlugError("a".repeat(32)), null);
  });

  it("空字串要求填寫", () => {
    assert.equal(storeSlugError(""), "請填店面網址");
  });

  it("中文、大寫、底線、點、斜線、空白都擋", () => {
    for (const bad of ["盆栽店", "Shop", "my_shop", "shop.tw", "a/b", "my shop"]) {
      assert.equal(
        storeSlugError(bad),
        "店面網址只能小寫英文、數字、連字號（-）",
        bad,
      );
    }
  });

  it("太短太長都擋", () => {
    assert.equal(storeSlugError("ab"), "店面網址 3 到 32 個字");
    assert.equal(storeSlugError("a".repeat(33)), "店面網址 3 到 32 個字");
  });

  it("保留字擋下並帶出名字", () => {
    for (const word of RESERVED_STORE_SLUGS) {
      assert.equal(storeSlugError(word), `網址「${word}」是系統保留字，換一個試試`);
    }
  });

  it("只擋完全相同，開頭撞名的店照樣能開", () => {
    for (const ok of ["login-garden", "apiary", "icon-studio", "dashboard-coffee"]) {
      assert.equal(storeSlugError(ok), null, ok);
    }
  });
});

describe("isStoreSlugShaped（auth/callback 拿網址參數的 slug 接路徑前用）", () => {
  it("小寫英數與連字號放行，不管長度與保留字（舊店連結不被誤擋）", () => {
    assert.equal(isStoreSlugShaped("plantaemarket"), true);
    assert.equal(isStoreSlugShaped("a"), true);
    assert.equal(isStoreSlugShaped("login"), true);
  });

  it("null／空字串／會改路徑結構的字元都擋", () => {
    for (const bad of [null, undefined, "", "..", "../dashboard", "a/b", "shop?x=1", "shop#top", "Shop", " shop", "%2e%2e"]) {
      assert.equal(isStoreSlugShaped(bad), false, String(bad));
    }
  });
});

describe("RESERVED_STORE_SLUGS 跟 app/ 頂層路由同步", () => {
  it("app/ 底下每個會佔用頂層網址、又長得像合法 slug 的段都在保留字裡", () => {
    const appDir = new URL("../app/", import.meta.url);
    const segments = new Set<string>();
    // 不產生網址的特殊檔（版型、錯誤頁、載入中…），以及會產生帶副檔名網址的 metadata 檔
    const nonRouteFiles = new Set([
      "page", "layout", "template", "error", "global-error", "loading",
      "not-found", "default", "route", "middleware", "proxy",
      "robots", "sitemap", "manifest",
    ]);
    for (const entry of readdirSync(appDir, { withFileTypes: true })) {
      const name = entry.name;
      if (entry.isDirectory()) {
        // _私有資料夾、[動態段]、(群組) 不佔頂層網址
        if (/^[_[(]/.test(name)) continue;
        segments.add(name);
      } else if (/\.(tsx?|jsx?)$/.test(name)) {
        const base = name.replace(/\.(tsx?|jsx?)$/, "");
        if (nonRouteFiles.has(base)) continue;
        segments.add(base);
      }
    }
    const slugLike = [...segments].filter((s) => /^[a-z0-9-]+$/.test(s));
    assert.ok(slugLike.includes("dashboard"), "掃描應該找得到 dashboard，掃錯目錄了");
    const missing = slugLike.filter((s) => !RESERVED_STORE_SLUGS.has(s));
    assert.deepEqual(missing, [], `這些頂層網址沒列在保留字：${missing.join(", ")}`);
  });
});
