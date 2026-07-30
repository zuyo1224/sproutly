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
  // 內文對齊（auto 跟著上面那條區段對齊走 / left 靠左 / center 置中 / right 靠右）。
  // headingAlign 設的是整段容器的 text-align，段落是繼承來的，所以標題與內文一直只能同進退；
  // 報紙與雜誌最常見的「標題置中、內文靠左」在 Sproutly 做不出來。這一欄只管內文元素。
  bodyAlign: ["auto", "left", "center", "right"],
  // 內文一行字數（auto 不限制 / normal 約 34 字 / narrow 約 24 字）。滿版區段的長段落一行
  // 會拉到整個螢幕寬，眼睛換行時找不到下一行的行首，讀起來一直在跳行；報紙與雜誌都是把
  // 內文收成窄欄解這件事。限制的是段落自己的寬度，不是整段區段（sectionWidth 收的是整段，
  // 連標題、卡片、照片一起變窄，做不出「標題滿版、內文窄欄」）。
  bodyMeasure: ["auto", "normal", "narrow"],
  // 內文字級（default 不套 / small 縮小一成 / large 放大一成多）。標題已經有 headingScale
  // 可以各段獨立調大小，內文一直只能跟著全網站走：長描述在手機上偏小、想讓某一段的短文
  // 當引言放大也做不到，商家唯一的辦法是把整段的字體設定改掉、連標題一起變。
  // 這一欄只縮放內文自己，而且是等比縮放——同一段裡描述、圖說、引言原本的大小差距照原樣
  // 保留，不會被壓成同一級（見 layout.tsx 那條規則裡為什麼不能用 font-size 的說明）。
  bodyScale: ["small", "default", "large"],
  // 內文濃淡（default 不套 / muted 更淡 / strong 跟標題同深）。描述、說明、圖說這類次要文字
  // 一律用比標題淡的那個顏色（--store-text-muted，約七成濃度）——那是排版上的層級設計，
  // 但同一個濃度不是每間店都讀得動：淺灰底配淺灰字、或客人年紀偏大時，商品描述整段是糊的。
  // 商家原本能動的只有兩個極端：「文字顏色」把整段（含標題）一起換掉，或「淡化」把整段
  // 連照片一起變透明——沒有一個只調次要文字的。這一欄補的就是那一格。
  bodyTone: ["muted", "default", "strong"],
  // 標題用色（default 跟整段文字色 / accent 全站主色 / muted 跟次要文字同深淺）。
  // 區段裡用主色畫的一直只有配件——小標 eyebrow、標題底下那截短線、常見問題的＋——標題
  // 本身固定用文字色，商家想讓某一段的標題帶品牌色（最常見的「標題用主色、內文用黑」），
  // 唯一動得到標題顏色的是「文字顏色」，但那欄換的是整段：內文、圖說全部跟著變，等於
  // 做不到。這一欄只動標題；muted 給想讓標題退後一步、把重量讓給照片的段落（相簿、合作）。
  headingTone: ["default", "accent", "muted"],
  // 該 section 獨立上下空白（覆寫全網站值）
  paddingScale: ["compact", "default", "spacious"],
  // 分隔線（上 / 下 / 上下都有 / 沒有）
  divider: ["none", "top", "bottom", "both"],
  // 該 section 標題字級（small 0.85x / default 1x / large 1.25x）
  headingScale: ["small", "default", "large"],
  // 該 section 最低高度（auto 不限制 / tall 80vh / fullscreen 100vh）
  minHeight: ["auto", "tall", "fullscreen"],
  // 內容垂直位置（top 靠上 / middle 置中 / bottom 靠下）。只有在這一段比內容高的時候才看得出
  // 差別，也就是設了上面那條「最低高度」之後——原本撐出來的空高一律留在內容下面，商家選了
  // 滿屏是想要一整螢幕的段落，拿到的是一小塊內容黏在上緣、下面一大片空白。
  contentAlign: ["top", "middle", "bottom"],
  // 這一段在哪台裝置不顯示（none 都顯示 / mobile 手機不顯示 / desktop 桌機不顯示）。
  // 同一份內容在手機與桌機不會一樣好看：橫排的合作 logo、6 張一列的照片牆在手機上會擠成
  // 一長條，商家只能整段關掉（那條開關是全站的，桌機也跟著沒了）；反過來手機專用的「直接
  // 打電話」那類段落在桌機上是多餘的。原本沒有「只在某台裝置不顯示」這一格。
  // 平板一律顯示：只有一欄，選了「手機不顯示」還要決定平板算不算手機，切在中間最好解釋
  // ——手機是 640 以下、桌機是 1024 以上，中間那段兩邊都不碰。
  hideOn: ["none", "mobile", "desktop"],
  // 照片圓角（soft 14px / round 28px），只套這一段裡的照片，不動段落自己的框。
  // 站上的照片一律是接近直角的（商品卡的圖框固定 4px），這是全站寫死的一個值：
  // 商家把某一段設成圓角卡片（bgColor + borderRadius + shadow 那三件套）之後，段落的四角
  // 圓了、裡面的照片還是方的，兩個圓角對不起來反而更像沒做完；反過來想讓某一段的照片
  // 柔一點（人像、生活情境照），現有的「圓角」那欄動的是整段的外框，照片一點都不會變。
  mediaRadius: ["none", "soft", "round"],
  // 卡片間距（tight 收緊 / loose 放寬），只套這一段排成格子的卡片與照片之間的距離。
  // 商品卡、照片牆、合作 logo 的間距是每段寫死的一組值：商家把欄數調成 4 之後卡片黏在
  // 一起、或想把照片牆做成緊貼的拼貼、把精選商品攤成鬆一點的畫廊感，全都沒有一格動得到
  // ——動得到間距的只有「區段空白」跟「上下外距」，那兩欄調的是段落外圍，卡片彼此之間
  // 一動也不動。收緊 / 放寬蓋掉該段自己的那組值，不跟原值等比（CSS 蓋不掉又乘不了）。
  gridGap: ["tight", "normal", "loose"],
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
  // 濾鏡（grayscale 黑白 / sepia 復古褐），只套這段裡的照片，文字與配色不動
  filter: ["none", "grayscale", "sepia"],
  // 寬度（full 滿版預設 / boxed 置中 1100px / narrow 窄欄 760px）
  sectionWidth: ["full", "boxed", "narrow"],
  // 上下外距（none 貼緊相鄰 / normal 64px / large 112px），配 sectionWidth 讓卡片浮出來
  sectionGap: ["none", "normal", "large"],
  // 標題粗細（light 400 常規 / normal 不套維持原樣 / bold 700 粗）。只用思源黑體 / 宋體有
  // 載進來的字重（400 / 700），不挑 300 之類沒載的——瀏覽器會拿常規去假變細，中文筆畫糊掉。
  headingWeight: ["light", "normal", "bold"],
  // 底紋（grid 細格線 / dots 點陣 / lines 斜紋），純 CSS gradient 疊在底色上，不吃圖檔。
  // 線的顏色走 currentColor，所以深底淺字的 section 換成淺色紋、不用另外設一組顏色。
  texture: ["none", "grid", "dots", "lines"],
  // 底色明暗變化（top 上緣加重 / bottom 下緣加重 / vignette 四周暈影），跟底紋同樣走
  // currentColor：淺底深字的段落疊出來是變暗，深底淺字的段落疊出來是提亮，不用另挑顏色。
  bgGradient: ["none", "top", "bottom", "vignette"],
  // 標題底線（short 短線 / full 整條），畫在該段 h2 底下。顏色跟外框、分隔線同一個口徑
  // （自訂文字色算出來的淡色），所以深底淺字的段落自動變成淺色線、不用另挑一次顏色。
  headingRule: ["none", "short", "full"],
  // 側邊色條（left 左緣 / right 右緣），畫在該段的左或右邊緣，4px 粗。分隔線佔的是
  // borderTop/Bottom、外框走 outline，三者不互相蓋。顏色比照外框與分隔線：該段設了
  // 文字色就從它算（深底淺字自動變淺色條），沒設就用全站主色 accent。
  accentBar: ["none", "left", "right"],
} as const satisfies Record<string, readonly string[]>;

