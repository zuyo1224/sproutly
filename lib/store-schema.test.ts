// lib/store-schema.ts 五支 helper 的行為固定測試。
//
// 為什麼要有這份：這五支是「餵給 Google 的店家結構化資料」整條線的口徑來源——首頁與
// 聯絡頁的 Store、四頁的 BreadcrumbList、首頁與關於頁的 FAQPage、商品頁 offer 的 seller
// @id 全靠它們組。每個欄位背後各接一支防呆 helper（displayableImageUrl、telDigits、
// cleanEmail、socialUrl、parseBusinessHoursToSpec），哪一條接錯或漏接（例如 image 又走回
// 放行 http:// 的那支、空白描述沒 trim 就吐出去、sameAs 塞了 null），Google 收到的就是
// 壞值，整段 rich result 一起失效，而頁面上看不出來。這裡把「清不出有效值就整欄省略、
// 絕不送空值」這條態度逐欄寫死，之後有人改 builder 或改底下的 helper，跑 `npm test`
// 就知道動到哪條線。
//
// 同 image-url.test.ts 那套：Node 內建 node:test + node:assert，不裝框架，import 寫 .ts。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  siteBaseUrl,
  storeSchemaId,
  buildStoreJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "./store-schema.ts";

const BASE = "https://shop.example";
const SLUG = "plantae";

// 只給必填欄位的最小輸入；各條測試在這上面疊自己要驗的欄位。
function minimal(extra: Partial<Parameters<typeof buildStoreJsonLd>[0]> = {}) {
  return buildStoreJsonLd({ baseUrl: BASE, slug: SLUG, name: "植物市場", ...extra });
}

describe("siteBaseUrl（網站基底網址：環境變數優先、去尾斜線、沒設走預設）", () => {
  it("沒設 NEXT_PUBLIC_SITE_URL 時回 sproutly-drab 預設值", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      assert.equal(siteBaseUrl(), "https://sproutly-drab.vercel.app");
    } finally {
      if (prev !== undefined) process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it("有設就用它，尾端一個斜線會被去掉（否則組出來的網址是 //slug）", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://sproutly.com.tw/";
    try {
      assert.equal(siteBaseUrl(), "https://sproutly.com.tw");
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });
});

describe("storeSchemaId（店家 @id：所有頁面指同一個字串）", () => {
  it("格式固定是 base/slug#store", () => {
    assert.equal(storeSchemaId(BASE, SLUG), "https://shop.example/plantae#store");
  });

  it("buildStoreJsonLd 的 @id 跟 storeSchemaId 完全一致（商品頁 seller 靠這條對上）", () => {
    assert.equal(minimal()["@id"], storeSchemaId(BASE, SLUG));
  });
});

describe("buildStoreJsonLd：必填骨架", () => {
  it("只給必填欄位時，只有 @context／@type／@id／name／url 五個 key，沒有任何空欄位", () => {
    const out = minimal();
    assert.deepEqual(out, {
      "@context": "https://schema.org",
      "@type": "Store",
      "@id": "https://shop.example/plantae#store",
      name: "植物市場",
      url: "https://shop.example/plantae",
    });
  });

  it("所有選填欄位給 null／undefined／空白時，輸出跟只給必填完全一樣（不吐空值）", () => {
    const out = minimal({
      description: "   ",
      heroUrl: null,
      logoUrl: undefined,
      phone: " ",
      email: "",
      address: "\n  \n",
      socialLinks: [null, undefined, "", "   "],
      businessHoursText: "",
    });
    assert.deepEqual(out, minimal());
  });
});

describe("buildStoreJsonLd：description／address 先 trim，只有空白就整欄省略", () => {
  it("description 前後空白會被去掉、中間內容保留", () => {
    const out = minimal({ description: "  台北的小盆栽店\n" });
    assert.equal(out.description, "台北的小盆栽店");
  });

  it("address 有字才組 PostalAddress，且 addressCountry 固定 TW", () => {
    const out = minimal({ address: " 台北市大安區某某路 1 號 " });
    assert.deepEqual(out.address, {
      "@type": "PostalAddress",
      streetAddress: "台北市大安區某某路 1 號",
      addressCountry: "TW",
    });
  });

  it("address 只有空白時沒有 address 這個 key（不是空的 PostalAddress）", () => {
    assert.equal("address" in minimal({ address: "   " }), false);
  });
});

describe("buildStoreJsonLd：image／logo 走 displayableImageUrl 口徑", () => {
  it("https:// 完整網址原樣放、前後空白去掉", () => {
    const out = minimal({
      heroUrl: "  https://cdn.example/hero.jpg ",
      logoUrl: "https://cdn.example/logo.png",
    });
    assert.equal(out.image, "https://cdn.example/hero.jpg");
    assert.equal(out.logo, "https://cdn.example/logo.png");
  });

  it("http://、相對路徑、// 開頭、data: 都不放，且 key 不存在（不是 undefined／null）", () => {
    for (const bad of [
      "http://cdn.example/hero.jpg",
      "/hero.jpg",
      "//cdn.example/hero.jpg",
      "data:image/png;base64,AAAA",
      "hero.jpg",
    ]) {
      const out = minimal({ heroUrl: bad, logoUrl: bad });
      assert.equal("image" in out, false, `image should be omitted for ${bad}`);
      assert.equal("logo" in out, false, `logo should be omitted for ${bad}`);
    }
  });

  it("image 與 logo 各自獨立判斷：hero 判不過不會拿 logo 頂替（那是 og:image 的規則，不是 Store 的）", () => {
    const out = minimal({ heroUrl: "http://cdn.example/hero.jpg", logoUrl: "https://cdn.example/logo.png" });
    assert.equal("image" in out, false);
    assert.equal(out.logo, "https://cdn.example/logo.png");
  });
});

describe("buildStoreJsonLd：telephone／email 跟頁面撥號／寫信連結同一份清理", () => {
  it("telephone 只留數字、丟掉括號空白與分機", () => {
    assert.equal(minimal({ phone: "(02) 2345-6789 分機12" }).telephone, "0223456789");
  });

  it("開頭國碼 + 保留", () => {
    assert.equal(minimal({ phone: "+886 2 2345 6789" }).telephone, "+886223456789");
  });

  it("email 去前後空白、大小寫不動", () => {
    assert.equal(minimal({ email: " Hi@Shop.TW " }).email, "Hi@Shop.TW");
  });

  it("不像 email 的形狀整欄省略", () => {
    assert.equal("email" in minimal({ email: "not an email" }), false);
  });
});

describe("buildStoreJsonLd：sameAs 只收 socialUrl 清得出的絕對網址", () => {
  it("絕對網址原樣、漏 scheme 的真網域補 https://、順序照輸入", () => {
    const out = minimal({
      socialLinks: ["https://www.facebook.com/plantae", "instagram.com/plantae"],
    });
    assert.deepEqual(out.sameAs, [
      "https://www.facebook.com/plantae",
      "https://instagram.com/plantae",
    ]);
  });

  it("純帳號、@帳號、null 都被濾掉，不會混進 null 或空字串", () => {
    const out = minimal({
      socialLinks: ["@plantae", "plantae", null, "https://line.me/R/ti/p/@plantae"],
    });
    assert.deepEqual(out.sameAs, ["https://line.me/R/ti/p/@plantae"]);
  });

  it("全部清不出來就沒有 sameAs 這個 key（不是空陣列）", () => {
    assert.equal("sameAs" in minimal({ socialLinks: ["@plantae", "plantae"] }), false);
  });
});

describe("buildStoreJsonLd：openingHoursSpecification 只在判讀得出時放", () => {
  it("「週一至週五 10:00-18:00」轉成一筆 OpeningHoursSpecification", () => {
    const out = minimal({ businessHoursText: "週一至週五 10:00-18:00" });
    assert.deepEqual(out.openingHoursSpecification, [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "10:00",
        closes: "18:00",
      },
    ]);
  });

  it("判讀不出星期／時間的自由文字整欄省略（頁面照樣顯示原文，那不是這支的事）", () => {
    assert.equal("openingHoursSpecification" in minimal({ businessHoursText: "隨時歡迎" }), false);
    assert.equal("openingHoursSpecification" in minimal({ businessHoursText: null }), false);
  });
});

