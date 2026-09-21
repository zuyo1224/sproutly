// lib/social-links.ts 的固定測試。
//
// 為什麼要有這份：設定頁輸入框、存檔端、公開頁讀回三處都改吃這張表，「存檔去空白、空字串收
// null」跟「讀回只收非空字串」這兩條寫死在這裡，表多一格或改欄位名這裡先知道。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SOCIAL_LINKS, readSocialLinks, resolveSocialLinks, socialLinkValues } from "./social-links.ts";

describe("SOCIAL_LINKS", () => {
  it("三格、key 與表單欄位名各不重複、欄位名照 social_<key> 命名、placeholder 都是 https://", () => {
    assert.equal(SOCIAL_LINKS.length, 3);
    assert.equal(new Set(SOCIAL_LINKS.map((s) => s.key)).size, 3);
    assert.equal(new Set(SOCIAL_LINKS.map((s) => s.formName)).size, 3);
    for (const s of SOCIAL_LINKS) {
      assert.equal(s.formName, `social_${s.key}`);
      assert.ok(s.placeholder.startsWith("https://"));
      assert.ok(s.label.length > 0);
      // 短名是頁尾顯示字跟超限訊息用的，得跟輸入框標籤同一個牌子名開頭（LINE OA → LINE）
      assert.ok(s.shortLabel.length > 0);
      assert.ok(s.label.startsWith(s.shortLabel));
    }
  });
});

describe("readSocialLinks", () => {
  it("去頭尾空白；沒帶、空字串、純空白都收成 null", () => {
    const fd = new FormData();
    fd.set("social_instagram", "  https://www.instagram.com/foo ");
    fd.set("social_facebook", "   ");
    assert.deepEqual(readSocialLinks(fd), {
      instagram: "https://www.instagram.com/foo",
      facebook: null,
      line: null,
    });
  });
});

describe("socialLinkValues", () => {
  it("照表順序 Instagram → Facebook → LINE 攤成陣列，null 原樣保留不清洗", () => {
    assert.deepEqual(
      socialLinkValues({ line: "line.me/@x", instagram: null, facebook: "https://fb.com/y" }),
      [null, "https://fb.com/y", "line.me/@x"],
    );
  });
});

describe("resolveSocialLinks", () => {
  it("空物件三格都 null", () => {
    assert.deepEqual(resolveSocialLinks({}), { instagram: null, facebook: null, line: null });
  });

  it("只收非空字串；空字串與其他型別當沒填", () => {
    assert.deepEqual(
      resolveSocialLinks({ instagram: "instagram.com/foo", facebook: "", line: 123 }),
      { instagram: "instagram.com/foo", facebook: null, line: null },
    );
    assert.equal(resolveSocialLinks({ line: null }).line, null);
    assert.equal(resolveSocialLinks({ line: { url: "x" } }).line, null);
  });
});
