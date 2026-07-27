// 每個 section 的元素級樣式覆寫：欄位表與清洗規則的單一來源。
//
// 為什麼收到這裡：同一份欄位表原本在四個地方各抄一份——公開頁 _theme.ts 的 SectionStyle
// 型別、_theme.ts 讀回時的 sanitize、editor actions.ts 存檔時的 sanitize、editor 自己的
// patch 型別。每個欄位的合法值（"compact" | "default" | "spacious" 這種）在讀、寫兩層各
// 寫成一條手打的 or 判斷，加一個控制就要在兩條長鏈各補一段，而且字串要一字不差。漏在讀
// 那層，商家設好的值存得進 DB 卻讀不回來（畫面完全沒反應）；漏在寫那層，畫面上點得動、
// 自動存檔也顯示已存，重新整理就沒了——兩種都不會報錯，只會「這個控制好像壞的」。
// 兩份手抄清單靠人工對齊，本來就是遲早會漏的結構（專案裡 format-price、store-schema、
// fetch-order-items 都是同一個出發點收掉的）。
//
// 收成這一份之後：欄位與合法值只寫在 SECTION_STYLE_ENUMS，型別由它推出來，讀寫兩層都呼叫
// 同一支 sanitizeSectionStyles。加一個控制＝在這裡加一行，剩下的是編輯器要不要給 UI。
import { normalizeHexColor } from "./hex-color";

// 每個欄位的合法值。第一個值不一定是預設——「沒設定」在這套系統裡是「這個 key 不存在」，
// 不是某個特定值（editor 端把等同預設的選擇 delete 掉，公開頁沒讀到就整條樣式不套）。
export const SECTION_STYLE_ENUMS = {
  headingAlign: ["left", "center", "right"],
  // 該 section 獨立上下空白（覆寫全網站值）
  paddingScale: ["compact", "default", "spacious"],
  // 分隔線（上 / 下 / 上下都有 / 沒有）
  divider: ["none", "top", "bottom", "both"],
  // 該 section 標題字級（small 0.85x / default 1x / large 1.25x）
  headingScale: ["small", "default", "large"],
  // 該 section 最低高度（auto 不限制 / tall 80vh / fullscreen 100vh）
  minHeight: ["auto", "tall", "fullscreen"],
  // 外框（subtle 1px / strong 2px，用 outline 避免跟 divider 的 borderTop/Bottom 打架）
  outline: ["none", "subtle", "strong"],
  // 陰影（soft 淺 / deep 深），讓有 bgColor 的 section 像卡片浮起
  shadow: ["none", "soft", "deep"],
  // 圓角（soft 16px / strong 32px），跟 bgColor + outline + shadow 三件套組成卡片風
  borderRadius: ["none", "soft", "strong"],
  // 進場動畫（fade 淡入 / slide-up 上滑），靠 CSS scroll-driven 觸發，edit mode 內 disable
  entrance: ["none", "fade", "slide-up"],
  // 該 section 字體（default 跟全網站 / serif 思源宋體 / sans 思源黑體），讓某段獨立切字體
  fontFamily: ["default", "serif", "sans"],
  // 字距（tight -0.02em / normal 預設 / wide 0.1em），雜誌大標常見 wide
  letterSpacing: ["tight", "normal", "wide"],
  // 行高（tight 1.4 緊湊 / normal 預設不套 / relaxed 2.0 舒展）
  lineHeight: ["tight", "normal", "relaxed"],
  // 淡化（default 不套 / muted 0.85 / faint 0.7），讓次要 section 變淡襯托主角
  opacity: ["default", "muted", "faint"],
  // 濾鏡（grayscale 黑白 / sepia 復古褐），套整段含 children
  filter: ["none", "grayscale", "sepia"],
  // 寬度（full 滿版預設 / boxed 置中 1100px / narrow 窄欄 760px）
  sectionWidth: ["full", "boxed", "narrow"],
  // 上下外距（none 貼緊相鄰 / normal 64px / large 112px），配 sectionWidth 讓卡片浮出來
  sectionGap: ["none", "normal", "large"],
  // 標題粗細（light 400 常規 / normal 不套維持原樣 / bold 700 粗）。只用思源黑體 / 宋體有
  // 載進來的字重（400 / 700），不挑 300 之類沒載的——瀏覽器會拿常規去假變細，中文筆畫糊掉。
  headingWeight: ["light", "normal", "bold"],
} as const satisfies Record<string, readonly string[]>;

// `-readonly`：欄位表是 as const（整份唯讀），若不脫掉，推出來的型別每一欄都變唯讀，
// 編輯器那邊 `next.sectionGap = ...` / `delete next.opacity` 這種改法會整排編譯不過。
type SectionStyleEnums = {
  -readonly [K in keyof typeof SECTION_STYLE_ENUMS]?: (typeof SECTION_STYLE_ENUMS)[K][number];
};

// 顏色欄位跟上面的選項欄位規則不同（吃任意 hex，且 null 是「明確清掉、回到 theme 預設」
// 這個有意義的狀態，跟「沒設定」不一樣），所以獨立列。
export interface SectionStyle extends SectionStyleEnums {
  bgColor?: string | null; // null = 用 theme.bg；hex = 覆寫
  textColor?: string | null; // null = 用 theme.text；hex = 覆寫（深底配淺字常用）
}

// section key 的長度上限。存檔那層本來就擋（避免有人塞一串垃圾當 key 把 theme jsonb 撐爆），
// 讀那層以前沒擋——同一條線只守一半，改成兩層共用同一個值。
const MAX_SECTION_KEY_LENGTH = 60;

// 清洗單一個 section 的樣式覆寫。認不得的欄位、不在合法值內的值一律丟掉（不是報錯——
// 舊資料、手改過的 jsonb 都可能有殘留，丟掉那一欄比整筆不讓商家存好）。
// 清完一欄都不剩就回 null，呼叫端不留這個 key。
export function sanitizeSectionStyle(raw: unknown): SectionStyle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const entry: Record<string, unknown> = {};

  for (const [field, allowed] of Object.entries(SECTION_STYLE_ENUMS)) {
    const v = obj[field];
    if (typeof v === "string" && (allowed as readonly string[]).includes(v)) {
      entry[field] = v;
    }
  }

  // 顏色：清得出 hex 就用清過的；明確給 null 代表「清掉覆寫」，也要留著（跟「沒設定」
  // 在畫面上同結果，但商家按了重設就該存回去，不能被當沒設定而保留舊值）。
  for (const field of ["bgColor", "textColor"] as const) {
    const hex = normalizeHexColor(obj[field]);
    if (hex) entry[field] = hex;
    else if (obj[field] === null) entry[field] = null;
  }

  // 只要有任何一欄過關就留下這個 section 的覆寫。以前是一長串 entry.X !== undefined 的
  // 手寫 or，每加一個控制就要記得補一項，漏掉那個控制單獨設定時整筆會被丟掉。
  if (Object.keys(entry).length === 0) return null;
  return entry as SectionStyle;
}

// 清洗整份 sectionStyles（key = section id）。公開頁讀回與編輯器存檔走同一支，
// 兩邊對「什麼算合法」的認定不可能再各自漂移。
export function sanitizeSectionStyles(raw: unknown): Record<string, SectionStyle> {
  const result: Record<string, SectionStyle> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k || k.length > MAX_SECTION_KEY_LENGTH) continue;
    const entry = sanitizeSectionStyle(v);
    if (entry) result[k] = entry;
  }
  return result;
}