describe("buildBreadcrumbJsonLd（麵包屑：店根永遠 position 1，後面照 trail 遞增）", () => {
  it("trail 空時只有店根一層", () => {
    const out = buildBreadcrumbJsonLd({ baseUrl: BASE, slug: SLUG, storeName: "植物市場", trail: [] });
    assert.deepEqual(out, {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "植物市場", item: "https://shop.example/plantae" },
      ],
    });
  });

  it("多層 trail 的 position 從 2 起連號，item 是店根接子路徑（含多段路徑）", () => {
    const out = buildBreadcrumbJsonLd({
      baseUrl: BASE,
      slug: SLUG,
      storeName: "植物市場",
      trail: [
        { name: "逛街", path: "shop" },
        { name: "龜背芋", path: "products/abc" },
      ],
    });
    const items = out.itemListElement as { position: number; name: string; item: string }[];
    assert.deepEqual(
      items.map((i) => [i.position, i.name, i.item]),
      [
        [1, "植物市場", "https://shop.example/plantae"],
        [2, "逛街", "https://shop.example/plantae/shop"],
        [3, "龜背芋", "https://shop.example/plantae/products/abc"],
      ],
    );
  });
});

describe("buildFaqJsonLd（FAQPage：濾空、trim，一筆有效都不剩回 null）", () => {
  it("問答前後空白去掉，組成 Question + acceptedAnswer/Answer", () => {
    const out = buildFaqJsonLd([{ question: " 怎麼澆水？ ", answer: "\n一週一次\n" }]);
    assert.deepEqual(out, {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "怎麼澆水？",
          acceptedAnswer: { "@type": "Answer", text: "一週一次" },
        },
      ],
    });
  });

  it("空問或空答（含只有空白）的那筆被濾掉，其餘保留原順序", () => {
    const out = buildFaqJsonLd([
      { question: "", answer: "有答沒問" },
      { question: "有問沒答", answer: "   " },
      { question: "第一題", answer: "答一" },
      { question: "第二題", answer: "答二" },
    ]);
    const names = (out!.mainEntity as { name: string }[]).map((q) => q.name);
    assert.deepEqual(names, ["第一題", "第二題"]);
  });

  it("空陣列或全被濾光回 null（呼叫端 if (faqJsonLd) 直接略過，不丟空 FAQPage）", () => {
    assert.equal(buildFaqJsonLd([]), null);
    assert.equal(buildFaqJsonLd([{ question: " ", answer: " " }]), null);
  });
});
