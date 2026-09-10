import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BUSINESS_HOURS_LEN,
  MAX_COLLECTIONS_INTRO_LEN,
  MAX_COLLECTION_SUBTITLE_LEN,
  MAX_COLLECTION_TITLE_LEN,
  MAX_FAQ_TEXT_LEN,
  MAX_HERO_EYEBROW_LEN,
  MAX_HERO_SUBTITLE_LEN,
  MAX_PROMISE_LEN,
  MAX_SOCIAL_URL_LEN,
  MAX_STORE_ADDRESS_LEN,
  MAX_STORE_DESC_LEN,
  MAX_STORE_EMAIL_LEN,
  MAX_STORE_NAME_LEN,
  MAX_STORE_PHONE_LEN,
  MAX_THEME_TAGLINE_LEN,
  MAX_VISIT_TITLE_LEN,
  storeTextLimitError,
  storeThemeTextLimitError,
} from "./store-limits.ts";

// 這支是開店頁、店面設定頁兩張表單（瀏覽器端 maxLength）跟三支 Server Action
// （createStore／updateStore／視覺編輯器 save）共用的單一來源。改壞了不會噴錯：
// 數字被動到就變成「瀏覽器讓你打得下、伺服器把整份設定退回來」，或反過來瀏覽器擋在
// 前面、伺服器那層形同虛設；判斷順序或 null 的處理被動到，會變成商家留白的欄位被
// 當成超長而存不進去。所以把數字、邊界、順序、空值四件事全部寫死在這裡。

const rep = (n: number) => "字".repeat(n);

describe("字數上限的數字", () => {
  it("店家基本資料五欄", () => {
    // 這五個數字同時是兩張表單 input 的 maxLength，改一個就要一起改表單。
    assert.equal(MAX_STORE_NAME_LEN, 60);
    assert.equal(MAX_STORE_DESC_LEN, 2000);
    assert.equal(MAX_STORE_PHONE_LEN, 40);
    assert.equal(MAX_STORE_EMAIL_LEN, 254); // RFC 5321 的信箱長度上限
    assert.equal(MAX_STORE_ADDRESS_LEN, 200);
  });

  it("theme 文案欄位", () => {
    assert.equal(MAX_THEME_TAGLINE_LEN, 500);
    assert.equal(MAX_HERO_EYEBROW_LEN, 200);
    assert.equal(MAX_HERO_SUBTITLE_LEN, 1000);
    assert.equal(MAX_COLLECTIONS_INTRO_LEN, 500);
    assert.equal(MAX_COLLECTION_TITLE_LEN, 60);
    assert.equal(MAX_COLLECTION_SUBTITLE_LEN, 80);
    assert.equal(MAX_PROMISE_LEN, 2000);
    assert.equal(MAX_VISIT_TITLE_LEN, 100);
    assert.equal(MAX_BUSINESS_HOURS_LEN, 2000);
    assert.equal(MAX_FAQ_TEXT_LEN, 5000);
    assert.equal(MAX_SOCIAL_URL_LEN, 500);
  });

  it("每個上限都是正整數（表單 maxLength 吃到小數或 0 會直接壞掉）", () => {
    const all = [
      MAX_STORE_NAME_LEN, MAX_STORE_DESC_LEN, MAX_STORE_PHONE_LEN,
      MAX_STORE_EMAIL_LEN, MAX_STORE_ADDRESS_LEN, MAX_THEME_TAGLINE_LEN,
      MAX_HERO_EYEBROW_LEN, MAX_HERO_SUBTITLE_LEN, MAX_COLLECTIONS_INTRO_LEN,
      MAX_COLLECTION_TITLE_LEN, MAX_COLLECTION_SUBTITLE_LEN, MAX_PROMISE_LEN,
      MAX_VISIT_TITLE_LEN, MAX_BUSINESS_HOURS_LEN, MAX_FAQ_TEXT_LEN,
      MAX_SOCIAL_URL_LEN,
    ];
    for (const n of all) {
      assert.ok(Number.isInteger(n) && n > 0, `${n} 不是正整數`);
    }
  });

  it("店名跟提案卡標題同 60 字、Promise 跟店介紹同 2000 字（刻意對齊視覺編輯器）", () => {
    assert.equal(MAX_STORE_NAME_LEN, MAX_COLLECTION_TITLE_LEN);
    assert.equal(MAX_PROMISE_LEN, MAX_STORE_DESC_LEN);
  });
});

