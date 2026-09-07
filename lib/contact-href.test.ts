// lib/contact-href.ts 五支 helper 的行為固定測試。
//
// 為什麼要有這份：這五支是「商家後台填的聯絡資料」變成「客人點得動的連結」那條防呆線的口徑來源——
// 頁尾、首頁來訪區段、聯絡頁、Store JSON-LD（telephone / email / sameAs）全靠它們清。
// 電話清錯一個字元，客人手機點了撥不出去，或分機黏進主號撥到別人家；Email 清錯，開信收件人是亂碼；
// 社群連結少補一個 https://，客人點了跑到本店的 404。這裡把每支的邊界（全形字、分機標記、
// 誤貼 mailto:、漏 scheme 的真網址、只剩空白、亂填字）寫死，之後有人改 helper，跑 `npm test`
// 就知道動到哪條線。
//
// 跟 image-url.test.ts 同一套：Node 內建 node:test + node:assert，import 寫 ./contact-href.ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanEmail, mailHref, mapsHref, socialUrl, telDigits, telHref } from "./contact-href.ts";

describe("telHref（撥號連結：只留可撥字元，分機用 ;ext= 另掛）", () => {
  it("沒填、空字串、只有分機沒主號，都退回陽春的 tel:", () => {
    assert.equal(telHref(null), "tel:");
    assert.equal(telHref(undefined), "tel:");
    assert.equal(telHref(""), "tel:");
    assert.equal(telHref("#123"), "tel:");
    assert.equal(telHref("分機 123"), "tel:");
    assert.equal(telHref("問我"), "tel:");
  });

  it("括號、空格、連字號全清掉，只留數字", () => {
    assert.equal(telHref("(02) 1234-5678"), "tel:0212345678");
    assert.equal(telHref("0912 345 678"), "tel:0912345678");
    assert.equal(telHref("02-1234-5678"), "tel:0212345678");
  });

  it("全形數字轉半形", () => {
    assert.equal(telHref("０９１２３４５６７８"), "tel:0912345678");
    assert.equal(telHref("（０２）１２３４－５６７８"), "tel:0212345678");
  });

  it("開頭是國碼 +（半形或全形＋）就補回開頭的 +，不在開頭的 + 不算", () => {
    assert.equal(telHref("+886 2 1234 5678"), "tel:+886212345678");
    assert.equal(telHref("＋886-912-345-678"), "tel:+886912345678");
    assert.equal(telHref("  +886 912 345 678"), "tel:+886912345678");
    assert.equal(telHref("02+1234"), "tel:021234");
  });

  it("分機標記（# ＃ 分機 轉 ext ext.）後面的數字用 ;ext= 掛，不黏進主號", () => {
    assert.equal(telHref("02-1234-5678 #123"), "tel:0212345678;ext=123");
    assert.equal(telHref("02-1234-5678＃123"), "tel:0212345678;ext=123");
    assert.equal(telHref("(02) 1234-5678 分機 123"), "tel:0212345678;ext=123");
    assert.equal(telHref("02-1234-5678 轉 9"), "tel:0212345678;ext=9");
    assert.equal(telHref("02-1234-5678 ext 45"), "tel:0212345678;ext=45");
    assert.equal(telHref("02-1234-5678 Ext. 45"), "tel:0212345678;ext=45");
    assert.equal(telHref("02-1234-5678 extension 7"), "tel:0212345678;ext=7");
  });

  it("有分機標記但後面沒數字，就只掛主號、不留空的 ;ext=", () => {
    assert.equal(telHref("02-1234-5678 #"), "tel:0212345678");
    assert.equal(telHref("02-1234-5678 分機"), "tel:0212345678");
  });

  it("只切第一個分機標記，後面備註裡的字不會再切一次", () => {
    assert.equal(telHref("02-1234-5678 分機 123（請轉客服）"), "tel:0212345678;ext=123");
  });
});

describe("telDigits（結構化資料 telephone：乾淨主號，分機丟掉）", () => {
  it("沒填或沒有主號數字回空字串", () => {
    assert.equal(telDigits(null), "");
    assert.equal(telDigits(undefined), "");
    assert.equal(telDigits(""), "");
    assert.equal(telDigits("#123"), "");
    assert.equal(telDigits("問我"), "");
  });

  it("主號清法跟 telHref 同一套，分機不進主號也不另掛", () => {
    assert.equal(telDigits("(02) 1234-5678 #123"), "0212345678");
    assert.equal(telDigits("+886 2 1234 5678 分機 9"), "+886212345678");
    assert.equal(telDigits("０９１２ ３４５ ６７８"), "0912345678");
  });

  it("沒分機時 telHref 就是 tel: 接 telDigits，兩邊不會各清一套", () => {
    for (const raw of ["(02) 1234-5678", "+886 912-345-678", "０９１２３４５６７８"]) {
      assert.equal(telHref(raw), `tel:${telDigits(raw)}`);
    }
  });
});

