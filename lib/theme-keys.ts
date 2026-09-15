// 店面主題兩張「合法值清單」的唯一正本：Hero 四種版型、首頁 11 個 section。
//
// 以前這兩張清單各自手抄了五份：公開頁 _theme.ts 的 type 與 resolveLayout 內的
// validKeys、編輯器 actions.ts 的 HERO_STYLES / SECTION_KEYS、editor-workspace 的
// type 與 SECTION_KEYS_SET 與收 postMessage 那段的 validKeys、設定頁 actions 的
// HERO_STYLES_SET、AI 助手 lib/ai-theme-patch 的兩個 Set。內容目前一致，但日後多一種
// hero 版型或多一個 section 時得五處一起補，漏一處就是「編輯器能選、存檔被濾掉」這種
// 後台看不出來的錯。收成一份，型別也從這裡導出，其他地方只 import。
//
// 放 lib 而不放 _theme.ts：lib 的測試用 node --test 直接跑，不吃 @/ 別名也不能拖進
// _theme.ts 那整包（它 import 了一堆 next 端的東西）；這支零依賴，誰都能 import。

export const HERO_STYLE_KEYS = ["full-image", "split", "minimal", "magazine"] as const;
export type HeroStyle = (typeof HERO_STYLE_KEYS)[number];

export function isHeroStyle(value: unknown): value is HeroStyle {
  return typeof value === "string" && (HERO_STYLE_KEYS as readonly string[]).includes(value);
}

// split 版型的圖放哪一邊。以前 "left" | "right" 這對值也是手抄：公開頁 _theme.ts 的
// type 與 resolveLayout、編輯器與設定頁存檔的 === "right" 三元式、AI 助手 lib/ai-theme-patch
// 的 || 判斷、ai-edit 提示字串裡那行。一樣收成一份。
export const HERO_IMAGE_SIDES = ["left", "right"] as const;
export type HeroImageSide = (typeof HERO_IMAGE_SIDES)[number];

export function isHeroImageSide(value: unknown): value is HeroImageSide {
  return typeof value === "string" && (HERO_IMAGE_SIDES as readonly string[]).includes(value);
}

// 水平對齊三值。Hero 六個對齊欄位（主標／副標／split 照片取景／split 文字欄／minimal 整段／
// 滿版圖文字段）的 type 以前在公開頁 _theme.ts 與編輯器 editor-workspace 各手抄六份，
// 存檔 actions.ts 六段 v === "left" || v === "center" || v === "right" 再各抄一遍。
// 三個值不太會變，但十八份抄本只要哪天多一種對齊（例如 justify）就得全部翻一次。
export const ALIGN_X_KEYS = ["left", "center", "right"] as const;
export type AlignX = (typeof ALIGN_X_KEYS)[number];

export function isAlignX(value: unknown): value is AlignX {
  return typeof value === "string" && (ALIGN_X_KEYS as readonly string[]).includes(value);
}

// 編輯器「靠左 / 置中 / 靠右」三顆按鈕那張 { v, label } 表。split 文字欄、minimal 整段、
// 滿版圖文字段、各區段「內容欄位置」四格以前各自手寫一份一模一樣的陣列，改一格的字
// （例如「靠左」改「貼左」）另外三格不會跟著動，四格是同一個問題（一道欄擺哪邊）的
// 四個位置，字要一樣。順序照 ALIGN_X_KEYS。主標／標題對齊那幾格用的是短字「左 / 置中 / 右」
// 與帶「預設 / 同標題」第四檔的版本，不是這張表。
export const ALIGN_X_OPTIONS = [
  { v: "left", label: "靠左" },
  { v: "center", label: "置中" },
  { v: "right", label: "靠右" },
] as const satisfies ReadonlyArray<{ v: AlignX; label: string }>;

// Hero 文字的三張「三檔」清單：粗細 normal/medium/bold、字距 tight/normal/wide、
// 行距 tight/normal/relaxed。主標／小標／副標／按鈕／byline 五組欄位各自都有這幾格，
// 以前公開頁 _theme.ts 的 type 與 resolveLayout 的 === 三連判斷、編輯器 editor-workspace
// 的 type、存檔 actions.ts 的 === 三連判斷，四個檔加起來抄了四十多處。按鈕粗細多一檔
// "default"（照各版型原本），那格的 type 寫成 "default" | FontWeight，不另開清單。
// section 樣式那套的 letterSpacing / lineHeight 值雖然一樣，正本在 lib/section-style-schema，
// 兩邊各管各的，這裡只管 Hero。
export const FONT_WEIGHT_KEYS = ["normal", "medium", "bold"] as const;
export type FontWeight = (typeof FONT_WEIGHT_KEYS)[number];

export function isFontWeight(value: unknown): value is FontWeight {
  return typeof value === "string" && (FONT_WEIGHT_KEYS as readonly string[]).includes(value);
}

