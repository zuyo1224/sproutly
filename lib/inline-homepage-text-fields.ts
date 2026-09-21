// 預覽 iframe 雙擊改字（sproutly-edit-text-update）能直接套進 theme.homepage 的 36 格字串欄位：
// 名稱跟公開頁 data-edit-field 一字不差，就是 homepage 底下所有 string 型別的 key
// （清單類 collectionItems／journalCards 另走帶 index 的分支，表在 inline-list-text-fields）。
//
// 為什麼放 lib：以前這張表只在編輯器（editor-workspace）裡，公開頁的 data-edit-field 屬性
// 跟這張表各寫各的，對不對得上只能靠人工 grep 比對；搬到 lib 之後測試可以直接把公開頁
// 原始碼裡的 data-edit-field 全集撈出來跟三張表對帳（見 inline-homepage-text-fields.test.ts），
// 公開頁多掛一格沒補表、或表多一格公開頁沒掛，跑測試就會抓到，不用等到雙擊沒反應才發現。
//
// lib 看不到 EditorTheme，「表裡每個名字都真的是 homepage 的字串欄位」這件事由
// editor-workspace 收訊那行 `const field: InlineHomepageTextField = msg.field` 讓 tsc 守。
export const INLINE_HOMEPAGE_TEXT_FIELDS = [
  "promise",
  "promiseEyebrow",
  "featuredTitle",
  "featuredEyebrow",
  "featuredCta",
  "collectionsIntro",
  "collectionsEyebrow",
  "visitTitle",
  "visitEyebrow",
  "journalEyebrow",
  "journalTitle",
  "journalSubtitle",
  "testimonialsEyebrow",
  "testimonialsTitle",
  "faqEyebrow",
  "faqTitle",
  "galleryEyebrow",
  "galleryTitle",
  "partnersEyebrow",
  "statsEyebrow",
  "statsTitle",
  "heroCta",
  "heroSecondaryCta",
  "heroMagazineByline",
  "collectionsCardCta",
  "aboutEyebrow",
  "aboutTitle",
  "contactEyebrow",
  "contactTitle",
  "shopEyebrow",
  "shopTitle",
  "footerWordsLabel",
  "footerFollowLabel",
  "footerTrackLabel",
  "footerVisitLabel",
  "journalCardLabel",
] as const;

export type InlineHomepageTextField = (typeof INLINE_HOMEPAGE_TEXT_FIELDS)[number];

const INLINE_HOMEPAGE_TEXT_FIELD_SET: ReadonlySet<string> = new Set(INLINE_HOMEPAGE_TEXT_FIELDS);
export function isInlineHomepageTextField(field: string): field is InlineHomepageTextField {
  return INLINE_HOMEPAGE_TEXT_FIELD_SET.has(field);
}

// 不在 homepage 底下、也不帶 index 的三格：主標讀 theme.tagline，副標／小標讀 theme.layout
export const INLINE_TOP_LEVEL_TEXT_FIELDS = ["tagline", "heroEyebrow", "heroSubtitle"] as const;
