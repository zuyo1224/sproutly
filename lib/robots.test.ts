// app/robots.ts 的擋爬規則行為固定測試。
//
// 為什麼要有這份：robots.txt 的 Disallow 是「前綴比對」（* 萬用、$ 錨定結尾），
// 規則寫鬆一點不會噴錯，只會安靜地把整間店擋在 Google 外面。以前寫 "/login"，
// 店名 login-garden 的 /login-garden 就整間不被收錄；反過來漏寫一條，客人的購物車、
// 訂單查詢頁就被爬。這裡照 Google 的比對規則（最長的規則勝出，一樣長 Allow 勝）
// 實際跑一遍：私人頁都擋、店面公開頁都放、名字長得像平台頁的店家也放。
//
// robots.ts 用 @/ 路徑別名，node --test 不認得；跟 resolve-theme.test.ts 一樣用
// registerHooks 把 @/ 對到專案根目錄，只影響這個測試檔的載入。
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

const robotsUrl = pathToFileURL(new URL("../app/robots.ts", import.meta.url).pathname).href;
const { default: robots } = (await import(robotsUrl)) as typeof import("../app/robots.ts");
const { siteBaseUrl } = await import("./store-schema.ts");

const config = robots();
const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules;
const asList = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const allows = asList(rule.allow);
const disallows = asList(rule.disallow);

// Google 的規則比對：* 任意字元、結尾 $ 錨定，其餘都是從頭開始的前綴比對。
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${re}${anchored ? "$" : ""}`).test(path);
}

// 最長（最具體）的命中規則勝出；一樣長時 Allow 勝。沒有規則命中就是允許。
function isAllowed(path: string): boolean {
  const longest = (list: string[]) =>
    Math.max(-1, ...list.filter((p) => matches(p, path)).map((p) => p.length));
  return longest(allows) >= longest(disallows);
}

describe("robots 擋爬規則", () => {
  it("平台私人頁都擋（含子頁與查詢字串）", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/",
      "/dashboard?tab=1",
      "/dashboard/stores/plantae/settings",
      "/login",
      "/login?error=x",
      "/login/",
      "/signup",
      "/signup?next=/dashboard",
      "/auth/callback?code=abc",
      "/api/ai-edit",
      "/api/asset-search?q=plant",
    ]) {
      assert.equal(isAllowed(path), false, path);
    }
  });

  it("店面裡客人的私人頁、JSON 端點都擋", () => {
    for (const path of [
      "/plantae/account",
      "/plantae/account/login",
      "/plantae/account/orders/123",
      "/plantae/cart",
      "/plantae/cart/checkout",
      "/plantae/checkout",
      "/plantae/track",
      "/plantae/track?order=1",
      "/plantae/favorites",
      "/plantae/favorites/api",
      "/plantae/search/api?q=蘭花",
    ]) {
      assert.equal(isAllowed(path), false, path);
    }
  });

  it("首頁與店面公開頁都放", () => {
    for (const path of [
      "/",
      "/sitemap.xml",
      "/plantae",
      "/plantae/shop",
      "/plantae/shop?category=pots",
      "/plantae/about",
      "/plantae/contact",
      "/plantae/products/7f1c2e4a-0000-4000-8000-000000000000",
    ]) {
      assert.equal(isAllowed(path), true, path);
    }
  });

  it("店名開頭撞到平台頁名稱的店家照樣放", () => {
    // slug 只保留 login／signup／dashboard／api／auth 本身，這些都是合法店名。
    for (const slug of [
      "login-garden",
      "signup-bakery",
      "dashboard-coffee",
      "loginshop",
      "apiary",
      "author-books",
      "cart",
      "track-and-field",
    ]) {
      assert.equal(isAllowed(`/${slug}`), true, slug);
      assert.equal(isAllowed(`/${slug}/shop`), true, `${slug}/shop`);
      assert.equal(isAllowed(`/${slug}/about`), true, `${slug}/about`);
    }
  });

  it("sitemap 與 host 指向站台網址", () => {
    assert.equal(config.sitemap, `${siteBaseUrl()}/sitemap.xml`);
    assert.equal(config.host, siteBaseUrl());
  });
});
