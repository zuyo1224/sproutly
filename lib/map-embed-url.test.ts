// lib/map-embed-url.ts cleanMapEmbedUrl 的行為固定測試。
//
// 為什麼要有這份：這支是「來店」區段 Google Maps 網址的唯一白名單，存檔端、公開頁讀取端、
// 編輯器即時提示三邊共用，且結果直接掛成 <iframe src>。放寬一點就是任何網站都能被
// 商家（或改 DB 的人）掛進自家首頁；收緊一點商家貼對的整段 iframe HTML 又被丟掉。
// 這裡把「只收 google.com/maps/embed 開頭、iframe HTML 挖 src 並還原 &amp;、分享短網址
// 與 place 網址不收、超長不收、空值回 null」寫死。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanMapEmbedUrl, MAX_MAP_EMBED_URL_LEN } from "./map-embed-url.ts";

const GOOD = "https://www.google.com/maps/embed?pb=!1m18!1m12";

describe("cleanMapEmbedUrl", () => {
  it("空值回 null", () => {
    assert.equal(cleanMapEmbedUrl(null), null);
    assert.equal(cleanMapEmbedUrl(undefined), null);
    assert.equal(cleanMapEmbedUrl(""), null);
    assert.equal(cleanMapEmbedUrl("   "), null);
  });

  it("正確的嵌入網址原樣回傳，前後空白去掉，有沒有 www 都收", () => {
    assert.equal(cleanMapEmbedUrl(GOOD), GOOD);
    assert.equal(cleanMapEmbedUrl(`  ${GOOD}\n`), GOOD);
    assert.equal(cleanMapEmbedUrl("https://google.com/maps/embed?pb=x"), "https://google.com/maps/embed?pb=x");
  });

  it("網域大小寫不同也認得", () => {
    assert.equal(cleanMapEmbedUrl("HTTPS://WWW.GOOGLE.COM/maps/embed?pb=x"), "HTTPS://WWW.GOOGLE.COM/maps/embed?pb=x");
  });

  it("整段 iframe HTML 會挖出 src，&amp; 還原成 &", () => {
    const html = `<iframe src="${GOOD}&amp;hl=zh-TW" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`;
    assert.equal(cleanMapEmbedUrl(html), `${GOOD}&hl=zh-TW`);
  });

  it("iframe 的 src 用單引號或大寫標籤也挖得到", () => {
    assert.equal(cleanMapEmbedUrl(`<IFRAME SRC='${GOOD}'></IFRAME>`), GOOD);
  });

  it("iframe 裡的 src 不是嵌入網址一樣不收", () => {
    assert.equal(cleanMapEmbedUrl('<iframe src="https://evil.example/"></iframe>'), null);
    assert.equal(cleanMapEmbedUrl("<iframe width=600></iframe>"), null);
  });

  it("分享短網址、place 網址、其他網站、javascript: 都不收", () => {
    assert.equal(cleanMapEmbedUrl("https://maps.app.goo.gl/abc123"), null);
    assert.equal(cleanMapEmbedUrl("https://www.google.com/maps/place/x"), null);
    assert.equal(cleanMapEmbedUrl("https://google.com.evil.com/maps/embed?pb=x"), null);
    assert.equal(cleanMapEmbedUrl("http://www.google.com/maps/embed?pb=x"), null);
    assert.equal(cleanMapEmbedUrl("javascript:alert(1)"), null);
  });

  it("超過長度上限不收，剛好上限收", () => {
    const pad = "x".repeat(MAX_MAP_EMBED_URL_LEN - GOOD.length);
    assert.equal(cleanMapEmbedUrl(GOOD + pad), GOOD + pad);
    assert.equal(cleanMapEmbedUrl(GOOD + pad + "x"), null);
  });
});