const okStore: Parameters<typeof storeTextLimitError>[0] = {
  name: "植物市集",
  description: null,
  contact_phone: null,
  contact_email: null,
  address: null,
};

describe("storeTextLimitError", () => {
  it("全部合格回 null", () => {
    assert.equal(storeTextLimitError(okStore), null);
  });

  it("四個可空欄位都是 null 也算合格（商家可以只填店名）", () => {
    assert.equal(storeTextLimitError({ ...okStore, name: "店" }), null);
  });

  it("空字串跟 null 一樣不檢查", () => {
    assert.equal(
      storeTextLimitError({
        ...okStore,
        description: "",
        contact_phone: "",
        contact_email: "",
        address: "",
      }),
      null
    );
  });

  it("剛好等於上限放行、多一個字擋下（邊界在 > 不是 >=）", () => {
    for (const [field, max] of [
      ["name", MAX_STORE_NAME_LEN],
      ["description", MAX_STORE_DESC_LEN],
      ["contact_phone", MAX_STORE_PHONE_LEN],
      ["contact_email", MAX_STORE_EMAIL_LEN],
      ["address", MAX_STORE_ADDRESS_LEN],
    ] as const) {
      assert.equal(
        storeTextLimitError({ ...okStore, [field]: rep(max) }),
        null,
        `${field} 剛好 ${max} 字應該放行`
      );
      assert.equal(
        typeof storeTextLimitError({ ...okStore, [field]: rep(max + 1) }),
        "string",
        `${field} ${max + 1} 字應該擋下`
      );
    }
  });

  it("每欄的訊息講的是那一欄，並且帶上數字", () => {
    assert.equal(
      storeTextLimitError({ ...okStore, name: rep(61) }),
      "店名最多 60 個字，長一點的介紹放到店介紹欄"
    );
    assert.equal(
      storeTextLimitError({ ...okStore, description: rep(2001) }),
      "店介紹最多 2,000 個字" // 四位數要有千分位，跟畫面上寫的一致
    );
    assert.equal(
      storeTextLimitError({ ...okStore, contact_phone: rep(41) }),
      "聯絡電話最多 40 個字"
    );
    assert.equal(
      storeTextLimitError({ ...okStore, contact_email: rep(255) }),
      "聯絡信箱最多 254 個字"
    );
    assert.equal(
      storeTextLimitError({ ...okStore, address: rep(201) }),
      "地址最多 200 個字"
    );
  });

  it("多欄同時超長時回第一個：由上往下照表單欄位順序", () => {
    assert.match(
      storeTextLimitError({
        name: rep(999),
        description: rep(9999),
        contact_phone: rep(999),
        contact_email: rep(999),
        address: rep(999),
      }) ?? "",
      /^店名/
    );
    assert.match(
      storeTextLimitError({ ...okStore, description: rep(9999), address: rep(999) }) ?? "",
      /^店介紹/
    );
  });

  it("空店名不歸這裡管（必填的訊息在呼叫端）", () => {
    assert.equal(storeTextLimitError({ ...okStore, name: "" }), null);
  });
});

const okTheme: Parameters<typeof storeThemeTextLimitError>[0] = {
  tagline: null,
  heroEyebrow: null,
  heroSubtitle: null,
  collectionsIntro: null,
  collectionItems: [],
  promise: null,
  visitTitle: null,
  businessHours: "",
  faq: "",
  social: { instagram: null, facebook: null, line: null },
};

