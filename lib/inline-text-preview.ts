// 編輯器復原／重做時，預覽 iframe 要把 theme 裡的文字套回畫面上的哪一格、套成什麼樣。
//
// 為什麼要有這份：公開頁每格文字都掛 data-edit-field，雙擊改字後字留在畫面上，商家按
// 復原時 theme 退回去了，但預覽只靠 postMessage theme-apply 補畫、不重新整理——以前
// bridge 只套 tagline 一格，其他格（副標、小標、各區段標題⋯）復原後字不會退回去，看
// 起來像復原沒作用。這裡把「哪格讀 theme 哪裡、沒填時顯示什麼、要不要拆行」集中一處，
// 規則跟公開頁 render 對齊：
// - tagline：theme.tagline，按全形標點拆行（同 splitByPunc）
// - heroEyebrow／heroSubtitle：theme.layout 底下，沒填公開頁就不畫這格，套成空字串
// - 其他：theme.homepage 底下同名的字串欄位，沒填就用 HOMEPAGE_DEFAULTS 同名那格；
//   collectionsIntro 按全形標點拆行、promise 按換行拆行，其餘整串當一行
//
// 帶 data-edit-index 的清單卡片欄位（好評、FAQ、數字、相簿、慢讀卡、選物卡）走下面的
// resolveInlineListTextPreview，名稱丟進 resolveInlineTextPreview 不在 homepage 底下會回 null。
import { isPlainObject } from "./is-plain-object.ts";
import { splitByPunc } from "./split-by-punc.ts";
import {
  INLINE_HOMEPAGE_CARD_TEXT_FIELDS,
  INLINE_LAYOUT_LIST_TEXT_FIELDS,
  lookupInlineField,
  resolveHomepageCardBase,
  resolveListIndex,
  type InlineHomepageCardList,
} from "./inline-list-text-fields.ts";

export type InlineTextPreview =
  | { kind: "text"; value: string }
  | { kind: "lines"; lines: string[] }
  // FAQ 答案：公開頁按換行切成多個 <p>（不去空白、不丟空段），跟 lines 的畫法不同
  | { kind: "paragraphs"; paragraphs: string[] };

const PUNC_LINE_FIELDS: ReadonlySet<string> = new Set(["tagline", "collectionsIntro"]);
const NEWLINE_LINE_FIELDS: ReadonlySet<string> = new Set(["promise"]);
const LAYOUT_TEXT_FIELDS: ReadonlySet<string> = new Set(["heroEyebrow", "heroSubtitle"]);

// 跟公開頁 promiseLines 同一套：按換行切、去頭尾空白、丟空行
function splitByNewline(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function resolveInlineTextPreview(
  theme: unknown,
  field: string,
  homepageDefaults: Readonly<Record<string, string | null>>,
): InlineTextPreview | null {
  if (!isPlainObject(theme)) return null;

  let raw: unknown;
  let fallback = "";
  if (field === "tagline") {
    raw = theme.tagline;
    // 主標沒填時公開頁的預設句寫死在 page.tsx，這裡拿不到；不是字串就跳過不動
    if (typeof raw !== "string") return null;
  } else if (LAYOUT_TEXT_FIELDS.has(field)) {
    raw = isPlainObject(theme.layout) ? theme.layout[field] : undefined;
  } else {
    const homepage = theme.homepage;
    if (!isPlainObject(homepage) || !Object.hasOwn(homepage, field)) return null;
    raw = homepage[field];
    const def = Object.hasOwn(homepageDefaults, field) ? homepageDefaults[field] : null;
    if (typeof def === "string") fallback = def;
  }
  // 是字串就用，null／undefined 當沒填；其他型別（清單、布林）不是文字格，跳過
  if (raw !== null && raw !== undefined && typeof raw !== "string") return null;
  const value = typeof raw === "string" && raw !== "" ? raw : fallback;

  if (PUNC_LINE_FIELDS.has(field)) return { kind: "lines", lines: splitByPunc(value) };
  if (NEWLINE_LINE_FIELDS.has(field)) return { kind: "lines", lines: splitByNewline(value) };
  return { kind: "text", value };
}

// 清單卡片欄位：畫面上「好評第 idx 張的引言」這一格，去 theme 找那筆的那個 key。
// 規則跟公開頁 render 對齊：
// - layout 清單（好評、FAQ、數字、相簿）：畫面 index 對回原始第幾筆（FAQ 要跳過空問空答）
// - homepage 卡片（慢讀卡、選物卡）：沒存過內容時用預設整組，index 直接對那組
// - 值不是字串（沒填）套成空字串：公開頁那格沒字時本來就不畫（好評身份、相簿圖說）
// - faqAnswer 按換行切段，其餘整串一行
// 對不到那筆（清單比畫面短、theme 形狀不對）回 null，畫面那格不動。
export function resolveInlineListTextPreview(
  theme: unknown,
  field: string,
  index: number,
  cardDefaults: Readonly<Record<InlineHomepageCardList, ReadonlyArray<Record<string, string>>>>,
): InlineTextPreview | null {
  if (!isPlainObject(theme)) return null;

  let item: unknown;
  let key: string;
  const listSpec = lookupInlineField(INLINE_LAYOUT_LIST_TEXT_FIELDS, field);
  const cardSpec = lookupInlineField(INLINE_HOMEPAGE_CARD_TEXT_FIELDS, field);
  if (listSpec) {
    const layout = theme.layout;
    const list = isPlainObject(layout) ? layout[listSpec.list] : undefined;
    if (!Array.isArray(list)) return null;
    const rows = list.filter(isPlainObject);
    if (rows.length !== list.length) return null;
    const real = resolveListIndex(rows, index, listSpec.isValid);
    if (real < 0) return null;
    item = rows[real];
    key = listSpec.key;
  } else if (cardSpec) {
    const homepage = theme.homepage;
    const base = resolveHomepageCardBase(
      isPlainObject(homepage) ? homepage[cardSpec.list] : undefined,
      cardDefaults[cardSpec.list],
    );
    if (!Number.isInteger(index) || index < 0 || index >= base.length) return null;
    item = base[index];
    key = cardSpec.key;
  } else {
    return null;
  }

  if (!isPlainObject(item)) return null;
  const raw = item[key];
  const value = typeof raw === "string" ? raw : "";
  if (field === "faqAnswer") return { kind: "paragraphs", paragraphs: value.split(/\n+/) };
  return { kind: "text", value };
}
