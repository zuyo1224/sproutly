// 雙擊改字帶 index 的清單卡片欄位：data-edit-field 名稱 → 存在 theme 哪張清單、改那筆的哪個 key。
//
// 為什麼放 lib：編輯器收到 iframe 送來的改字訊息要查這張表知道改進哪張卡；預覽 iframe
// 收到復原／重做的 theme-apply 也要查同一張表，才知道畫面上「好評第 2 張的引言」要從
// theme 哪裡把字撈回來套。以前只有編輯器那邊有這張表，bridge 查不到，清單卡片復原後
// 字就留在原地。兩邊查同一張，之後多一種卡片欄位補一列就好。
//
// 畫面上的 data-edit-index 不一定等於原始清單的第幾筆，各清單規則不同（跟公開頁 render 對齊）：
// - testimonials／stats：畫面第 i 張就是原始第 i 筆（只是 slice 上限）
// - faqItems：公開頁先濾掉空問或空答才畫，畫面第 i 條要用 isValid 數回原始第幾筆
// - gallery／collectionItems：公開頁濾掉沒圖的卡，但 data-edit-index 寫的已經是濾前的原始位置
// - journalCards／collectionItems：沒存過內容時公開頁畫預設整組，index 對的是預設那組
export type InlineLayoutListTextSpec = {
  list: "testimonials" | "faqItems" | "stats" | "gallery";
  key: string;
  isValid?: (item: Record<string, unknown>) => boolean;
};

// 跟公開頁 validFaqItems 同條件：問與答去掉前後空白後都還有字才算一列
export const faqItemValid = (item: Record<string, unknown>) =>
  String(item.question ?? "").trim() !== "" && String(item.answer ?? "").trim() !== "";

export const INLINE_LAYOUT_LIST_TEXT_FIELDS: Readonly<Record<string, InlineLayoutListTextSpec>> = {
  testimonialQuote: { list: "testimonials", key: "quote" },
  testimonialAuthor: { list: "testimonials", key: "author" },
  testimonialRole: { list: "testimonials", key: "role" },
  faqQuestion: { list: "faqItems", key: "question", isValid: faqItemValid },
  faqAnswer: { list: "faqItems", key: "answer", isValid: faqItemValid },
  statValue: { list: "stats", key: "value" },
  statLabel: { list: "stats", key: "label" },
  galleryCaption: { list: "gallery", key: "caption" },
};

export type InlineHomepageCardList = "journalCards" | "collectionItems";
export type InlineHomepageCardTextSpec = {
  list: InlineHomepageCardList;
  key: string;
};

export const INLINE_HOMEPAGE_CARD_TEXT_FIELDS: Readonly<Record<string, InlineHomepageCardTextSpec>> = {
  journalCardEyebrow: { list: "journalCards", key: "eyebrow" },
  journalCardTitle: { list: "journalCards", key: "title" },
  journalCardExcerpt: { list: "journalCards", key: "excerpt" },
  collectionCardTitle: { list: "collectionItems", key: "title" },
  collectionCardSubtitle: { list: "collectionItems", key: "subtitle" },
};

// 表是 Record<string, …>，直接下標 TS 會當一定找得到；用 hasOwn 守一下才會拿到 undefined
export function lookupInlineField<T>(table: Readonly<Record<string, T>>, field: string): T | undefined {
  return Object.hasOwn(table, field) ? table[field] : undefined;
}

// 畫面上的第 idx 條對回清單原始第幾筆；沒有 isValid 就是同一個數字。找不到回 -1。
export function resolveListIndex(
  list: ReadonlyArray<Record<string, unknown>>,
  idx: number,
  isValid?: (item: Record<string, unknown>) => boolean,
): number {
  if (!Number.isInteger(idx) || idx < 0) return -1;
  if (!isValid) return idx < list.length ? idx : -1;
  let seen = -1;
  for (let j = 0; j < list.length; j++) {
    if (isValid(list[j])) {
      seen++;
      if (seen === idx) return j;
    }
  }
  return -1;
}

// 首頁卡片清單沒存過內容時公開頁畫的是預設整組，這裡照同一條規則挑出「畫面上用的那組」
export function resolveHomepageCardBase(
  saved: unknown,
  defaults: ReadonlyArray<Record<string, string>>,
): ReadonlyArray<unknown> {
  return Array.isArray(saved) && saved.length > 0 ? saved : defaults;
}