describe("storeThemeTextLimitError", () => {
  it("整份留白算合格（這些欄位商家都可以不填）", () => {
    assert.equal(storeThemeTextLimitError(okTheme), null);
  });

  it("剛好等於上限放行、多一個字擋下", () => {
    for (const [field, max] of [
      ["tagline", MAX_THEME_TAGLINE_LEN],
      ["heroEyebrow", MAX_HERO_EYEBROW_LEN],
      ["heroSubtitle", MAX_HERO_SUBTITLE_LEN],
      ["collectionsIntro", MAX_COLLECTIONS_INTRO_LEN],
      ["promise", MAX_PROMISE_LEN],
      ["visitTitle", MAX_VISIT_TITLE_LEN],
      ["businessHours", MAX_BUSINESS_HOURS_LEN],
      ["faq", MAX_FAQ_TEXT_LEN],
    ] as const) {
      assert.equal(
        storeThemeTextLimitError({ ...okTheme, [field]: rep(max) }),
        null,
        `${field} 剛好 ${max} 字應該放行`
      );
      assert.equal(
        typeof storeThemeTextLimitError({ ...okTheme, [field]: rep(max + 1) }),
        "string",
        `${field} ${max + 1} 字應該擋下`
      );
    }
  });

  it("每欄的訊息講的是那一欄", () => {
    const msg = (patch: Partial<typeof okTheme>) =>
      storeThemeTextLimitError({ ...okTheme, ...patch });
    assert.equal(msg({ tagline: rep(501) }), "底部標語最多 500 個字");
    assert.equal(msg({ heroEyebrow: rep(201) }), "Hero 小標最多 200 個字");
    assert.equal(msg({ heroSubtitle: rep(1001) }), "Hero 副標最多 1,000 個字");
    assert.equal(msg({ collectionsIntro: rep(501) }), "選物提案中標最多 500 個字");
    assert.equal(msg({ promise: rep(2001) }), "Promise 承諾文字最多 2,000 個字");
    assert.equal(msg({ visitTitle: rep(101) }), "來店標題最多 100 個字");
    assert.equal(msg({ businessHours: rep(2001) }), "營業時間最多 2,000 個字");
    assert.equal(msg({ faq: rep(5001) }), "常見問題最多 5,000 個字");
  });

  it("營業時間與常見問題是空字串也放行（不是必填）", () => {
    assert.equal(storeThemeTextLimitError({ ...okTheme, businessHours: "", faq: "" }), null);
  });

  it("提案卡：標題 60、副標 80，每一張都會被看過", () => {
    const card = (title: string, subtitle: string) => ({ title, subtitle });
    assert.equal(
      storeThemeTextLimitError({
        ...okTheme,
        collectionItems: [card(rep(60), rep(80)), card("好", "好")],
      }),
      null
    );
    assert.equal(
      storeThemeTextLimitError({
        ...okTheme,
        collectionItems: [card("好", "好"), card(rep(61), "好")],
      }),
      "提案卡標題最多 60 個字"
    );
    assert.equal(
      storeThemeTextLimitError({
        ...okTheme,
        collectionItems: [card("好", "好"), card("好", rep(81))],
      }),
      "提案卡副標最多 80 個字"
    );
  });

  it("同一張卡標題與副標都超長時先講標題", () => {
    assert.equal(
      storeThemeTextLimitError({
        ...okTheme,
        collectionItems: [{ title: rep(61), subtitle: rep(81) }],
      }),
      "提案卡標題最多 60 個字"
    );
  });

  it("三個社群連結各自 500 字，訊息帶得出是哪一個", () => {
    const social = (patch: Partial<typeof okTheme.social>) =>
      storeThemeTextLimitError({ ...okTheme, social: { ...okTheme.social, ...patch } });
    assert.equal(social({ instagram: rep(500) }), null);
    assert.equal(social({ instagram: rep(501) }), "Instagram 連結最多 500 個字");
    assert.equal(social({ facebook: rep(501) }), "Facebook 連結最多 500 個字");
    assert.equal(social({ line: rep(501) }), "LINE 連結最多 500 個字");
    assert.equal(social({ facebook: rep(501), line: rep(501) }), "Facebook 連結最多 500 個字");
  });

  it("多欄同時超長時回第一個：底部標語排在提案卡與社群之前", () => {
    assert.equal(
      storeThemeTextLimitError({
        ...okTheme,
        tagline: rep(501),
        collectionItems: [{ title: rep(61), subtitle: rep(81) }],
        social: { instagram: rep(501), facebook: null, line: null },
      }),
      "底部標語最多 500 個字"
    );
  });

  it("提案卡排在 Promise 之前、社群排在最後", () => {
    assert.equal(
      storeThemeTextLimitError({
        ...okTheme,
        collectionItems: [{ title: rep(61), subtitle: "好" }],
        promise: rep(2001),
      }),
      "提案卡標題最多 60 個字"
    );
    assert.equal(
      storeThemeTextLimitError({
        ...okTheme,
        faq: rep(5001),
        social: { instagram: rep(501), facebook: null, line: null },
      }),
      "常見問題最多 5,000 個字"
    );
  });
});