describe("cleanEmail（寫信連結與結構化資料共用的乾淨位址）", () => {
  it("沒填、空白、只有 mailto: 都回空字串", () => {
    assert.equal(cleanEmail(null), "");
    assert.equal(cleanEmail(undefined), "");
    assert.equal(cleanEmail(""), "");
    assert.equal(cleanEmail("   "), "");
    assert.equal(cleanEmail("mailto:"), "");
  });

  it("去前後空白、內部空白、全形空白", () => {
    assert.equal(cleanEmail("  abc@x.com  "), "abc@x.com");
    assert.equal(cleanEmail("abc @ x.com"), "abc@x.com");
    assert.equal(cleanEmail("　abc@x.com　"), "abc@x.com");
  });

  it("全形英數與 ＠ ． 轉半形（不改大小寫）", () => {
    assert.equal(cleanEmail("ＡＢＣ＠ｘ．ｃｏｍ"), "ABC@x.com");
    assert.equal(cleanEmail("abc＠example.com"), "abc@example.com");
  });

  it("誤貼的開頭 mailto:（大小寫不分）去掉", () => {
    assert.equal(cleanEmail("mailto:abc@x.com"), "abc@x.com");
    assert.equal(cleanEmail("MAILTO:abc@x.com"), "abc@x.com");
    assert.equal(cleanEmail("  mailto:abc@x.com  "), "abc@x.com");
  });

  it("清完不像 email（沒 @、@ 兩邊有空、網域沒點、兩個 @、誤貼電話、亂填字）就回空字串", () => {
    assert.equal(cleanEmail("問我"), "");
    assert.equal(cleanEmail("0912345678"), "");
    assert.equal(cleanEmail("abc@x"), "");
    assert.equal(cleanEmail("@x.com"), "");
    assert.equal(cleanEmail("abc@"), "");
    assert.equal(cleanEmail("a@b@c.com"), "");
    assert.equal(cleanEmail("abc.x.com"), "");
  });
});

describe("mailHref（寫信連結：位址走 cleanEmail，subject / body 各自 encode）", () => {
  it("沒有乾淨位址就退回陽春 mailto:，就算有 subject 也不掛", () => {
    assert.equal(mailHref(null), "mailto:");
    assert.equal(mailHref("問我"), "mailto:");
    assert.equal(mailHref("   ", { subject: "hi" }), "mailto:");
  });

  it("只有位址就只有 mailto:位址，不多一個問號", () => {
    assert.equal(mailHref("abc@x.com"), "mailto:abc@x.com");
    assert.equal(mailHref("mailto:abc@x.com"), "mailto:abc@x.com");
    assert.equal(mailHref("abc@x.com", {}), "mailto:abc@x.com");
    assert.equal(mailHref("abc@x.com", { subject: "", body: "" }), "mailto:abc@x.com");
  });

  it("subject 與 body 用 encodeURIComponent，# 與中文不會原樣進 href", () => {
    const href = mailHref("abc@x.com", { subject: "訂單 #123" });
    assert.equal(href, `mailto:abc@x.com?subject=${encodeURIComponent("訂單 #123")}`);
    assert.ok(href.includes("%23"));
    assert.ok(!href.includes("#"));
    assert.ok(!href.includes("訂單"));
  });

  it("subject 與 body 同時給時用 & 串、subject 在前；只有 body 也能掛", () => {
    assert.equal(
      mailHref("abc@x.com", { subject: "a b", body: "c&d" }),
      "mailto:abc@x.com?subject=a%20b&body=c%26d",
    );
    assert.equal(mailHref("abc@x.com", { body: "c" }), "mailto:abc@x.com?body=c");
  });
});

describe("socialUrl（頁尾社群連結與 sameAs：只在確定指到對方社群時才給網址）", () => {
  it("沒填、只剩空白回 null", () => {
    assert.equal(socialUrl(null), null);
    assert.equal(socialUrl(undefined), null);
    assert.equal(socialUrl(""), null);
    assert.equal(socialUrl("   "), null);
  });

  it("http(s):// 開頭的絕對網址去前後空白後原樣用（大小寫不拘）", () => {
    assert.equal(socialUrl("https://www.instagram.com/foo"), "https://www.instagram.com/foo");
    assert.equal(socialUrl("  https://x.com/foo  "), "https://x.com/foo");
    assert.equal(socialUrl("HTTP://x.com/foo"), "HTTP://x.com/foo");
  });

  it("漏了 https:// 的真網址（有字母 TLD、可帶路徑）補回 https://", () => {
    assert.equal(socialUrl("instagram.com/foo"), "https://instagram.com/foo");
    assert.equal(socialUrl("www.facebook.com/foo.bar"), "https://www.facebook.com/foo.bar");
    assert.equal(socialUrl("line.me/ti/p/@abc123"), "https://line.me/ti/p/@abc123");
    assert.equal(socialUrl("instagram.com"), "https://instagram.com");
    assert.equal(socialUrl("  instagram.com/foo  "), "https://instagram.com/foo");
  });

  it("純帳號、@帳號、亂填字、電話形狀、路徑含空白、其他 scheme 都回 null", () => {
    assert.equal(socialUrl("myshop"), null);
    assert.equal(socialUrl("@myshop"), null);
    assert.equal(socialUrl("問我"), null);
    assert.equal(socialUrl("0912.345.678"), null);
    assert.equal(socialUrl("instagram.com/foo bar"), null);
    assert.equal(socialUrl("ftp://x.com/foo"), null);
    assert.equal(socialUrl("x.c"), null);
  });
});

describe("mapsHref（地圖搜尋連結：只負責 href，地址先 trim）", () => {
  it("沒填、只剩空白回 null", () => {
    assert.equal(mapsHref(null), null);
    assert.equal(mapsHref(undefined), null);
    assert.equal(mapsHref(""), null);
    assert.equal(mapsHref("   "), null);
  });

  it("有字才組 Google Maps 搜尋連結，query 用 encodeURIComponent", () => {
    assert.equal(
      mapsHref("台北市大安區"),
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("台北市大安區")}`,
    );
  });

  it("前後空白先 trim 掉，不會進 query；& 這種會弄壞 query 的字元有 encode", () => {
    const href = mapsHref("  台北市  ")!;
    assert.ok(href.endsWith(`query=${encodeURIComponent("台北市")}`));
    assert.ok(!href.includes("%20"));

    const amp = mapsHref("1 號 & 2 號")!;
    assert.ok(amp.includes("%26"));
    assert.equal(amp.split("&").length, 2);
  });
});
