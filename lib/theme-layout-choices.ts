// 店面版面「只認清單內的值」的 44 個選項欄位：合法值清單＋讀回時的預設值，唯一正本。
//
// 以前這批清單抄了兩份：編輯器存檔 actions.ts 一張 LAYOUT_ONE_OF 表（只有清單），公開頁
// _theme.ts resolveLayout 每格一段 IIFE（清單少寫預設那個值、再 return 預設）。兩邊各管各的，
// 多一個值時漏在存檔端是「編輯器能選、存檔被濾掉」，漏在讀回端是「存進去了、店面照預設畫」，
// 兩種後台都看不出來。收成一張表，存檔端只看 values、讀回端 values 之外一律回 fallback。
//
// 型別也從這裡導出：_theme.ts 的 layout type 每格仍寫死自己的 union，所以這張表哪格多值少值
// tsc 會直接在 resolveLayout 那行報錯，不用另外對。
//
// 副標對齊與按鈕字重多一個「跟著主標／照版型預設」的選項，所以拿 theme-keys 的共用清單前面
// 補一個再展開；按鈕大小寫是 default/capitalize/none，跟 TEXT_CASE_KEYS（upper 開頭）語意不同，
// 照原樣寫死（理由見 theme-keys.ts）。
//
// 放 lib 而不放 _theme.ts：lib 的測試用 node --test 直接跑，不能拖進 _theme.ts 那整包。
import { ALIGN_X_KEYS, FONT_WEIGHT_KEYS } from "./theme-keys.ts";

export const LAYOUT_CHOICES = {
  heroHeight: { values: ["auto", "short", "tall", "full"], fallback: "auto" },
  heroHeightMobile: { values: ["same", "auto", "short", "tall", "full"], fallback: "same" },
  heroFullTextAlignY: { values: ["top", "center", "bottom"], fallback: "top" },
  heroSubtitleAlign: { values: ["inherit", ...ALIGN_X_KEYS], fallback: "inherit" },
  heroCtaCase: { values: ["default", "capitalize", "none"], fallback: "default" },
  heroCtaWeight: { values: ["default", ...FONT_WEIGHT_KEYS], fallback: "default" },
  heroSplitRatio: { values: ["image-narrow", "normal", "image-wide", "photo"], fallback: "normal" },
  heroImageFocus: { values: ["top", "center", "bottom"], fallback: "center" },
  heroSplitImageFit: { values: ["cover", "contain"], fallback: "cover" },
  heroSplitImageAspect: { values: ["tall", "square", "wide", "photo"], fallback: "square" },
  heroSplitTextAlign: { values: ["top", "center", "bottom"], fallback: "center" },
  heroSplitMobileOrder: { values: ["image-first", "text-first"], fallback: "image-first" },
  heroSplitDivider: { values: ["none", "thin", "medium", "thick"], fallback: "none" },
  heroSplitDividerTone: { values: ["normal", "strong", "accent"], fallback: "normal" },
  heroSplitHeight: { values: ["content", "compact", "normal"], fallback: "normal" },
  heroSplitTextPadding: { values: ["tight", "normal", "roomy"], fallback: "normal" },
  heroSplitMobilePadY: { values: ["tight", "normal", "roomy"], fallback: "normal" },
  heroSplitGap: { values: ["tight", "normal", "loose"], fallback: "normal" },
  heroMagazineRuleWeight: { values: ["normal", "medium", "thick"], fallback: "normal" },
  heroMagazineRuleTone: { values: ["normal", "faint", "strong", "accent"], fallback: "normal" },
  heroMagazineGap: { values: ["tight", "medium", "normal"], fallback: "normal" },
  heroMagazineGapMobile: { values: ["same", "tight", "medium", "normal"], fallback: "same" },
  heroMagazineTextWidth: { values: ["narrow", "normal", "rule", "full"], fallback: "normal" },
  heroMagazineRuleWidth: { values: ["narrow", "normal", "full"], fallback: "normal" },
  heroMagazineTextGap: { values: ["tight", "normal", "loose"], fallback: "normal" },
  heroMagazinePadX: { values: ["narrow", "normal", "wide"], fallback: "normal" },
  heroMagazinePadY: { values: ["tight", "normal", "roomy"], fallback: "normal" },
  heroMagazineSubtitleWidth: { values: ["narrow", "normal", "wide", "title"], fallback: "normal" },
  heroMinimalWidth: { values: ["narrow", "normal", "wide"], fallback: "normal" },
  heroMinimalPadding: { values: ["compact", "normal", "spacious"], fallback: "normal" },
  heroMinimalPaddingMobile: { values: ["same", "compact", "normal", "spacious"], fallback: "same" },
  heroMinimalPadX: { values: ["narrow", "normal", "wide"], fallback: "normal" },
  heroMinimalPadXMobile: { values: ["same", "narrow", "normal", "wide"], fallback: "same" },
  heroMinimalRule: { values: ["none", "short", "normal", "long"], fallback: "normal" },
  heroMinimalRuleWeight: { values: ["normal", "medium", "thick"], fallback: "normal" },
  heroMinimalGap: { values: ["tight", "normal", "loose"], fallback: "normal" },
  heroTextPadding: { values: ["compact", "normal", "spacious"], fallback: "normal" },
  heroTextWidth: { values: ["narrow", "normal", "wide", "full"], fallback: "normal" },
  heroTextGap: { values: ["tight", "normal", "loose"], fallback: "normal" },
  heroImageMaxHeight: { values: ["none", "screen", "short"], fallback: "none" },
  heroFullImageFit: { values: ["cover", "contain"], fallback: "cover" },
  sectionPaddingScale: { values: ["compact", "default", "spacious"], fallback: "default" },
  buttonRadius: { values: ["pill", "soft", "square"], fallback: "pill" },
  faqDefaultOpen: { values: ["none", "first", "all"], fallback: "none" },
} as const satisfies Record<string, { values: readonly string[]; fallback: string }>;