export const TRACKING_KEYS = ["tight", "normal", "wide"] as const;
export type Tracking = (typeof TRACKING_KEYS)[number];

export function isTracking(value: unknown): value is Tracking {
  return typeof value === "string" && (TRACKING_KEYS as readonly string[]).includes(value);
}

// 編輯器「字距」三顆按鈕那張 { v, label } 表。Hero 主標／小標／副標／按鈕／byline 五格，
// 加上區段樣式的內文字距／標題字距兩格，以前七格各自手寫一份一模一樣的陣列，改一格的字
// 另外六格不會跟著動；七格是同一個問題（字擠多開）的七個位置，字要一樣。順序照 TRACKING_KEYS。
// 區段那兩格的型別來自 section-style-schema 自己那張 tight/normal/wide，跟 Tracking 是同一個
// 字面聯集，比照 ALIGN_X_OPTIONS 給 contentAlignX 用的做法。中檔寫「跟預設」的那幾格
// （卡片小字／卡片價錢／區段小標）與粗細那格五處字各不相同（稍重／中黑／中）不是同一張表，不收。
export const TRACKING_OPTIONS = [
  { v: "tight", label: "收緊" },
  { v: "normal", label: "預設" },
  { v: "wide", label: "撐開" },
] as const satisfies ReadonlyArray<{ v: Tracking; label: string }>;

export const LEADING_KEYS = ["tight", "normal", "relaxed"] as const;
export type Leading = (typeof LEADING_KEYS)[number];

export function isLeading(value: unknown): value is Leading {
  return typeof value === "string" && (LEADING_KEYS as readonly string[]).includes(value);
}

// 「行距」三顆按鈕的表，Hero 主標／小標／副標／byline 四格共用，理由同 TRACKING_OPTIONS。
export const LEADING_OPTIONS = [
  { v: "tight", label: "收緊" },
  { v: "normal", label: "預設" },
  { v: "relaxed", label: "舒展" },
] as const satisfies ReadonlyArray<{ v: Leading; label: string }>;

// Hero 小標與 byline 的大小寫三檔：upper（照原本的全大寫）/ capitalize（字首大寫）/
// none（照商家打的）。兩格以前在公開頁 _theme.ts 的 type 與 resolveLayout、編輯器
// editor-workspace 的 type、存檔 actions.ts 的 === 三連判斷各抄一份，共八處。
// 按鈕那格（heroCtaCase）是 default/capitalize/none：預設「照各版型原本」不是「全大寫」
//（滿版圖那兩顆按鈕的 base 本來就沒轉大寫），少的是 upper 這檔不是名字不同，語意不一樣，
// 不併進來。section 樣式那套的 eyebrowCase 值也一樣，正本在 lib/section-style-schema。
export const TEXT_CASE_KEYS = ["upper", "capitalize", "none"] as const;
export type TextCase = (typeof TEXT_CASE_KEYS)[number];

export function isTextCase(value: unknown): value is TextCase {
  return typeof value === "string" && (TEXT_CASE_KEYS as readonly string[]).includes(value);
}

// 風格底五種與字體六種。以前各手抄三份：公開頁 _theme.ts 的 type PresetKey / FontKey、
// resolveTheme 內 `t.preset in PRESETS` 後 as 硬轉、設定頁存檔 actions.ts 自己的兩個 Set；
// 設定頁選單還各有一處 Object.keys(...) as XKey[]。PRESETS / PRESET_LABELS / FONT_LABELS
// 那幾張表留在 _theme.ts（它們帶 CSS 變數與色票，屬於渲染端），型別寫成 Record<PresetKey, …>
// 所以這裡多一個 key 那邊少填會被 tsc 抓到；清單順序就是設定頁選單的顯示順序。
export const PRESET_KEYS = ["editorial", "plant-zen", "nordic", "aesop", "modern"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export function isPresetKey(value: unknown): value is PresetKey {
  return typeof value === "string" && (PRESET_KEYS as readonly string[]).includes(value);
}

export const FONT_KEYS = ["cormorant", "playfair", "inter", "noto", "noto-serif", "lora"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export function isFontKey(value: unknown): value is FontKey {
  return typeof value === "string" && (FONT_KEYS as readonly string[]).includes(value);
}

export const SECTION_KEYS = [
  "hero",
  "collections",
  "featured",
  "journal",
  "promise",
  "testimonials",
  "faq",
  "stats",
  "partners",
  "gallery",
  "visit",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === "string" && (SECTION_KEYS as readonly string[]).includes(value);
}

// 基本必要的 6 個 section：商家存的順序裡沒列到的會自動補在後面；testimonials / faq /
// stats / partners / gallery 這五個是商家在編輯器手動加了才出現，不自動補。
export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "hero",
  "collections",
  "featured",
  "journal",
  "promise",
  "visit",
];