// 每一欄「等同沒設定」的那個值。editor 端商家選到它就把整欄 delete 掉（少一欄存進 DB，
// 也讓「有沒有自訂」這件事只看 key 在不在）。沒列在這裡的欄位（headingAlign / paddingScale
// / headingScale / minHeight）沒有這種值，只有明確按重設才清掉。
export const SECTION_STYLE_NEUTRAL_VALUES = {
  bodyAlign: "auto",
  bodyMeasure: "auto",
  bodyScale: "default",
  bodyTone: "default",
  headingTone: "default",
  contentAlign: "top",
  hideOn: "none",
  divider: "none",
  mediaRadius: "none",
  gridGap: "normal",
  outline: "none",
  shadow: "none",
  borderRadius: "none",
  entrance: "none",
  fontFamily: "default",
  letterSpacing: "normal",
  lineHeight: "normal",
  opacity: "default",
  filter: "none",
  sectionWidth: "full",
  sectionGap: "none",
  headingWeight: "normal",
  texture: "none",
  bgGradient: "none",
  headingRule: "none",
  accentBar: "none",
} as const satisfies Partial<{
  [K in keyof typeof SECTION_STYLE_ENUMS]: (typeof SECTION_STYLE_ENUMS)[K][number];
}>;

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

// 編輯器改某一段樣式時送的 patch：沒提到的欄位不動，給合法值就設，給 null 就清掉這一欄。
export type SectionStylePatch = Partial<{
  [K in keyof typeof SECTION_STYLE_ENUMS]: (typeof SECTION_STYLE_ENUMS)[K][number] | null;
}> & {
  bgColor?: string | null;
  textColor?: string | null;
};

// 把 patch 疊到現有樣式上，回一份新的（不改原物件——編輯器的 undo history 靠每步一份新值）。
// 選到「等同沒設定」的那個值（見 SECTION_STYLE_NEUTRAL_VALUES）跟給 null 一樣清掉整欄。
// 顏色兩欄照舊：null 是「清掉覆寫回 theme 預設」這個有意義的狀態，要留著存回去。
export function applySectionStylePatch(
  current: SectionStyle,
  patch: SectionStylePatch
): SectionStyle {
  const next: SectionStyle = { ...current };
  const neutral = SECTION_STYLE_NEUTRAL_VALUES as Partial<Record<string, string>>;

  for (const field of Object.keys(SECTION_STYLE_ENUMS) as (keyof typeof SECTION_STYLE_ENUMS)[]) {
    const v = patch[field];
    if (v === undefined) continue;
    if (v === null || v === neutral[field]) delete next[field];
    else (next as Record<string, unknown>)[field] = v;
  }

  if (patch.bgColor !== undefined) next.bgColor = patch.bgColor;
  if (patch.textColor !== undefined) next.textColor = patch.textColor;
  return next;
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