export type LayoutChoiceKey = keyof typeof LAYOUT_CHOICES;
export type LayoutChoice<K extends LayoutChoiceKey> =
  (typeof LAYOUT_CHOICES)[K]["values"][number];

export const LAYOUT_CHOICE_KEYS = Object.keys(LAYOUT_CHOICES) as LayoutChoiceKey[];

export function isLayoutChoice<K extends LayoutChoiceKey>(
  key: K,
  value: unknown
): value is LayoutChoice<K> {
  return (
    typeof value === "string" &&
    (LAYOUT_CHOICES[key].values as readonly string[]).includes(value)
  );
}

// 讀回端用：清單內的值原樣回、其他（沒填、舊資料、壞值）一律回該格預設。
export function pickLayoutChoice<K extends LayoutChoiceKey>(
  key: K,
  value: unknown
): LayoutChoice<K> {
  return isLayoutChoice(key, value) ? value : LAYOUT_CHOICES[key].fallback;
}

// 編輯器 Hero 各版型面板裡「中檔寫『跟預設』」的三顆按鈕表，四張各對一種 x/normal/y 的欄位：
// - HERO_GAP_OPTIONS（緊／跟預設／鬆，tight/normal/loose）：split／magazine／minimal／滿版圖
//   「這段字裡面的行距」四格（heroSplitGap／heroMagazineTextGap／heroMinimalGap／heroTextGap）
// - HERO_PAD_X_OPTIONS（窄／跟預設／寬，narrow/normal/wide）：magazine 離螢幕邊、minimal 文字欄寬／
//   離螢幕邊／手機離螢幕邊四格（heroMagazinePadX／heroMinimalWidth／heroMinimalPadX／heroMinimalPadXMobile）
// - HERO_PAD_Y_OPTIONS（少／跟預設／多，compact/normal/spacious）：minimal 上下留白／手機上下留白、
//   滿版圖文字段上下留白三格（heroMinimalPadding／heroMinimalPaddingMobile／heroTextPadding）
// - HERO_SPLIT_PAD_OPTIONS（窄／跟預設／寬，tight/normal/roomy）：split 文字欄左右留白／手機上下留白兩格
//   （heroSplitTextPadding／heroSplitMobilePadY）
// 以前十三格各自在 editor-workspace.tsx 手寫一份逐字相同的 { v, label } 陣列，改一格的字另外幾格
// 不會跟著動。兩格手機版多一顆「跟桌機一樣」（same）擺最前面，面板那邊把 same 補在表前面再展開，
// 比照上面 LAYOUT_CHOICES 給 heroSubtitleAlign 補 inherit 的做法。放這裡不放 theme-keys：這批欄位的
// 合法值正本是 LAYOUT_CHOICES，v 的型別直接從那張表對應的格子拿，表多一個值 tsc 會在這裡報。
// 不收的：magazine 上下留白（heroMagazinePadY）值是 tight/normal/roomy 但按鈕字是「少／多」不是
// 「窄／寬」、split 的圖文比例／高度與 magazine 的文字寬／橫線寬帶第四檔，各只有一格，不是同一張表。
export const HERO_GAP_OPTIONS = [
  { v: "tight", label: "緊" },
  { v: "normal", label: "跟預設" },
  { v: "loose", label: "鬆" },
] as const satisfies ReadonlyArray<{ v: LayoutChoice<"heroSplitGap">; label: string }>;

export const HERO_PAD_X_OPTIONS = [
  { v: "narrow", label: "窄" },
  { v: "normal", label: "跟預設" },
  { v: "wide", label: "寬" },
] as const satisfies ReadonlyArray<{ v: LayoutChoice<"heroMagazinePadX">; label: string }>;

export const HERO_PAD_Y_OPTIONS = [
  { v: "compact", label: "少" },
  { v: "normal", label: "跟預設" },
  { v: "spacious", label: "多" },
] as const satisfies ReadonlyArray<{ v: LayoutChoice<"heroMinimalPadding">; label: string }>;

export const HERO_SPLIT_PAD_OPTIONS = [
  { v: "tight", label: "窄" },
  { v: "normal", label: "跟預設" },
  { v: "roomy", label: "寬" },
] as const satisfies ReadonlyArray<{ v: LayoutChoice<"heroSplitTextPadding">; label: string }>;

// 「排成幾欄」六格是上面那張表的數字版：值是 2/3/4 不是字串，所以另開一張，
// 型別守衛與 pick 的規則跟上面完全一樣。慢讀固定三張卡，4 欄永遠填不滿，只開 2/3。
export const LAYOUT_COLUMN_CHOICES = {
  featuredColumns: { values: [2, 3, 4], fallback: 3 },
  collectionsColumns: { values: [2, 3, 4], fallback: 3 },
  testimonialsColumns: { values: [2, 3, 4], fallback: 3 },
  statsColumns: { values: [2, 3, 4], fallback: 4 },
  galleryColumns: { values: [2, 3, 4], fallback: 3 },
  journalColumns: { values: [2, 3], fallback: 3 },
} as const satisfies Record<string, { values: readonly number[]; fallback: number }>;

export type LayoutColumnKey = keyof typeof LAYOUT_COLUMN_CHOICES;
export type LayoutColumns<K extends LayoutColumnKey> =
  (typeof LAYOUT_COLUMN_CHOICES)[K]["values"][number];

export const LAYOUT_COLUMN_KEYS = Object.keys(LAYOUT_COLUMN_CHOICES) as LayoutColumnKey[];

export function isLayoutColumns<K extends LayoutColumnKey>(
  key: K,
  value: unknown
): value is LayoutColumns<K> {
  return (
    typeof value === "number" &&
    (LAYOUT_COLUMN_CHOICES[key].values as readonly number[]).includes(value)
  );
}

export function pickLayoutColumns<K extends LayoutColumnKey>(
  key: K,
  value: unknown
): LayoutColumns<K> {
  return isLayoutColumns(key, value) ? value : LAYOUT_COLUMN_CHOICES[key].fallback;
}
