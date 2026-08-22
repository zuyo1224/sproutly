// 公開店面主題系統：4 個 preset + 商家可微調主色 / 強調色 / 字體 / Logo / Hero / Section 開關 / 社群連結 / 標語

import {
  clampHeroZoom,
  clampHeroFontScale,
  clampFontScale,
  clampFeaturedCount,
  clampFreePos,
} from "@/lib/theme-scale";
import { normalizeHexColor } from "@/lib/hex-color";
import {
  sanitizeSectionStyles,
  type SectionStyle,
} from "@/lib/section-style-schema";

export type PresetKey = "editorial" | "plant-zen" | "nordic" | "aesop" | "modern";

// Hero 4 種 layout variants - 對應 Wix 拖拉編輯器內常見 hero 模板
export type HeroStyle =
  | "full-image"      // 全屏圖 + tagline overlay（既有預設）
  | "split"           // 左圖右文 / 右圖左文 50:50
  | "minimal"         // 純文字 hero，無圖，大字 tagline + 副標
  | "magazine";       // 雜誌封面風：上方 metadata、中間大字、下方 byline
export const HERO_STYLES: { key: HeroStyle; label: string; description: string }[] = [
  { key: "full-image", label: "全屏沉浸", description: "整屏背景圖 + 文字 overlay，最有沉浸感" },
  { key: "split", label: "左右分割", description: "左圖右文（或右圖左文），編輯雜誌風" },
  { key: "minimal", label: "極簡文字", description: "純文字大字 hero，無圖，最少干擾" },
  { key: "magazine", label: "雜誌封面", description: "上 metadata + 中央大字 + 下 byline" },
];

// Section 排序（商家可調順序，部分 section 也可隱藏）
export type SectionKey =
  | "hero"
  | "collections"
  | "featured"
  | "journal"
  | "promise"
  | "testimonials"
  | "faq"
  | "stats"
  | "partners"
  | "gallery"
  | "visit";
export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "hero",
  "collections",
  "featured",
  "journal",
  "promise",
  "visit",
];
export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Hero（首屏）",
  collections: "選物提案",
  featured: "本月選物",
  journal: "Journal（慢讀）",
  promise: "Our Promise",
  testimonials: "顧客評語",
  faq: "常見問題（FAQ）",
  stats: "數字 / 成就",
  partners: "合作夥伴 / 媒體",
  gallery: "圖片相簿",
  visit: "來訪資訊",
};

// 可從 block library 新增的 section types（用戶能加 / 移除）
export const OPTIONAL_BLOCK_TYPES: { key: SectionKey; label: string; description: string }[] = [
  {
    key: "testimonials",
    label: "顧客評語",
    description: "3 個 quote card 顯示真實顧客評價",
  },
  {
    key: "faq",
    label: "常見問題",
    description: "Accordion 展開式問答，每筆 click 展開",
  },
  {
    key: "stats",
    label: "數字 / 成就",
    description: "4 個大數字 +  label，展示成立年數、植物種數、客人數等",
  },
  {
    key: "partners",
    label: "合作夥伴 / 媒體",
    description: "6 個 logo 灰階展示，被誰報導 / 跟誰合作",
  },
  {
    key: "gallery",
    label: "圖片相簿",
    description: "3 欄圖片網格 + caption，店面 / 商品情境照",
  },
];

export interface Testimonial {
  quote: string;
  author: string;
  role: string | null;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface StatItem {
  value: string;       // "2019" / "250+" / "1500"
  label: string;       // "成立年份" / "植物種數" / "客人累計"
}

export interface PartnerItem {
  name: string;
  logoUrl: string;
  href: string | null;
}

export interface GalleryItem {
  url: string;
  caption: string | null;
}
export type FontKey =
  | "cormorant"
  | "playfair"
  | "inter"
  | "noto"
  | "noto-serif"
  | "lora";

// 單一個 section 的元素級樣式覆寫。欄位表與合法值的單一來源在 lib/section-style-schema，
// 讀回（這裡）與存檔（editor actions）走同一支 sanitize，型別也由同一份欄位表推出來。
// 這裡照舊 re-export，公開頁與編輯器現有的 import 路徑不變。
export type { SectionStyle };

export interface StoreTheme {
  preset: PresetKey;
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  font: FontKey;
  logoUrl: string | null;
  heroUrl: string | null;
  sections: {
    about: boolean;
    contact: boolean;
    hours: boolean;
    faq: boolean;
    social: boolean;
  };
  social: {
    instagram: string | null;
    facebook: string | null;
    line: string | null;
  };
  tagline: string | null;
  collections: Record<string, string>;
  homepage: {
    collectionsIntro: string | null;
    collectionsEyebrow: string | null;
    collectionItems: Array<{ key: string; title: string; subtitle: string }>;
    promise: string | null;
    promiseEyebrow: string | null;
    featuredTitle: string | null;
    featuredEyebrow: string | null;
    featuredCta: string | null;
    visitTitle: string | null;
    visitEyebrow: string | null;
    journalEyebrow: string | null;
    journalTitle: string | null;
    journalSubtitle: string | null;
    journalCardLabel: string | null;
    journalCards: Array<{ eyebrow: string; title: string; excerpt: string }>;
    testimonialsEyebrow: string | null;
    testimonialsTitle: string | null;
    faqEyebrow: string | null;
    faqTitle: string | null;
    galleryEyebrow: string | null;
    galleryTitle: string | null;
    partnersEyebrow: string | null;
    statsEyebrow: string | null;
    statsTitle: string | null;
    heroCta: string | null;
    heroSecondaryCta: string | null;
    heroMagazineByline: string | null;
    collectionsCardCta: string | null;
    aboutEyebrow: string | null;
    aboutTitle: string | null;
    contactEyebrow: string | null;
    contactTitle: string | null;
    shopEyebrow: string | null;
    shopTitle: string | null;
    footerWordsLabel: string | null;   // 頁尾 tagline 上方小標（預設 Words）
    footerFollowLabel: string | null;  // 頁尾社群區小標（預設 Follow）
    footerTrackLabel: string | null;   // 頁尾訂單追蹤連結文字（預設 Track · 訂單追蹤）
    enableAnimation: boolean;
  };
  layout: {
    heroStyle: HeroStyle;
    heroSubtitle: string | null;       // minimal / magazine 用副標
    heroEyebrow: string | null;        // magazine top metadata
    heroImageSide: "left" | "right";   // split 用
    sectionOrder: SectionKey[];
    testimonials: Testimonial[];       // 顧客評語（optional block）
    faqItems: FaqItem[];               // 首頁 FAQ（optional block）
    stats: StatItem[];                 // 數字 / 成就（optional block）
    partners: PartnerItem[];           // 合作夥伴 logos（optional block）
    gallery: GalleryItem[];            // 圖片相簿（optional block）
    mapEmbedUrl: string | null;        // Google Maps embed URL（visit section 顯示）
    // Phase 5 Free Positioning：unified record of element positions
    // key = element identifier（"hero-tagline" / "hero-subtitle" / "promise-quote" / "visit-title"...）
    // value = { x, y } in 0-1 ratio of parent section
    freePositions: Record<string, { x: number; y: number }>;
    heroZoom: number;                  // legacy 共用縮放（如果 per-viewport 未設定就 fallback 用這個）
    heroZoomMobile: number;            // 手機（< 640px）獨立縮放，預設 1.5
    heroZoomTablet: number;            // 平板（640-1024px）獨立縮放，預設 1.3
    heroZoomDesktop: number;           // 桌機（≥ 1024px）獨立縮放，預設 1.0
    // Hero 主標自訂：null = 用預設
    heroTaglineFontScale: number;      // 主標字體 multiplier，0.6-1.8（預設 1.0）
    heroTaglineColor: string | null;   // 主標顏色，hex；null = 用 theme.text
    heroTaglineAlign: "left" | "center" | "right"; // 主標對齊（預設 left）
    // 主標粗細（normal 400 常規 / medium 500 中黑 / bold 700 粗）。四種版型的 hero 主標
    // 都在 inline style 裡寫死 fontWeight: 400——那是整個網站字最大、客人第一眼唯一會讀完
    // 的一句話，而 400 是最輕的那一級。細字配大字級在雜誌版型上是好看的，配到太和工房那種
    // 賣器物的店、或主標只有四五個字的短句，整句會軟掉、撐不起底下整頁的份量。
    // 商家原本能動的只有三個方向，每一個都連帶動到別的：字級 slider 把字放大（hero 整塊
    // 跟著變高、照片與文字的比例被改掉）、顏色調深（跟背景的對比一起變，深色底的店反而更糊）、
    // 換字體（整站的字一起換，不只主標）。粗細不佔空間、不動顏色、只影響這一句，是讓主標
    // 站出來最省的一格，卻是 hero 這組控制裡唯一沒有的——字級、顏色、對齊、高度、縮放都給了。
    // 各段大標早就有「標題粗細」（headingWeight）可以各段獨立調，那條規則 selector 明確排除
    // hero（hero 主標的字級 / 顏色 / 對齊自成一組），所以 hero 是全站唯一調不動粗細的標題。
    // 只給 400 / 500 / 700：layout 那支載進來的就這三個字重，300 那種沒載的瀏覽器會拿常規
    // 去假變細，中文筆畫糊掉——跟段落大標、卡片那幾格同一個理由。
    // 四種版型一起套（不像對齊只在 full-image 生效）：粗細不動位置，split / magazine /
    // minimal 的版面配置一格都不會被翻掉，沒設定的店家照樣算出 400、跟現在一模一樣。
    heroTaglineWeight: "normal" | "medium" | "bold"; // 主標粗細（預設 normal = 400）
    // 主標字距（tight 收緊 / normal 預設 / wide 撐開）。四種版型的主標各自寫死一個
    // letterSpacing：整版圖片 0.02em、左右分割 -0.01em、雜誌 -0.02em、極簡 -0.015em。
    // 那四個值是照英文主標調的——負字距把字往內收，拉丁字母本來就有側邊空隙，收一點更緊實；
    // 中文方塊字沒有那個空隙，負字距等於直接讓筆畫互相咬住，字級愈大咬得愈明顯，而這一句
    // 正好是全站字級最大的那一句。台灣商家十家有九家主標打中文，等於預設值站在他們的反面。
    // 反過來也有：主標只有四五個字的短句，撐開字距能把那一行拉滿版面、看起來不像沒寫完。
    // 商家原本要救只能換字體（整站的字一起換）或改字級（hero 整塊高度跟著變），沒有一格
    // 只動這一行的字與字間隔。各段大標早就有「標題字距」可以各段獨立調，但那條規則餵的是
    // --store-heading-track 變數，hero 主標的字距寫在自己的 inline style 裡，變數餵不進去。
    // 存的是相對量不是絕對值：收緊 -0.03em、撐開 +0.05em，各加在該版型原本那個數字上，
    // 四種版型的手感差異保留下來，預設值算出來跟現在一模一樣。
    heroTaglineTracking: "tight" | "normal" | "wide"; // 主標字距（預設 normal = 不加減）
    // 主標行距（上下兩行之間隔多遠）。四種版型各在 class 上寫死一個 leading-[]：滿版圖
    // 1.6、split 1.15、雜誌 1.05、極簡 1.2。那四個數字是照英文主標挑的——拉丁字母有大量
    // 上下伸出的筆畫（b d f g p y），行距壓到 1.05 還看得出行與行的界線；中文是等高方塊字，
    // 同樣的 1.05 排出來上下兩行幾乎貼在一起。反過來滿版圖那個 1.6 是為了讓字浮在照片上
    // 好讀，但主標一旦換行成三四行，1.6 會把整塊文字撐得比照片還高。
    // 而主標偏偏是最容易換行的一句：中文沒有空格，商家打一句十幾個字的標語，在手機上
    // 直接斷成三行。字級、顏色、對齊、粗細、字距都給了，行與行之間的距離是最後一個沒得動的。
    // 存的是相對倍率不是絕對值——四種版型原本的手感差異保留，收緊 ×0.85、舒展 ×1.25，
    // 收緊那邊壓到 1.0 就不再往下（低於 1.0 中文的字會真的疊到上一行）。預設不覆寫。
    heroTaglineLeading: "tight" | "normal" | "relaxed"; // 主標行距（預設 normal = 不覆寫）
    // Hero eyebrow 小標（主標上面那行全大寫小字）。四種版型都會渲染它，但它是 hero 這組
    // 控制裡唯一一個字級 / 字距 / 顏色全部寫死、商家一格都動不到的元素——主標有五格、
    // 副標有三格、照片有縮放與高度，小標零格。而它是客人由上往下讀到的第一行字。
    // 三個寫死值各有各的問題：
    // 1. 字級 10px（四處都是 text-[10px]）。那是照拉丁字母的大寫字挑的——大寫字母沒有
    //    下伸部、筆畫少，10px 還讀得出來；中文方塊字在 10px 只剩一團墨，「本月選物」
    //    這種四個字的小標在手機上等於一排灰點。全網站字級 slider 動的是別的地方，這行
    //    的 10px 寫在 class 上，跟著誰都不動。
    // 2. 字距 0.4em（雜誌版型 0.32em）。同樣是給大寫字母用的：拉丁字母 all-caps 不撐開
    //    字距會擠成一塊，所以編輯設計裡一律加寬。中文方塊字本來就自帶字身框的留白，
    //    再加 0.4em 等於每個字之間空掉快半個字，四個字的小標會散成四個不相干的字。
    // 3. 顏色三處寫死 theme.accent、雜誌那條 metadata 寫死 theme.textMuted。主色是店裡
    //    最搶眼的顏色，押在整頁最小的那行字上，在照片上的 hero 特別容易糊；反過來想讓
    //    這行退成純裝飾也沒得退。
    // 字級與字距存的是相對量：沒設定的店家算出來跟現在一模一樣（scale 1.0 不覆寫 class，
    // 字距加減零也不覆寫），四種版型原本的手感差異（0.4 / 0.32em）保留下來。
    heroEyebrowFontScale: number;      // 小標字體 multiplier，0.6-1.8（預設 1.0 = 不覆寫）
    heroEyebrowTracking: "tight" | "normal" | "wide"; // 小標字距（預設 normal = 不加減）
    heroEyebrowColor: string | null;   // 小標顏色，hex；null = 各版型原本的值（主色 / 淡文字色）
    // 4. 大小寫。五處 class 一律 uppercase，跟 10px、0.4em 是同一個設計決定的三個面向
    //    （全大寫 + 極小 + 撐開字距 = 編輯設計裡的 eyebrow 標準寫法），但前面兩個都補了控制、
    //    這個沒有。對中文完全無效（方塊字沒有大小寫，強制轉換不會有任何變化），對英文則是
    //    寫死的一種選擇——商家打「Est. 2019」「Since 1998」這種年份字樣，全大寫會變成
    //    「EST. 2019」；打自己的英文店名（Plantae Market）也會被拉成 PLANTAE MARKET，
    //    而店名的大小寫通常是 logo 的一部分，被改掉等於招牌被改。商家原本沒有任何一格
    //    能把它關掉——連改字都沒用，因為轉換發生在畫面上不在資料裡（輸入框裡還是小寫）。
    heroEyebrowCase: "upper" | "capitalize" | "none"; // 小標大小寫（預設 upper = 原本的 uppercase）
    // 5. 粗細。小標的字級、字距、顏色、大小寫四格都補完了，唯獨「有多重」沒有——四處
    //    <p> 的 class 只有 text-[10px] tracking-[0.4em] uppercase，一個 font-weight 都沒寫，
    //    繼承的是內文的 400。全站最小的那行字（10px）配上全站最鬆的字距（0.4em）再配上
    //    最輕的字重，是三個「往淡的方向」疊在一起：壓在 hero 照片上時，那行字幾乎是浮在
    //    影像紋理裡的一排灰點，客人由上往下讀到的第一行字直接讀不到。商家原本要救只有
    //    兩條路，兩條都連坐：把顏色拉深（那行字就從輔助資訊變成跟主標搶的一塊深色），
    //    或把字級放大（10px 是撐開字距的前提，一放大整行就從 eyebrow 變成第二個標題）。
    //    加重量是唯一「一樣小、一樣淡、但看得出來是字」的做法，而全站字重控制（各區段
    //    那組 data-body-weight）走的是段落內文，發不到 hero 這四個 <p> 上。
    //    只給 400 / 500 / 700（layout 載進來的三個字重），預設 normal 完全不覆寫。
    heroEyebrowWeight: "normal" | "medium" | "bold"; // 小標粗細（預設 normal = 不覆寫）
    heroSubtitleFontScale: number;     // 副標字體 multiplier，0.6-1.8（預設 1.0）
    heroSubtitleColor: string | null;  // 副標顏色，hex；null = 用 theme.textMuted
    heroSubtitleAlign: "inherit" | "left" | "center" | "right"; // 副標對齊（inherit = 跟版型預設走，不覆寫）
    // 副標粗細與字距。副標已經有字級 / 顏色 / 對齊三格，但這兩個從頭到尾沒有人寫過——
    // 五處 <p> 的 inline style 只設顏色與字級，class 只有 text-base sm:text-lg 與
    // leading-[1.9]，粗細與字距都是繼承來的（body 的 400、瀏覽器的 normal）。
    // 各段內文早就有「內文粗細」「內文字距」可以各段獨立調，但那兩條規則落在 section 的
    // data-body-weight / data-body-tracking 上，hero 整段沒有發那兩個 attribute（hero 的
    // 字自成一組，不吃 section style），所以副標兩格都不通。
    // 為什麼需要：副標常是主標下面那兩三行說明，字級只有 1rem 上下，卻是照片上唯一一段
    // 完整句子。壓在 hero 照片上時淡文字色 + 常規字重讀起來很吃力，商家原本只能把顏色
    // 調深（整段一起變重）或字級放大（hero 整塊變高），沒有一格只加一點重量。
    // 反過來雜誌 / 極簡版型的副標是斜體引文，撐開字距能讓它更像引文、更不像內文。
    // 兩個都是沒設就完全不覆寫（回 {}），既有店家算出來一模一樣。
    heroSubtitleWeight: "normal" | "medium" | "bold"; // 副標粗細（預設 normal = 不覆寫）
    heroSubtitleTracking: "tight" | "normal" | "wide"; // 副標字距（預設 normal = 不覆寫）
    // 副標行距。五處副標的 class 一律 leading-[1.9]，跟主標不一樣的是這裡四種版型完全
    // 沒有差別——1.9 是「內文段落」的行距，套在只有兩三行、字級 1rem 上下的副標上偏鬆，
    // 那兩三行會散開成一整塊灰色，反而搶了主標的位置。雜誌 / 極簡版型的副標是斜體引文，
    // 收緊一點會更像一句引文；反過來副標寫得長、壓在照片上時，1.9 還不夠鬆。
    // 各段內文早就有「行距」可調，但那條規則走 section 的 data-line-height，hero 整段
    // 不發那個 attribute（跟副標粗細 / 字距同一個原因），所以副標吃不到。
    // base 只有 1.9 一個值，所以這裡存絕對值：收緊 1.55 / 舒展 2.2。預設不覆寫。
    heroSubtitleLeading: "tight" | "normal" | "relaxed"; // 副標行距（預設 normal = 不覆寫）
    // Hero 按鈕（CTA）的文字大小。主標五格、副標五格、小標四格都補完了，客人真正要按的
    // 那一顆反而沒有一格——五處的字級全寫死，而且三種寫法各不相同：滿版圖是一行帶底線的
    // 連結（text-sm，0.875rem）、split 與極簡是 .sproutly-btn-lg（0.875rem，寫在 layout 的
    // CSS 裡）、雜誌那條是繼承下面那行 metadata 的 10px。三個地方都不是商家改得到的。
    // 為什麼要：那一顆是整個 hero 上唯一有動作的東西，但預設值把它排在視覺順位的最後——
    // 主標可以放到 4rem 以上，按鈕文字固定 0.875rem，中間差了四五倍；再加上 .sproutly-btn
    // 一律 uppercase + 0.18em 字距，中文的「立即選購」四個字在一顆大按鈕裡看起來又小又散。
    // 雜誌版型那個 10px 更極端，客人在手機上幾乎看不到那行字是可以按的。
    // 商家原本能繞的路都有副作用：把按鈕文字打長一點（版位會被撐開）、換全網站字級
    //（每一頁的字一起變）、或改 hero 高度（按鈕沒變只是周圍空白變多）。
    // 存的是 multiplier 不是絕對值——五處各自的 base 不同（0.875rem / 0.875rem / 10px），
    // 乘上去各自放大，版型之間原本的手感差異保留；1.0x 完全不覆寫，既有店家一模一樣。
    // 按鈕型那三顆的內距跟著字走（改成 em 表示，1.0x 算出來等於原本那組 rem），不然字放大
    // 會把兩側的留白吃光、變成一顆塞滿字的長方形。
    heroCtaFontScale: number;          // Hero 按鈕文字 multiplier，0.6-1.8（預設 1.0 = 不覆寫）
    // Hero 按鈕的字距與大小寫。上一格補了按鈕文字大小，但那格的說明裡自己就寫了字放大以後
    // 還有兩個東西沒解決：「.sproutly-btn 一律 uppercase + 0.18em 字距，中文的『立即選購』
    // 在一顆大按鈕裡看起來又小又散」。字級那格只能讓那四個字變大，散開的問題原封不動——
    // 字放愈大，0.18em 的間隔跟著等比例放大，四個字反而散得更開。
    // 三處的 base 各不相同，而且都不是商家改得到的：滿版圖那兩處是 tracking-wider（0.05em，
    // 不轉大寫）、split 兩顆與極簡那顆吃 .sproutly-btn（0.18em + uppercase，寫在 layout 的
    // CSS 裡）、雜誌那條繼承上層 metadata 那條（0.32em + uppercase）。
    // 字距為什麼要動：0.18em 跟 0.32em 都是給拉丁字母全大寫用的——大寫字母不撐開字距會擠成
    // 一塊，所以編輯設計裡的按鈕一律加寬。中文方塊字自帶字身框留白，再加 0.18em 等於每個字
    // 之間空掉快五分之一個字，「立即選購」四個字會散成四個不相干的字，愈是大按鈕愈明顯。
    // 反過來英文短詞（Shop / Explore）撐開一點確實更像一顆按鈕，所以不是把預設砍掉、是給一格。
    // 大小寫為什麼要動：跟小標那格同一件事，但發生在更要緊的地方——按鈕是客人唯一會按的東西。
    // 商家打「Shop Now」會被拉成「SHOP NOW」，打自己的英文店名或商品名（Plantae Market）
    // 也一樣。全大寫在中文完全無效（方塊字沒有大小寫），所以這格只有打英文的店會用到。
    // 轉換發生在畫面上不在資料裡，改輸入框的字沒有用，商家原本沒有任何一格關得掉。
    // 字距存的是相對量（收緊 -0.12em、撐開 +0.1em，加在各處原本那個值上），三處原本的手感
    // 差異保留；收緊那邊壓到 0 就不再往下（負字距會讓中文筆畫互相咬住）。大小寫的預設是
    // 「照版型原本」不是「全大寫」——三處的 base 本來就不一致（滿版圖那兩處根本沒轉大寫），
    // 寫死一個 upper 當預設會在存檔的當下把滿版圖那顆改掉。兩格都是沒設就完全不覆寫。
    heroCtaTracking: "tight" | "normal" | "wide"; // 按鈕字距（預設 normal = 不加減）
    heroCtaCase: "default" | "capitalize" | "none"; // 按鈕大小寫（預設 default = 照各版型原本）
    // Hero 按鈕的粗細。大小、字距、大小寫三格開完之後，按鈕那組字剩最後一個寫死的參數——
    // 字有多重。六處的 base 一樣是兩種寫法：藥丸型那三顆（split 兩顆 + 極簡那顆）吃
    // .sproutly-btn 的 font-weight: 500（寫在 layout 的 CSS 裡），連結型那三處（滿版圖兩處、
    // 雜誌那條）什麼都沒寫、繼承內文的 400。
    // 為什麼要：字級那格可以把按鈕文字放大，但放大之後常常反而暴露它太輕——滿版圖那顆
    // 底線連結跟旁邊的副標是同一個重量，字拉大以後看起來像一行被劃掉的內文，不像可以按；
    // 反過來商家把主標調細走輕盈路線時，藥丸按鈕上那個 500 會變成整個 hero 最重的字，
    // 想把它退下來也沒有一格。主標、副標、卡片標題、各段標題全都有粗細可調，唯獨客人
    // 真正要按的那行字沒有。
    // 預設是「照各版型原本」不是某個字重——六處的 base 本來就不一致（500 跟 400），寫死
    // 一個值當預設會在商家存檔的當下把其中一種改掉。只給 400 / 500 / 700 三檔：layout
    // 載進來的就這三個字重，其他的瀏覽器會拿常規去假造，中文筆畫糊掉（跟主標粗細、副標
    // 粗細那幾格同一個理由）。沒設就完全不覆寫、回 {}，既有店家算出來一模一樣。
    heroCtaWeight: "default" | "normal" | "medium" | "bold"; // 按鈕粗細（預設 default = 照各版型原本）
    // 按鈕顏色。大小、字距、大小寫、粗細開完之後，按鈕上唯一還寫死的就是顏色，而顏色
    // 是這顆東西「看起來能不能按」最主要的訊號——前面四格能做的只有把字弄大弄粗，弄到
    // 最後還是一顆跟旁邊主標同色的字。六處的底是兩件不同的事：連結型那三處（滿版圖的
    // 兩顆、雜誌那條）只有字，字色寫死 theme.text，跟主標同一個顏色，底線走
    // currentColor 所以跟著字走；藥丸型那三顆吃 .sproutly-btn-primary / -secondary，
    // 實心那兩顆是「底色＝全站文字色、字色＝全站底色」的反白，描邊那顆是「字色＝文字色、
    // 框線＝border 色」。
    // 所以這一格的口徑訂成「按鈕的顏色」而不是「按鈕的文字顏色」：連結型只有字，那就是
    // 字色；實心藥丸拿去當底色，字色不另外開一格而是算出來（見 page.tsx），因為底色跟
    // 字色分兩格開，商家挑到兩個相近的顏色就會得到一顆讀不出字的按鈕，而那正是最不該
    // 出事的元素；描邊藥丸沒有底色，就同時當字色與框線色。
    // 一個色碼欄位、沒設完全不覆寫，既有店家算出來一模一樣。
    heroCtaColor: string | null;       // 按鈕顏色，hex；null = 各版型原本的顏色
    // 雜誌版型底下那條 byline 的字級與顏色。hero 這組控制補到這裡，主標、副標、小標、
    // 按鈕都有了，byline 是最後一個完全沒得動的元素——商家改得到的只有那行字本身
    //（編輯器早就有輸入框），字級寫死在外層那條 flex 的 text-[10px] 上、顏色寫死
    // theme.textMuted。10px 跟上面那條 metadata 同一個值，都是照拉丁大寫字母挑的：
    // 大寫字母沒有下伸筆畫、筆畫少，10px 還讀得出來；商家實際打的 byline 常是中文
    //（「由 XX 選件」）或混中英，方塊字在 10px 只剩一團墨，而全網站字級那格動不到
    // class 上寫死的 px。顏色則是整個雜誌版型最淡的一行——上面那條 metadata 至少可以
    // 靠「小標顏色」那格拉回來，byline 沒有對應的格子，想讓它退成純裝飾或反過來讓它
    // 讀得清楚都做不到。
    // 兩格都刻意只套在 byline 那個 span 上、不套外層那條 flex：右邊的 CTA 連結是另一件
    // 事，已經有自己的「按鈕文字大小」「按鈕字距」「按鈕大小寫」三格，套外層會讓 byline
    // 這格連帶動到按鈕（跟小標那輪把三格套在整條 metadata 上的判斷相反，因為那一行左右
    // 兩端是成對的，這一行不是）。沒設就完全不覆寫，既有店家算出來一模一樣。
    heroBylineFontScale: number;       // byline 字級 multiplier，0.6-1.8（預設 1.0 = 不覆寫）
    heroBylineColor: string | null;    // byline 顏色，hex；null = 原本的淡文字色
    // byline 的字距與大小寫。上一格補了字級與顏色，但那兩格的說明裡沒提到 byline 那個 span
    // 自己一個樣式都沒有——它的字距與大小寫是從外層那條 flex 繼承來的
    //（tracking-[0.32em] uppercase），所以字放大之後還有兩個問題原封不動：
    // 1. 0.32em 是整站最寬的字距，跟 10px 一起是照拉丁大寫字母挑的（全大寫的英文不撐開
    //    會擠成一塊）。byline 商家實際打的是「由 XX 選件」「攝影 / 王小明」這種中文或
    //    中英混排，方塊字自帶字身框留白，再加 0.32em 等於每個字之間空掉三分之一個字，
    //    七八個字的一行會散成七八個不相干的字。而字級那格只會讓它散得更開——0.32em 是
    //    相對字級的，字放大字距跟著等比例放大。
    // 2. uppercase 對中文按了不會動（方塊字沒有大小寫），問題在英文與混排：byline 打
    //    人名（Photography by Wang）會被拉成 PHOTOGRAPHY BY WANG，打自己的英文店名或
    //    IG 帳號也一樣（帳號的大小寫是它自己的一部分）。改輸入框的字沒有用——轉換發生
    //    在畫面上不在資料裡，商家看到自己打的還是小寫，怎麼改都一樣。
    // 跟上面兩格同一個判斷：只套在 byline 那個 span 上、不套外層那條 flex。右邊的 CTA
    // 已經有自己的「按鈕字距」「按鈕大小寫」，套外層會讓這兩格連帶動到按鈕。
    // 字距存的是相對量（收緊 -0.24em、撐開 +0.1em，加在繼承來的 0.32em 上），收緊壓到 0
    // 就不再往下（負字距會讓中文筆畫互相咬住）。大小寫的預設留「照原本的全大寫」那一檔，
    // 少了它按過「字首大寫」之後沒有一顆按鈕退得回原樣（跟小標那格同一個理由）。
    // 兩格都是沒設就完全不覆寫、回 {}，既有店家的 byline 一個字都不會變。
    heroBylineTracking: "tight" | "normal" | "wide"; // byline 字距（預設 normal = 不加減）
    heroBylineCase: "upper" | "capitalize" | "none"; // byline 大小寫（預設 upper = 原本的 uppercase）
    // byline 的粗細。字級、顏色、字距、大小寫四格開完之後，byline 剩最後一個沒得動的
    // 參數——那行字有多重。它自己一個 font-weight 都沒寫，繼承的是內文的 400，而 hero 上
    // 每一個其他元素都已經有粗細可調（主標、副標、小標、按鈕），只剩這一行沒有。
    // 為什麼要：byline 在兩種店裡是兩種東西。一種店把它當真的資訊在用（「攝影 / 王小明」
    // 「由 XX 選件」），商家調大字級想讓客人讀到，但 400 配上整個雜誌版型最淡的那個顏色，
    // 放大之後仍然是整頁最不明顯的一行。顏色那格能拉深，可是拉深到接近主標又會跟上面
    // 那條 metadata 打架——商家真正要的是「一樣的淡，但看得出是一行字」，那是字重的事
    // 不是顏色的事。另一種店把 byline 當落款、當版型底下的一句署名，這時 500 那一檔配上
    // 收緊過的字距，能讓那幾個字結成一塊像印章，而不是散在分隔線底下的一排灰字。
    // 只給 400 / 500 / 700 三檔（跟主標、副標、按鈕那幾格同一個理由）：layout 載進來的
    // 就這三個字重，其他的瀏覽器會拿常規去假造，中文筆畫糊掉——byline 的 base 只有 10px，
    // 假造的字重在這個字級上糊得最兇。往細的方向沒有一檔可以給，因為 400 已經是載進來
    // 最細的；想讓 byline 更退後仍然是走顏色那格。
    // 跟前面四格同一個判斷：只套 byline 那個 span，不套外層那條 flex（右邊的 CTA 有自己的
    // 「按鈕粗細」，套外層會讓這格連帶動到按鈕）。預設 normal = 繼承來的 400，沒設完全
    // 不覆寫、回 {}，既有店家的 byline 一個字都不會變。
    heroBylineWeight: "normal" | "medium" | "bold"; // byline 粗細（預設 normal = 不覆寫）
    // split 版型的圖文比例。原本寫死 md:grid-cols-2（50:50），而 50:50 只有在「圖是方的、
    // 文字只有一行主標」時才剛好；商家實際放的圖多半是直式商品照（左半被裁掉一大塊），
    // 或者反過來主標加副標加兩顆按鈕塞不進右半那欄、字級一大就開始換行成四五行。
    // 三檔動的是 md 以上的欄寬（手機是單欄堆疊，這格對它沒作用）：
    //   image-narrow 2fr 3fr（圖 40%，讓文字那欄鬆一點）
    //   normal       不覆寫（吃 Tailwind 的 md:grid-cols-2）
    //   image-wide   3fr 2fr（圖 60%，直式照片少裁一點）
    // 值算出來時已經把「圖在右」那個 order 反轉考慮進去（grid-template-columns 講的是
    // 視覺左右欄，跟 order 無關），所以存的是語意檔、render 才翻成欄寬字串。
    heroSplitRatio: "image-narrow" | "normal" | "image-wide"; // split 圖文比例（預設 normal = 不覆寫）
    // split 版型那張圖被裁時保留哪一端。上一格把欄寬讓寬了，可是圖框的形狀還是由版型決定
    // （手機是正方形、平板以上是整欄的高度），跟照片本身的比例不一樣就一定要裁掉一邊；
    // 裁的位置寫死在正中間，直式商品照被切掉的上緣（葉冠、瓶口）跟下緣（盆器、落款）
    // 剛好是商家真正想給人看的地方。三檔就是 object-position 的三個值：
    //   top    保留上緣（切下面）
    //   center 不覆寫（維持原本的置中裁）
    //   bottom 保留下緣（切上面）
    // 各段卡片圖框那格「照片取景」是同一件事的段落版，但那條規則只掛在卡片圖框上，
    // hero 這張不在卡片裡，所以要自己一格。
    heroImageFocus: "top" | "center" | "bottom"; // split 照片取景（預設 center = 不覆寫）
    // split 版型在手機上那張圖的形狀。上面兩格處理的是平板以上：欄寬讓寬了、裁切保留哪一端
    // 也能挑了，可是手機完全沒被碰到——手機的 split 是圖上文下的單欄堆疊，圖框寫死
    // aspect-square，那個正方形跟商家上傳什麼圖無關，永遠是一比一。
    // 為什麼要：手機是這些店的客人幾乎唯一的入口（IG 連過來的），而正方形是四種比例裡最
    // 不適合直式商品照的一種——一株連盆兩尺高的植物、一支細長的水壺，塞進正方形要從上下
    // 各切掉將近三分之一，「照片取景」那格只能決定犧牲葉冠還是犧牲盆器，兩邊都想留就沒辦法。
    // 反過來橫幅的店面照、桌面陳列照塞進正方形，左右被切掉的是把畫面撐開的那些留白，
    // 一張本來很鬆的照片會變成擠在中間的一團。
    // 三檔就是三個 aspect-ratio，只在 md 以下生效（平板以上圖框是整欄的高度，跟這格無關）：
    //   tall   4 / 5（直式，商品照原樣多留上下）
    //   square 不覆寫（維持原本的 1:1）
    //   wide   3 / 2（橫式，店面照或陳列照）
    // 不開成任意數字：比例是會連帶動到後面整段文字位置的東西（圖變高文字就被推下去），
    // 讓商家自己填數字很容易得到一張佔滿整個手機屏的圖，客人要滑兩下才看得到店名。
    // 直式只給到 4/5 不給 3/4 或 2/3 也是同一個理由——4/5 已經是「圖後面還看得到一行字」
    // 的邊界。沒設就完全不覆寫，既有店家的手機版一模一樣。
    heroSplitImageAspect: "tall" | "square" | "wide"; // split 手機圖片形狀（預設 square = 不覆寫）
    // split 版型文字那欄的字擺在欄的哪個高度。前三格處理的都是圖那半（欄寬、裁切、手機
    // 形狀），文字那半從頭到尾沒動過：它是 flex flex-col justify-center，也就是不管裡面
    // 有幾行字，整團永遠釘在欄的正中央，而這一段在平板以上是整屏高（md:min-h-screen）。
    // 為什麼要：置中是配「主標一行、副標一句」挑的，那時候字團矮、擺中間跟旁邊整欄高的
    // 照片剛好對得起來。可是內容一多就不是這樣——主標兩三行加副標加兩顆按鈕的店，字團
    // 本來就快撐滿整欄，置中等於上下各剩一點點、跟照片的上下緣沒有任何對齊關係；反過來
    // 只放一行店名的店，那行字孤零零浮在整屏高的欄正中間，照片上緣到字之間空掉半個螢幕。
    // 雜誌與型錄的圖文對頁排法多半是兩邊切齊上緣（字從照片頂端開始）或切齊下緣，正中間
    // 反而是最少用的一種。三檔就是 justify-content 的三個值：
    //   top    靠上（字的第一行對齊照片上緣）
    //   center 不覆寫（維持原本的置中）
    //   bottom 靠下（最後一顆按鈕對齊照片下緣）
    // 手機上這格不會有作用也不會出事：手機是圖上文下的單欄，文字那欄的高度就是內容自己
    // 的高度，justify-content 沒有多的空間可以分。
    heroSplitTextAlign: "top" | "center" | "bottom"; // split 文字欄垂直對齊（預設 center = 不覆寫）
    // 上一格開的是這欄的字擺在多高，這一格是同一欄的另一個方向：字靠哪一邊。那欄是
    // flex flex-col，沒有寫任何 text-align 也沒寫 align-items，所以裡面每一樣東西都
    // 從左邊界開始排——小標、主標、副標、兩顆按鈕全部靠左，而且是寫死的、一格都碰不到。
    // 為什麼要：左右那半是一張整欄高的照片，照片是一塊實心的東西、兩邊都切齊欄的邊界；
    // 文字這半只有幾行長短不一的字，全靠左的時候右邊那側是一條凹凸不平的邊，跟旁邊那張
    // 照片切得筆直的邊擺在一起，兩半看起來不是一組的。置中那版兩半各自對稱、中軸對上
    // 照片的中軸，是型錄那種對頁排法；靠右那版讓文字的右邊界貼著欄的內緣，圖在左時
    // 兩半的字與圖會朝中間互相靠攏，這是雜誌跨頁最常見的收法——而想要這兩種的店現在
    // 一格都沒有。minimal 版型已經有「整段文字對齊」，split 這欄一直缺同一格。
    // 三檔跟那格同一組字（靠左 / 置中 / 靠右），預設 left = 完全不覆寫，既有店家算出來
    // 一模一樣。不是只改 text-align 就好：副標自己包了一個 max-w-md（28rem 窄欄）、
    // 按鈕那排是 flex，兩樣都是比欄窄的區塊，只改 text-align 的話字會置中、但那塊副標
    // 跟那排按鈕還黏在左邊界，變成上面置中下面靠左。所以要連 align-items 一起給，
    // 那兩塊才會跟著移到同一邊。
    heroSplitTextAlignX: "left" | "center" | "right"; // split 文字欄水平對齊（預設 left = 不覆寫）
    // split 版型文字那欄左右留多少空。上面「圖文比例」讓的是欄本身有多寬，可是欄裡面
    // 那圈內距是寫死的（px-8 sm:px-12 md:px-16 lg:px-24，桌機左右各 6rem），兩件事會
    // 互相抵消：選了「圖窄」把欄讓寬，字實際能用的寬度先被兩邊各 6rem 吃掉一截，主標
    // 照樣在換行；反過來選「圖寬」之後文字那欄本來就只剩四成，還維持 6rem 的內距，
    // 一行常常只排得下四五個字，整段變成一條細長的字柱。
    // 三檔都用 clamp 讓平板到桌機連續變化，不沿用原本 md / lg 兩階跳的寫法：
    //   tight  clamp(2rem, 4vw, 3rem)   欄窄的店把空間還給字
    //   normal 不覆寫（吃原本的 md:px-16 lg:px-24）
    //   roomy  clamp(4rem, 10vw, 9rem) 只放一行短主標的店，留白本身就是版面
    // 只寫在 md 以上：手機是單欄堆疊，那時候 px-8 是全站的左右邊界（跟導覽列與後面
    // 每一段對齊），動它會變成整頁唯一沒對齊的一段。上下的 py-20 md:py-0 也不動——
    // 上一格「垂直對齊」管的就是上下，兩格動同一個方向會互相打架。
    heroSplitTextPadding: "tight" | "normal" | "roomy"; // split 文字欄左右內距（預設 normal = 不覆寫）
    // split 版型文字那半在手機上的上下留白。左右那格（上面這個）明講只管平板以上，因為
    // 手機的左右邊界要跟導覽列對齊；可是上下這個方向在手機上一格都沒有——class 上寫死
    // py-20 md:py-0，也就是手機時字的上下各撐 5rem，平板以上歸零（那時候高度由
    // justify-content 分，不靠內距）。
    // 為什麼要：5rem 是配「照片是正方形、字只有店名加一句話」挑的。可是「手機上圖片的
    // 形狀」那格一改成直式，照片自己就吃掉一個多螢幕的高度，底下再接一塊上下各空 5rem
    // 的字，整段被拉得很長，客人得一直滑；而「這一段有多高」那格只寫在平板以上，手機
    // 完全碰不到。反過來，把文字排到照片上面（「手機上誰排在上面」選文字）當第一屏的店，
    // 5rem 反而不夠——字貼著螢幕上緣的導覽列，開頭沒有喘息的地方。
    // 三檔動的是手機那一欄的 padding-top / padding-bottom：
    //   tight  2.5rem  照片本身已經很高的店，把長度還回去
    //   normal 不覆寫（維持原本的 5rem）
    //   roomy  7rem    文字排在第一屏的店，開頭多留一點空
    // 只寫在 767px 以下：平板以上那個 md:py-0 是刻意的（高度歸「文字靠哪」那格用
    // justify-content 管），套上去會讓那格的靠上 / 靠下多出一段推不掉的空隙。
    // 不覆寫那一檔連 attribute 都不輸出，既有店家的手機版一模一樣。
    heroSplitMobilePadY: "tight" | "normal" | "roomy"; // split 文字欄手機上下內距（預設 normal = 不覆寫）
    // split 版型文字那一欄裡面那三段直向間距（小標到主標、主標到副標、副標到按鈕列）。
    // 上面兩格（左右內距、手機上下內距）調的都是「這一欄的邊界離字有多遠」，這一格調的
    // 是欄裡面各行之間的疏密，兩件事互不相干卻只有前者能動：三個間距一直寫死在 class 上
    //（mb-6 / mt-6 / mt-10），是配「主標字級跟預設一樣大、副標一兩行」挑的。
    // 為什麼要：主標字級那格拉大之後，一行大字跟下一行之間只剩原本那 1.5rem，字級越大
    // 越像黏在一起；而這一欄跟 minimal 不一樣的地方是它只有半個螢幕寬，字換行更早、
    // 行數更多，整團字更容易糊成一塊。反過來「圖文比例」選了圖窄、文字那半變寬的店，
    // 字排得開了、行與行之間卻還是原本那點空，上下顯得比左右擠。平板以上這一欄是
    // justify-center 撐滿整屏高，字本來就有空間可以散開，這時候把行距放鬆最划算。
    // 三檔跟 minimal 那格同口徑，三個值一起套同一個倍率（緊 0.5x / 鬆 1.75x）：
    // 6 / 6 / 10 之間原本就有「副標貼主標近、按鈕離得遠」的層次，拆成三格讓商家各填一個
    // 數字，那個層次第一次調就會壞掉。預設完全不輸出任何值，既有店家算出來一模一樣。
    heroSplitGap: "tight" | "normal" | "loose"; // split 文字欄內部間距（預設 normal = 不覆寫）
    // split 版型在手機上，照片與文字誰排在上面。平板以上有「圖片靠左 / 靠右」那格可以把
    // 字換到前面，可是手機是單欄堆疊（grid-cols-1），那格的 md:order-1 / md:order-2 完全
    // 碰不到，順序永遠是照片先、文字後。
    // 為什麼要：手機上照片是滿寬的，配上預設的正方形圖框，光那張圖就吃掉一個螢幕寬的高度，
    // 客人從 IG 點進來第一屏看到的是一張圖，店名、那句話、兩顆按鈕全部在摺線下面，要滑一下
    // 才出現。對「照片本身就是招牌」的店（店面照、一整面植物牆）那是對的，第一屏就該是那張
    // 圖；可是對「先讓客人知道這是誰、賣什麼」的店就反過來——那張圖變成擋在店名前面的一道牆。
    // 兩檔就是手機那一欄的 order：
    //   image-first 不覆寫（維持原本的圖上文下）
    //   text-first  文字排到圖上面（第一屏就是店名 + 那句話 + 按鈕，照片接在下面）
    // 只寫在 767px 以下：平板以上的左右順序歸「圖片靠左 / 靠右」那格管，兩格動的是不同
    // 斷點的同一件事，混在一起會變成選了靠右卻在手機上看不出差別的那種格子。
    // 不覆寫那一檔連 attribute 都不輸出，既有店家的手機版一模一樣。
    heroSplitMobileOrder: "image-first" | "text-first"; // split 手機圖文順序（預設 image-first = 不覆寫）
    // split 版型這一段有多高。上面那幾格動的都是這一段裡面怎麼分（左右比例、圖框形狀、
    // 字擺在欄的哪個高度、欄裡留多少空），這一段本身多高卻是寫死的——平板以上 min-h-screen，
    // 整整一個螢幕。而 Hero panel 那格「Hero 高度」的說明白紙黑字寫著只有整版圖片版型會
    // 套用，split 選了也沒反應。
    // 為什麼要：整屏高是照「照片撐得起一整屏」挑的。可是這一段是左右各一半，右半只放
    // 店名一行加一句話的店，那半欄就有一大片空白，而「文字靠哪」那格能做的只是把字挪到
    // 上緣或下緣，空白還是那麼多。客人看完第一屏那幾個字得再滑一整個螢幕才碰得到下一段，
    // 中間全是空的。反過來，照片直式、字又寫了三四行的店，整屏高剛好，不該被動到。
    // 三檔動的是這一段的 min-height：
    //   content 不設下限（min-height: 0），高度由照片跟字自己撐——字少的店整段就收成
    //           照片那欄的高度，下一段直接接上來
    //   compact 70vh（比一個螢幕矮一截，但還留得住「這是開頭」的份量）
    //   normal  不覆寫（維持原本的整屏）
    // 只寫在 md 以上：手機是圖上文下的單欄堆疊，高度本來就是兩塊加起來，class 上那個
    // min-h-[80vh] 幾乎永遠碰不到（光滿寬的正方形照片就超過了），動它等於什麼都沒動。
    // 不覆寫那一檔連 attribute 都不輸出，既有店家的整屏原樣留著。
    heroSplitHeight: "content" | "compact" | "normal"; // split 區段高度（預設 normal = 不覆寫）
    // split 版型文字那半的底色。前面幾格把這一段的分法、高度、留白都開了，可是這半欄
    // 是什麼顏色一直是寫死的——整個 section 的 background 直接吃 theme.bg，也就是後面
    // 每一段的同一個底色。左半被照片蓋住看不出來，右半那一整塊就是全站底色，所以照片
    // 旁邊那半欄跟它底下的商品段、慢讀段之間沒有任何界線，往下捲的時候是一整片同色，
    // 開頭在哪裡結束看不出來。手機上更明顯：圖上文下堆疊，照片以下到頁尾全是同一塊色。
    // 為什麼開色碼欄位不開三檔（跟滿版圖那格「文字段底色」同一個判斷）：這格要的是
    // 「跟後面那段分得開」，而分得開又不打架的那個顏色跟店的調子有關（米白店往米色走、
    // 深色店往更深走），挑不出通用的三檔。
    // 只套在文字那半的 div 上，不套整個 section：套 section 會連照片那半一起換，而那半
    // 只有照片載入前那一瞬間看得到底色，換了等於什麼都沒換；真正要分開的是有字的那一半。
    // 沒設完全不覆寫（連 backgroundColor 都不輸出），既有店家算出來一模一樣。
    heroSplitTextBg: string | null;    // split 文字欄底色，hex；null = 跟全站底色
    // 雜誌版型上下那兩條橫線。整個版型的骨架就是這兩條線——上面那條把小標與店名那行
    // 框起來、下面那條把落款與按鈕那行框起來，中間才是大字，是它們讓這個版型看起來像
    // 一本雜誌的封面而不是一頁置中的字。可是兩條線的粗細與顏色都寫死（1px、theme.border），
    // 而 border 色是全站挑來畫卡片邊界的最淡的一階：
    // 1. 底色深一點的店（深綠、墨色）那兩條線直接看不見，版型的骨架整個消失，剩下中間
    //    一團大字浮在畫面中央；商家沒有一格動得到——「分隔線深淺」那組是各區段的控制，
    //    畫的是段落與段落之間那條，到不了 hero 裡面。
    // 2. 反過來想把這兩條線當設計元素（粗一點的黑線是雜誌封面很常見的做法）也沒有格子，
    //    1px 在大字旁邊細到像是沒對齊的痕跡。
    // 兩條線一起動不分開給：它們在版型裡是成對的（上下對稱框住中間），只加粗一條會變成
    // 沒關係的兩條線。粗細只給 1 / 2 / 3px——再粗就不是線是色塊，會跟中間的大字搶。
    // 深淺四檔跟各區段那組同一套口徑：strong 用全站文字色（跟字同深就一定看得見，深底
    // 淺字的店自動變淺線）、accent 用全站主色、faint 是原本那階再淡一半（給想留骨架但
    // 不想它出聲的店）。normal 完全不覆寫，既有店家算出來一模一樣。
    heroMagazineRuleWeight: "normal" | "medium" | "thick"; // 雜誌橫線粗細（預設 normal = 不覆寫）
    heroMagazineRuleTone: "normal" | "faint" | "strong" | "accent"; // 雜誌橫線深淺（預設 normal = 不覆寫）
    // 雜誌版型中間大字與上下兩條線之間的距離。這一段是 min-h-screen + justify-between：
    // 上面 metadata 一條線、下面 byline 一條線、中間一團大字，三塊被撐到整屏的兩端與中央，
    // 所以「線離字多遠」其實等於「這一段有多高」，而那個高度寫死成一整屏。桌機螢幕越高、
    // 那兩條線被推得越遠，只放一行主標的店會變成上下各一條貼著螢幕邊的線、中間浮著一團字，
    // 三塊看起來沒關係——而雜誌封面的樣子正是靠那兩條線框住中間的字才成立的。反過來主標加
    // 副標都寫滿的店，一整屏又剛好，所以不能直接改小。三檔動的是這一段的最低高度：
    // tight 不設（線貼著字，內容多高這段就多高，上下留 py 那層）、medium 七成屏、
    // normal 不覆寫（整屏）。不開任意數字：比一屏更高只是把後面的商品推得更遠。
    heroMagazineGap: "tight" | "medium" | "normal"; // 雜誌大字與上下橫線的距離（預設 normal = 不覆寫）
    // 同一個版型的下一格：中間大字那一層的欄寬。上下兩條線各自包在 max-w-6xl（72rem）
    // 裡、中間大字包在 max-w-5xl（64rem）裡，兩層不同寬是寫死的——主標長一點的店，字會排
    // 到比上下那兩條線更外面去，看起來像字撐破了框；而框住字正是這個版型唯一的結構。反過來
    // 只放兩三個字的店，64rem 讓那行字散在中間、跟兩條線的長度對不起來。四檔動的是這一層的
    // 上限：窄 48rem（字擠成一團、雜誌內頁那種窄欄）、跟預設不覆寫、跟橫線一樣寬 72rem
    // （字的左右兩端剛好切齊上下兩條線）、滿版不設上限（左右只剩全站邊界那道 padding）。
    heroMagazineTextWidth: "narrow" | "normal" | "rule" | "full"; // 雜誌中間大字欄寬（預設 normal = 不覆寫）
    // 上一格開的是中間那一層的欄寬，可是那一層裡面有兩行字：主標吃那一層的寬度，副標自己
    // 另外包了一個 max-w-xl（36rem）。兩個寬度是分開寫死的——主標放寬到跟橫線切齊或滿版
    // 之後，副標還是原本那條 36rem 的窄欄，變成上面一行很寬的大字、下面一條窄窄的小字，
    // 中軸對齊但左右兩端差很多，看起來像兩段沒關係的東西擺在一起。反過來主標選窄
    // （48rem）時，副標的 36rem 跟它差得不多、勉強還看得過去，所以這格不能直接跟著主標動，
    // 要分開給。四檔動的是副標那一層的上限：窄 28rem（副標只有一句話時收成一小條，
    // 跟上面的大字拉開層次）、跟預設不覆寫、寬 48rem、跟主標一樣寬（不設上限，直接吃上一
    // 層算出來的寬度，兩行字左右兩端切齊）。不開任意數字：這一層本來就被上一層框住，
    // 給的數字比上一層大也不會更寬，只會讓商家以為沒生效。
    heroMagazineSubtitleWidth: "narrow" | "normal" | "wide" | "title"; // 雜誌副標欄寬（預設 normal = 不覆寫）
    // 這一段內部剩下的三處間距：小標那行到上面那條線（mt-4）、主標到副標（mt-8）、
    // 下面那條線到落款那行（mb-4），全寫死在 class 上（1 / 2 / 1rem）。
    // 為什麼要：這個版型已經有的「大字與上下橫線的距離」動的是整段的最低高度，也就是
    // 那兩條線被推到多遠——三塊之間的空。可是每一塊自己裡面的疏密一格都沒有，而雜誌
    // 封面的樣子就是靠「線緊貼著那行小字、中間大字自己一團」這個對比撐起來的。主標字級
    // 那格拉大之後，主標跟副標之間只剩原本那 2rem，兩行字黏成一塊；同一時間上下那兩條
    // 線離小字還是原本的 1rem，中間那團越大、線那兩端越顯得薄。反過來「大字與上下橫線
    // 的距離」選了緊、想把整段收成一塊的店，外圈收了、裡面三處沒收，比例反而比預設更鬆。
    // 跟另外三個版型那格同口徑：三個值一起套同一個倍率（緊 0.5x / 鬆 1.75x），不拆成三格
    // 分開填——4 / 8 / 4 之間原本就有「線貼著小字、大字自己站開」的層次，拆開讓商家各填
    // 一個數字，那個層次第一次調就會壞掉。預設完全不輸出任何值，既有店家算出來一模一樣。
    heroMagazineTextGap: "tight" | "normal" | "loose"; // 雜誌版型內部間距（預設 normal = 不覆寫）
    // 雜誌版型整段的底色。這個版型跟 minimal 一樣沒有圖，畫面上只有兩條 1px 的線、
    // 中間一段大字，其餘全是底色——而那片底色一直寫死吃 theme.bg，跟底下的商品段、
    // 慢讀段、頁尾同一個顏色。雜誌封面的成立條件就是「整版一個色塊，線與字壓在上面」，
    // 底色跟後面每一段一樣的時候，那兩條線變成頁面中間兩條沒來由的橫線，客人看不出
    // 封面在哪裡結束。minimal 有「整段底色」、滿版圖有「文字段底色」、split 有「文字
    // 那半的底色」，四個版型裡只有雜誌一格都沒有。
    // 跟 minimal 那格同一個口徑：開色碼欄位不開三檔（要挑什麼顏色才跟後面分得開又
    // 不打架跟店的調子有關，挑不出通用的三檔），沒設完全不覆寫，既有店家算出來一樣。
    // 只給底色不給文字色：這個版型的字色已經有「主標顏色」「副標顏色」「小標顏色」
    // 「落款顏色」「橫線顏色」五格各自可調，深底要配的每一處都動得到，再開一格總文字色
    // 反而會跟那五格打架（誰贏誰輸講不清楚）。
    heroMagazineBg: string | null;     // 雜誌區段底色，hex；null = 跟全站底色
    // minimal 版型自己的兩個寫死參數：欄寬與上下留白。這個版型沒有圖、沒有線、沒有底色，
    // 只有置中的一段字，所以「字排多寬」跟「上下留多少空」就是它全部的設計——可是兩個值
    // 都寫死在 class 裡（max-w-3xl 的 48rem 欄寬、py-40 sm:py-56 的上下留白），前面開的
    // 字級字距那些格動的都是字本身，動不到字排的範圍。
    // 欄寬三檔：主標短的店（兩三個字的店名當主標）48rem 太寬，字擺在中間左右各空一大塊、
    // 讀起來像沒排完；反過來主標長或副標寫了三四行的店，48rem 會讓每行拖得很長，
    // 置中的長行讀起來要一直找行頭。narrow 36rem / normal 不覆寫 / wide 64rem。
    // 上下留白三檔：原本那個留白是配「一行大主標」挑的，加了副標、按鈕之後整段變高，
    // 上下再各留 14rem 會把後面的段落推到第二屏；反過來只放一行短主標時，留白不夠
    // 這個版型就不成立（它靠的就是空）。用 clamp 讓手機到桌機連續變化，不切斷點：
    //   compact  clamp(4rem, 10vw, 7rem)
    //   normal   不覆寫（吃原本的 py-40 sm:py-56）
    //   spacious clamp(14rem, 24vw, 20rem)
    heroMinimalWidth: "narrow" | "normal" | "wide"; // minimal 欄寬（預設 normal = 不覆寫）
    heroMinimalPadding: "compact" | "normal" | "spacious"; // minimal 上下留白（預設 normal = 不覆寫）
    // minimal 版型主標與按鈕之間那條短橫線。這個版型只有一段字，那條線是它唯一的
    // 圖形——它在做的是把上面的字跟下面的按鈕斷開，順便告訴人「這裡還沒完，往下有東西」。
    // 長度與顏色原本都寫死（48px、全站主色壓到半透明）。48px 是配「一行大主標」挑的，
    // 主標拉到最大或欄寬選寬的店，那條線在一整排大字底下細到像掃描沒掃乾淨的痕跡；
    // 反過來主標只有兩三個字又選窄欄的店，48px 幾乎跟主標一樣長，變成把字劃掉的一條線。
    // 長度給四檔，其中一檔是不顯示：有些店的 hero 只放一行店名、連按鈕都不要，那條線
    // 沒有東西要斷開，留著只是一個沒來由的裝飾。長度走 24 / 48 / 96 的倍數，
    // 不開任意數字（那條線超過欄寬一半就不再是分隔，是一條沒對齊的底線）。
    // 顏色開色碼欄位不開三檔：主色壓半透明在淺底店看起來是一條灰痕，而要挑什麼顏色
    // 才「看得見又不搶戲」跟店的調子有關，挑不出通用的三檔。有挑顏色就照挑的畫（不再
    // 壓半透明——半透明那層是為了讓沒挑色的店不被主色刺到，商家指定的顏色就是他要的）。
    heroMinimalRule: "none" | "short" | "normal" | "long"; // minimal 短橫線長度（預設 normal = 不覆寫）
    heroMinimalRuleColor: string | null; // minimal 短橫線顏色，hex；null = 全站主色壓半透明
    // minimal 版型「整段字靠哪邊」。前面幾格開的是這段字排多寬、上下留多少空、中間那條
    // 線多長什麼顏色，全部都在調「那一團字的框有多大」，可是字在框裡面靠哪一邊從頭到尾
    // 寫死置中（section 上一個 text-center，副標跟短橫線再各自 mx-auto 把自己推到中間）。
    // 「主標對齊」那格明講只在滿版圖版型生效，理由是 magazine / minimal 天生置中、套上
    // 預設值 left 會把現有店家的版型翻掉——那是為了不動到既有店家而留的洞，不是「這個
    // 版型不該能改」。這個版型沒有圖可看，一進站就是一整片空白配中間一段字，置中那版
    // 是海報、是開場白；靠左那版是信紙、是店主自己寫的一段話，兩種完全不同的調子，
    // 而想要後面那種的店現在一格都沒有。
    // 三檔跟「主標對齊」同一組字（靠左 / 置中 / 靠右），預設 center = 完全不覆寫，
    // 既有店家算出來一模一樣。不是只改 section 的 text-align 就好：副標的 mx-auto 跟
    // 短橫線的 mx-auto 是寫在 class 上的左右 auto 邊界，只改 text-align 的話字會靠左、
    // 但那條線跟那塊副標的區塊還留在中間，變成兩邊各對各的。所以靠左 / 靠右時要連
    // 那兩個 auto 一起蓋掉（inline 贏 class），三個東西才會對到同一條邊。
    heroMinimalAlign: "left" | "center" | "right"; // minimal 整段文字對齊（預設 center = 不覆寫）
    // minimal 版型整段的底色。這個版型沒有圖、沒有卡片、沒有色塊，一進站就是一片底色
    // 配中間一段字——那片底色就是它全部的畫面，可是它一直寫死吃 theme.bg，跟底下的
    // 商品段、慢讀段、頁尾同一個顏色。客人從 IG 點進來看到的是一整片同色從上捲到下，
    // 開頭那段在哪裡結束、下一段在哪裡開始完全看不出來，而這個版型又剛好是唯一沒有
    // 圖片、沒有橫線可以幫忙斷開的那一種。滿版圖版型有「文字段底色」、split 版型有
    // 「文字那半的底色」，兩格都在解同一件事，只有 minimal 一格都沒有。
    // 開色碼欄位不開三檔：要挑什麼顏色才「跟後面分得開又不打架」跟店的調子有關，
    // 挑不出通用的三檔；沒設完全不覆寫，既有店家算出來一模一樣。
    heroMinimalBg: string | null;      // minimal 區段底色，hex；null = 跟全站底色
    // minimal 版型內部那四段直向間距（小標到主標、主標到副標、副標到短橫線、短橫線到
    // 按鈕）。「上下留白」那格調的是整段字上下各離前後段多遠，這一格調的是這段字自己
    // 內部各行之間的疏密，兩件事互不相干卻只有前者能動：四個間距一直寫死在 class 上
    // （mb-8 / mt-8 / mt-10 / mt-12），是配「主標字級跟預設一樣大」挑的。主標字級那格
    // 拉到最大之後，一行大字跟下一行之間只剩原本那點空，整段擠成一團；反過來選了
    // 「上下留白：少」想把整段收緊的店，外圈收了、內部四段沒收，比例反而比預設更鬆。
    // 四個值一起用同一個倍率縮放（緊 0.5x / 鬆 1.75x），不是四格分開開——這四段之間
    // 原本就有 8 / 8 / 10 / 12 的層次（副標貼主標近、按鈕離得遠），拆成四格讓商家各填
    // 一個數字，那個層次第一次調就會壞掉。預設完全不輸出任何值，既有店家算出來一樣。
    heroMinimalGap: "tight" | "normal" | "loose"; // minimal 內部間距（預設 normal = 不覆寫）
    // 滿版圖版型底下那塊米色文字段的底色與內距。這個版型的圖是自適應 banner（圖以自身
    // 比例貼齊，不裁切也不覆蓋整屏），所以圖底下一定跟著一塊裝主標 / 副標 / 小標 / 按鈕
    // 的色塊——那塊色塊有多高、什麼顏色，是這個版型除了圖以外全部的版面。兩個值原本都
    // 寫死：底色直接吃 theme.bg（跟後面每一個段落同一個顏色，所以 hero 跟下一段之間沒有
    // 任何界線，整頁從圖以下變成一長條同色），內距寫死 px-6 sm:px-12 py-14 sm:py-20。
    // 底色開一個色碼欄位（不是三檔）：這塊要的是「跟後面那段分得開」，而分得開的那個
    // 顏色跟店的調子有關，挑不出通用的三檔；沒設完全不覆寫，既有店家算出來一模一樣。
    // 內距三檔只動上下不動左右：左右那兩個值是全站的邊界（跟導覽列、後面每一段對齊），
    // 只有這一段縮排會變成整頁唯一一段沒對齊的。
    //   compact  clamp(2rem, 5vw, 3rem)
    //   normal   不覆寫（吃原本的 py-14 sm:py-20）
    //   spacious clamp(6rem, 12vw, 9rem)
    heroTextBg: string | null;         // 滿版圖文字段底色，hex；null = 跟全站底色
    heroTextPadding: "compact" | "normal" | "spacious"; // 文字段上下內距（預設 normal = 不覆寫）
    // 同一塊文字段裡面那一層的最大寬度（原本寫死 max-w-4xl mx-auto = 56rem 置中）。
    // 上一格動的是那塊色塊有多高，這格動的是裡面的字排多寬——兩件不同的事：色塊是
    // 滿版的（左右貼齊全站邊界），字被關在中間 56rem 裡。56rem 是配「一行大主標」挑的，
    // 主標拉大或副標寫成兩三句的店，每一行會拖得很長，而這段又常是置中對齊的，
    // 長行置中讀起來每一行都要重新找行頭；反過來只放店名兩三個字的店，56rem 讓那塊
    // 色塊左右各空一大片，看起來像沒排完。多給一檔「滿版」：照片是整屏寬的，
    // 有些店要的是字跟照片同一個寬度、不要中間那塊看不見的欄。
    // 左右內距不開（那是跟導覽列與後面每一段對齊用的全站邊界，滿版檔也還是留著）。
    // 主標拖過位置的店這格不生效——那時整層是自由定位，沒有欄寬可言。
    //   narrow 40rem / normal 不覆寫（56rem）/ wide 72rem / full 不設上限
    heroTextWidth: "narrow" | "normal" | "wide" | "full"; // 文字段欄寬（預設 normal = 不覆寫）
    // 同一塊文字段裡面，小標、主標、副標、按鈕彼此之間隔多遠。原本寫死在 class 上
    //（小標 mb-6、副標 mt-5、按鈕 mt-8 = 1.5 / 1.25 / 2rem），是配預設主標字級挑的。
    // 為什麼要：這個版型已經有的兩格留白，一格管那塊色塊上下各留多少空、一格管裡面的字
    // 排多寬，兩格動的都是「這塊色塊的邊界離字有多遠」，字與字之間的疏密一格都沒有。
    // 主標字級那格拉大之後，一行大字跟下一行之間只剩原本那 1.25rem，字級越大越像黏在
    // 一起；而這一段跟另外兩個版型不一樣的地方是它上面就是一張滿版照片，照片本身已經
    // 是一整塊很滿的東西，底下那段字再擠成一團，整個開頭上下都沒有喘息的地方。反過來
    // 「文字段欄寬」選了滿版、字排到跟照片同寬的店，一行拉得很長、行與行之間卻還是原本
    // 那點空，上下顯得比左右擠。三檔跟 minimal / split 那兩格同口徑：三個值一起套同一個
    // 倍率（緊 0.5x / 鬆 1.75x），6 / 5 / 8 之間原本就有「副標貼主標近、按鈕離得遠」的
    // 層次，拆成三格讓商家各填一個數字，那個層次第一次調就會壞掉。
    // 主標拖過位置的店，那幾樣東西各自是自由定位的絕對座標，這格碰不到也不該碰。
    // 預設完全不輸出任何值，既有店家算出來一模一樣。
    heroTextGap: "tight" | "normal" | "loose"; // 滿版圖文字段內部間距（預設 normal = 不覆寫）
    // 滿版圖版型那張照片最高佔多少螢幕。這個版型的照片走的是自適應：client 端偵測圖片
    // 自帶的留白，把 banner 的比例算成「剛好框住主體」——好處是不論商家上傳哪種圖都不會
    // 把主體切掉，代價是照片有多高完全由那張圖的形狀決定，商家一格都碰不到。
    // 直式照片（手機直拍、1:1 以下）算出來的比例會讓 banner 比一個螢幕還高，客人一進站
    // 看到的是照片中間一塊，得先滑過整張圖才看得到店名、那句話跟按鈕；而「Hero 高度」
    // 那格給的是 min-height（這一段至少多高），只撐得開、壓不下來，照片高過那個值時
    // 那格等於沒有作用。
    // 三檔都是「最高不超過」，不是把照片拉成某個固定比例：圖本來就矮的店選了也不會變，
    // 只有算出來超過的才被收到上限，收的方式是照原本對齊主體的位置裁上下（跟自適應
    // 本來在做的事同一件），主體不會偏掉。
    // 預設不限＝完全不輸出 max-height，既有店家算出來一模一樣。
    heroImageMaxHeight: "none" | "screen" | "short"; // 滿版圖照片高度上限（預設 none = 不限）
    heroHeight: "auto" | "short" | "tall" | "full"; // 預設 auto（adaptive 比例）
    // 全網站
    fontScale: number;                 // 全網站字體 multiplier 0.8-1.3（預設 1.0）
    sectionPaddingScale: "compact" | "default" | "spacious"; // 區段上下空白
    // 按鈕圓角（pill 整顆圓的 / soft 微圓角 / square 直角）。全站的按鈕一律是 9999px 的
    // 藥丸形——那是寫死在 .sproutly-btn 上的一個值，從 hero 的「立即選購」、精選底下的
    // 「看所有的植物」，到商品頁的加入購物車、購物車的結帳、每一頁的表單送出，全部同一顆。
    // 藥丸形是有立場的形狀：柔、圓、偏生活風，配盆栽店剛好，配太和工房那種賣金屬水壺的
    // 器物店、或做工業風、日式極簡的店，圓到底的按鈕跟整站的方正線條對不起來。而按鈕是
    // 客人在一個頁面上唯一會按的東西，形狀不對整站就跟著不對。
    // 商家原本沒有一格動得到——「圓角」那欄（borderRadius）畫的是單一區段的外框、
    // 「卡片外觀」給的是卡片的邊界，兩個都不到按鈕身上；主色、字體那些換的是顏色與字，
    // 形狀一動也不動。
    // 走 CSS variable 不走 class：按鈕散在十幾個頁面（首頁、商品、購物車、結帳、會員、
    // 訂單追蹤）與好幾個 client component 裡，要改的話每一處都得傳 theme 進去；圓角掛在
    // 已經套在 root 的那組變數上，一個值全站到齊，沒設的店家 fallback 回原本的 9999px、
    // 算出來一模一樣。
    // 輸入框（.sproutly-input）不跟著動：那是另一種元素，商家想要方按鈕配圓搜尋框是合理的
    // 組合，等真有店家被「兩個形狀對不起來」卡到再補一格，不先替他決定。
    buttonRadius: "pill" | "soft" | "square";
    // 頁尾的底色與文字色。頁尾是每一頁的最後一塊（首頁、商品、購物車、結帳、會員、
    // 訂單追蹤全都掛著同一個），客人捲到底一定會看到它，而它到今天一格樣式都動不到——
    // 首頁十一個段落各自有底色、文字色、邊框、留白那整排控制，頁尾只有三個字串（Words /
    // Follow / 訂單追蹤那三行的字），顏色全部寫死。
    // 寫死的那組是「卡片底色 + 全站文字色」：頁尾坐的是 theme.surface，多數版型那是純白，
    // 底色是米色的店還分得出來，可是把全站底色也調成白的店（極簡、日式那類）從最後一段
    // 到頁尾是一整片白，只剩上面那條 1px 的線在撐——而頁尾正是網頁最常用深色收尾的地方，
    // 一塊深色在視覺上等於「這一頁到這裡結束」。
    // 商家原本想要深色頁尾，唯一動得到的是設定頁那格「卡片底色」——那一格同時是全站每張
    // 商品卡、每個面板、每張好評卡的底，改深一次全站的卡片一起變深，等於做不到。
    // 兩格一起開不是兩個功能：底色挑深了字沒跟著換就是一片看不見的深色，所以文字色跟著
    // 出。次要文字（營業時間、社群、版權那行）不另外挑，照各段落自訂文字色那套算——
    // 挑好的文字色的七成；上下那幾條短線同樣從文字色算（28%），商家只挑兩個值，頁尾裡
    // 六種深淺自己排好。點綴色（tagline 那行斜體與兩側短線）壓在深底上看不見時換成文字色，
    // 跟區段底色那套防呆同一個口徑。
    // 沒設完全不覆寫，既有店家的頁尾算出來一模一樣。
    footerBg: string | null;           // 頁尾底色，hex；null = 跟卡片底色（theme.surface）
    footerText: string | null;         // 頁尾文字色，hex；null = 跟全站文字色
    // Featured / Collections 顯示
    featuredCount: number;             // 顯示幾個商品 3-12（預設 6）
    featuredColumns: 2 | 3 | 4;        // 排成幾欄（預設 3）
    collectionsColumns: 2 | 3 | 4;     // 選物提案排成幾欄（預設 3）
    testimonialsColumns: 2 | 3 | 4;    // 好評卡排成幾欄（預設 3）
    statsColumns: 2 | 3 | 4;           // 數字排成幾欄（預設 4）
    galleryColumns: 2 | 3 | 4;         // 相簿排成幾欄（預設 3）
    journalColumns: 2 | 3;             // 慢讀卡排成幾欄（預設 3；固定三張卡，4 欄永遠填不滿所以不開）
    // 常見問題這段，客人一進來看到的是攤開的還是收起來的。
    // 為什麼要：這一段是商家開店的第一個理由——「客人問同樣的問題問到瘋」，價目、地址、
    // 營業時間寫在這裡就是要少回一次。可是每一題都寫死收起來，客人看到的是一排短句加一個
    // 加號，答案一個字都沒露出來。願意一題一題點開的人才讀得到，滑過去的人只知道「這家店
    // 有常見問題」，然後照樣去 IG 私訊問營業時間。
    // 三檔：
    //   none  全部收起來（現況，題數多的店掃起來最快）
    //   first 只攤開第一題（第一題通常就是最多人問的那題，順便讓客人看懂這排東西點得開）
    //   all   全部攤開（三五題的店最實用，整段直接變成一頁可以滑完的說明）
    // 不做「記住客人上次開哪幾題」：那要存到瀏覽器、還要處理商家改題目之後對不上的情況，
    // 而這一段的閱讀時間短到記不記得沒差。
    // 沒設就是 none，既有店家的常見問題長得一模一樣。
    faqDefaultOpen: "none" | "first" | "all"; // FAQ 預設攤開（預設 none）
    // 每個 section 的元素級樣式覆寫（北極星：超越 Wix 的元素級控制覆蓋率）
    sectionStyles: Record<string, SectionStyle>;
  };
}

export const HOMEPAGE_DEFAULT_COLLECTIONS: { key: string; title: string; subtitle: string }[] =
  [
    { key: "window", title: "給窗邊的", subtitle: "明亮散光也活得好" },
    { key: "living", title: "給客廳的", subtitle: "撐起整個空間" },
    { key: "desk", title: "給辦公桌的", subtitle: "小巧好顧" },
    { key: "bathroom", title: "給浴室的", subtitle: "潮濕也不怕" },
    { key: "nordic", title: "給北歐風的", subtitle: "搭淺木色家具" },
    { key: "japanese", title: "給日式空間的", subtitle: "配榻榻米和障子" },
  ];

// Journal 區段下方三張卡片的預設內容（商家沒填就顯示這組 placeholder）
export const JOURNAL_CARD_DEFAULTS: { eyebrow: string; title: string; excerpt: string }[] = [
  {
    eyebrow: "Care",
    title: "新手綠手指的第一步",
    excerpt: "光線、澆水頻率、換盆時機 — 把基本功講清楚，少走幾年彎路。",
  },
  {
    eyebrow: "Space",
    title: "把植物放進小空間",
    excerpt: "套房、租屋、窗台一隅，不同光線條件下的擺放提案。",
  },
  {
    eyebrow: "Story",
    title: "我們挑植物的方式",
    excerpt: "從花市到溫室，這些植物是怎麼被選進這間店的。",
  },
];

export const HOMEPAGE_DEFAULTS = {
  collectionsIntro: "告訴我們你的空間，我們幫你選對的那一株。",
  collectionsEyebrow: null as string | null,
  promise:
    "帶回家以後，我們不會消失。\n植物有狀況，傳訊息給我們。\n九十天內沒養活，原價換新一次。",
  promiseEyebrow: "Our Promise",
  featuredTitle: "本月選物",
  featuredEyebrow: null,
  featuredCta: "看所有的植物",
  visitTitle: "來店裡走走",
  visitEyebrow: "Visit",
  journalEyebrow: "Journal",
  journalTitle: "慢讀",
  journalSubtitle: "關於植物、空間，與這間店的日常筆記。",
  journalCardLabel: "Coming soon",
  testimonialsEyebrow: "Testimonials",
  testimonialsTitle: "顧客的話",
  faqEyebrow: "FAQ",
  faqTitle: "常見問題",
  galleryEyebrow: "Gallery",
  galleryTitle: "相片紀錄",
  partnersEyebrow: "As featured in",
  statsEyebrow: null,
  statsTitle: null,
  heroCta: "看商品",
  heroSecondaryCta: "關於我們",
  heroMagazineByline: null,
  collectionsCardCta: "看這個 →",
  aboutEyebrow: "About",
  aboutTitle: "關於我們",
  contactEyebrow: "Contact",
  contactTitle: "聯絡我們",
  shopEyebrow: "Shop",
  shopTitle: "所有商品",
  footerWordsLabel: "Words",
  footerFollowLabel: "Follow",
  footerTrackLabel: "Track · 訂單追蹤",
};

export const PRESETS: Record<PresetKey, Omit<StoreTheme, "preset" | "logoUrl" | "heroUrl" | "sections" | "social" | "tagline" | "collections" | "homepage" | "layout">> = {
  editorial: {
    primary: "#2C2C2C",
    accent: "#5F6F52",
    bg: "#F7F4ED",
    surface: "#FFFFFF",
    text: "#1A1A1A",
    textMuted: "#7A7570",
    border: "#E8E4DA",
    font: "noto-serif",
  },
  "plant-zen": {
    primary: "#3F5132",
    accent: "#C9A961",
    bg: "#FAF6EE",
    surface: "#FFFFFF",
    text: "#2E2A1F",
    textMuted: "#8B7F6A",
    border: "#E8DFD0",
    font: "cormorant",
  },
  nordic: {
    primary: "#6B4F3F",
    accent: "#D4A36A",
    bg: "#F4EFE8",
    surface: "#FFFFFF",
    text: "#2B2929",
    textMuted: "#857B72",
    border: "#E5DCD0",
    font: "playfair",
  },
  aesop: {
    primary: "#1A1A1A",
    accent: "#7A7A7A",
    bg: "#FAFAFA",
    surface: "#FFFFFF",
    text: "#1A1A1A",
    textMuted: "#666666",
    border: "#E5E5E5",
    font: "inter",
  },
  modern: {
    primary: "#10B981",
    accent: "#34D399",
    bg: "#ECFDF5",
    surface: "#FFFFFF",
    text: "#064E3B",
    textMuted: "#475569",
    border: "#D1FAE5",
    font: "inter",
  },
};

export const PRESET_LABELS: Record<PresetKey, { label: string; description: string }> = {
  editorial: { label: "雜誌風", description: "米白 + 墨綠，serif 大字，低彩度氣質" },
  "plant-zen": { label: "植物文青", description: "暖米黃 + 復古 serif，攝影感" },
  nordic: { label: "日系雜貨", description: "淺木色 + 圓潤暖調，質樸" },
  aesop: { label: "Aesop 精緻", description: "純白極簡 + 大留白，精品" },
  modern: { label: "現代漸層", description: "綠色漸層 + 玻璃質感，當代" },
};

export const FONT_LABELS: Record<FontKey, { label: string; family: string }> = {
  cormorant: { label: "Cormorant（西文典雅 serif）", family: "var(--font-cormorant), var(--font-noto-serif), serif" },
  playfair: { label: "Playfair（西文雜誌 serif）", family: "var(--font-playfair), var(--font-noto-serif), serif" },
  inter: { label: "Inter（西文現代 sans）", family: "var(--font-inter), var(--font-noto), system-ui, sans-serif" },
  noto: { label: "思源黑體（中文現代）", family: "var(--font-noto), system-ui, sans-serif" },
  "noto-serif": { label: "思源宋體（中文雜誌風）", family: "var(--font-noto-serif), 'Times New Roman', serif" },
  lora: { label: "Lora（西文文藝 serif）", family: "var(--font-lora), var(--font-noto-serif), serif" },
};

// 從 store.theme jsonb 計算最終主題（preset + 微調）
export function resolveTheme(raw: unknown): StoreTheme {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const preset = (typeof t.preset === "string" && t.preset in PRESETS
    ? t.preset
    : "aesop") as PresetKey;
  const base = PRESETS[preset];

  const fontKey = (typeof t.font === "string" && t.font in FONT_LABELS
    ? t.font
    : base.font) as FontKey;

  const sections = (t.sections && typeof t.sections === "object"
    ? (t.sections as Record<string, unknown>)
    : {}) as Record<string, boolean>;

  const social = (t.social && typeof t.social === "object"
    ? (t.social as Record<string, unknown>)
    : {}) as Record<string, string>;

  return {
    preset,
    primary: typeof t.primary === "string" ? t.primary : base.primary,
    accent: typeof t.accent === "string" ? t.accent : base.accent,
    bg: base.bg,
    surface: base.surface,
    text: base.text,
    textMuted: base.textMuted,
    border: base.border,
    font: fontKey,
    logoUrl: typeof t.logo_url === "string" && t.logo_url ? t.logo_url : null,
    heroUrl: typeof t.hero_url === "string" && t.hero_url ? t.hero_url : null,
    sections: {
      about: sections.about !== false,
      contact: sections.contact !== false,
      hours: sections.hours !== false,
      faq: sections.faq !== false,
      social: sections.social === true,
    },
    social: {
      instagram: typeof social.instagram === "string" && social.instagram ? social.instagram : null,
      facebook: typeof social.facebook === "string" && social.facebook ? social.facebook : null,
      line: typeof social.line === "string" && social.line ? social.line : null,
    },
    tagline: typeof t.tagline === "string" && t.tagline ? t.tagline : null,
    collections:
      t.collections && typeof t.collections === "object"
        ? Object.fromEntries(
            Object.entries(t.collections as Record<string, unknown>).filter(
              ([, v]) => typeof v === "string" && v.length > 0
            ) as [string, string][]
          )
        : {},
    homepage: resolveHomepage(t.homepage),
    layout: resolveLayout(t.layout),
  };
}

function resolveLayout(raw: unknown): StoreTheme["layout"] {
  const l = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const heroStyle = (typeof l.heroStyle === "string" &&
    HERO_STYLES.some((h) => h.key === l.heroStyle)
    ? l.heroStyle
    : "full-image") as HeroStyle;
  const heroImageSide =
    l.heroImageSide === "right" ? "right" : "left";
  const orderRaw = Array.isArray(l.sectionOrder) ? l.sectionOrder : [];
  const validKeys = new Set<SectionKey>([
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
  ]);
  const order: SectionKey[] = [];
  for (const k of orderRaw) {
    if (typeof k === "string" && validKeys.has(k as SectionKey) && !order.includes(k as SectionKey)) {
      order.push(k as SectionKey);
    }
  }
  // DEFAULT_SECTION_ORDER（基本必要 section）沒在 user order 內就 append
  // testimonials 不在 DEFAULT 內，商家手動加才會出現
  for (const k of DEFAULT_SECTION_ORDER) {
    if (!order.includes(k)) order.push(k);
  }
  // testimonials array sanitize
  const testimonialsRaw = Array.isArray(l.testimonials) ? l.testimonials : [];
  const testimonials: Testimonial[] = testimonialsRaw
    .filter((t) => t && typeof t === "object")
    .map((t) => {
      const obj = t as Record<string, unknown>;
      const quote = typeof obj.quote === "string" ? obj.quote.trim() : "";
      const author = typeof obj.author === "string" ? obj.author.trim() : "";
      const role = typeof obj.role === "string" && obj.role.trim() ? obj.role.trim() : null;
      return { quote, author, role };
    })
    .filter((t) => t.quote && t.author);

  // faqItems array sanitize
  const faqRaw = Array.isArray(l.faqItems) ? l.faqItems : [];
  const faqItems: FaqItem[] = faqRaw
    .filter((f) => f && typeof f === "object")
    .map((f) => {
      const obj = f as Record<string, unknown>;
      const question = typeof obj.question === "string" ? obj.question.trim() : "";
      const answer = typeof obj.answer === "string" ? obj.answer.trim() : "";
      return { question, answer };
    })
    .filter((f) => f.question && f.answer);

  // stats sanitize
  const statsRaw = Array.isArray(l.stats) ? l.stats : [];
  const stats: StatItem[] = statsRaw
    .filter((s) => s && typeof s === "object")
    .map((s) => {
      const obj = s as Record<string, unknown>;
      const value = typeof obj.value === "string" ? obj.value.trim() : "";
      const label = typeof obj.label === "string" ? obj.label.trim() : "";
      return { value, label };
    })
    .filter((s) => s.value && s.label);

  // partners sanitize
  const partnersRaw = Array.isArray(l.partners) ? l.partners : [];
  const partners: PartnerItem[] = partnersRaw
    .filter((p) => p && typeof p === "object")
    .map((p) => {
      const obj = p as Record<string, unknown>;
      const name = typeof obj.name === "string" ? obj.name.trim() : "";
      const logoUrl = typeof obj.logoUrl === "string" ? obj.logoUrl.trim() : "";
      const href = typeof obj.href === "string" && obj.href.trim() ? obj.href.trim() : null;
      return { name, logoUrl, href };
    })
    .filter((p) => p.name && p.logoUrl);

  // gallery sanitize
  const galleryRaw = Array.isArray(l.gallery) ? l.gallery : [];
  const gallery: GalleryItem[] = galleryRaw
    .filter((g) => g && typeof g === "object")
    .map((g) => {
      const obj = g as Record<string, unknown>;
      const url = typeof obj.url === "string" ? obj.url.trim() : "";
      const caption =
        typeof obj.caption === "string" && obj.caption.trim() ? obj.caption.trim() : null;
      return { url, caption };
    })
    .filter((g) => g.url);

  return {
    heroStyle,
    heroSubtitle:
      typeof l.heroSubtitle === "string" && l.heroSubtitle.trim()
        ? l.heroSubtitle.trim()
        : null,
    heroEyebrow:
      typeof l.heroEyebrow === "string" && l.heroEyebrow.trim()
        ? l.heroEyebrow.trim()
        : null,
    heroImageSide,
    sectionOrder: order,
    testimonials,
    faqItems,
    stats,
    partners,
    gallery,
    mapEmbedUrl:
      typeof l.mapEmbedUrl === "string" && l.mapEmbedUrl.trim()
        ? l.mapEmbedUrl.trim()
        : null,
    heroZoom: (() => {
      const z = l.heroZoom;
      if (typeof z !== "number" || !Number.isFinite(z)) return 1.0;
      return clampHeroZoom(z);
    })(),
    // Per-viewport zoom — 預設不同 viewport 套不同值修米色 strip
    // 沒設定就 fallback：若 legacy heroZoom 有值就用它，否則套各 viewport 預設
    heroZoomMobile: (() => {
      const z = l.heroZoomMobile;
      if (typeof z === "number" && Number.isFinite(z)) {
        return clampHeroZoom(z);
      }
      const fallback = l.heroZoom;
      if (typeof fallback === "number" && Number.isFinite(fallback)) {
        return clampHeroZoom(fallback);
      }
      return 1.5;
    })(),
    heroZoomTablet: (() => {
      const z = l.heroZoomTablet;
      if (typeof z === "number" && Number.isFinite(z)) {
        return clampHeroZoom(z);
      }
      const fallback = l.heroZoom;
      if (typeof fallback === "number" && Number.isFinite(fallback)) {
        return clampHeroZoom(fallback);
      }
      return 1.3;
    })(),
    heroZoomDesktop: (() => {
      const z = l.heroZoomDesktop;
      if (typeof z === "number" && Number.isFinite(z)) {
        return clampHeroZoom(z);
      }
      const fallback = l.heroZoom;
      if (typeof fallback === "number" && Number.isFinite(fallback)) {
        return clampHeroZoom(fallback);
      }
      return 1.0;
    })(),
    heroTaglineFontScale: (() => {
      const v = l.heroTaglineFontScale;
      if (typeof v !== "number" || !Number.isFinite(v)) return 1.0;
      return clampHeroFontScale(v);
    })(),
    heroTaglineColor: normalizeHexColor(l.heroTaglineColor),
    heroTaglineAlign: (() => {
      const v = l.heroTaglineAlign;
      if (v === "left" || v === "center" || v === "right") return v;
      return "left" as const;
    })(),
    heroTaglineWeight: (() => {
      const v = l.heroTaglineWeight;
      if (v === "normal" || v === "medium" || v === "bold") return v;
      return "normal" as const;
    })(),
    heroTaglineTracking: (() => {
      const v = l.heroTaglineTracking;
      if (v === "tight" || v === "normal" || v === "wide") return v;
      return "normal" as const;
    })(),
    heroTaglineLeading: (() => {
      const v = l.heroTaglineLeading;
      if (v === "tight" || v === "normal" || v === "relaxed") return v;
      return "normal" as const;
    })(),
    heroEyebrowFontScale: (() => {
      const v = l.heroEyebrowFontScale;
      if (typeof v !== "number" || !Number.isFinite(v)) return 1.0;
      return clampHeroFontScale(v);
    })(),
    heroEyebrowTracking: (() => {
      const v = l.heroEyebrowTracking;
      if (v === "tight" || v === "normal" || v === "wide") return v;
      return "normal" as const;
    })(),
    heroEyebrowColor: normalizeHexColor(l.heroEyebrowColor),
    heroEyebrowCase: (() => {
      const v = l.heroEyebrowCase;
      if (v === "upper" || v === "capitalize" || v === "none") return v;
      return "upper" as const;
    })(),
    heroEyebrowWeight: (() => {
      const v = l.heroEyebrowWeight;
      if (v === "normal" || v === "medium" || v === "bold") return v;
      return "normal" as const;
    })(),
    heroSubtitleFontScale: (() => {
      const v = l.heroSubtitleFontScale;
      if (typeof v !== "number" || !Number.isFinite(v)) return 1.0;
      return clampHeroFontScale(v);
    })(),
    heroSubtitleColor: normalizeHexColor(l.heroSubtitleColor),
    heroSubtitleAlign: (() => {
      const v = l.heroSubtitleAlign;
      if (v === "left" || v === "center" || v === "right") return v;
      return "inherit" as const;
    })(),
    heroSubtitleWeight: (() => {
      const v = l.heroSubtitleWeight;
      if (v === "normal" || v === "medium" || v === "bold") return v;
      return "normal" as const;
    })(),
    heroSubtitleTracking: (() => {
      const v = l.heroSubtitleTracking;
      if (v === "tight" || v === "normal" || v === "wide") return v;
      return "normal" as const;
    })(),
    heroSubtitleLeading: (() => {
      const v = l.heroSubtitleLeading;
      if (v === "tight" || v === "normal" || v === "relaxed") return v;
      return "normal" as const;
    })(),
    heroCtaFontScale: (() => {
      const v = l.heroCtaFontScale;
      if (typeof v !== "number" || !Number.isFinite(v)) return 1.0;
      return clampHeroFontScale(v);
    })(),
    heroCtaTracking: (() => {
      const v = l.heroCtaTracking;
      if (v === "tight" || v === "normal" || v === "wide") return v;
      return "normal" as const;
    })(),
    heroCtaCase: (() => {
      const v = l.heroCtaCase;
      if (v === "default" || v === "capitalize" || v === "none") return v;
      return "default" as const;
    })(),
    heroCtaWeight: (() => {
      const v = l.heroCtaWeight;
      if (v === "default" || v === "normal" || v === "medium" || v === "bold")
        return v;
      return "default" as const;
    })(),
    heroCtaColor: normalizeHexColor(l.heroCtaColor),
    heroBylineFontScale: (() => {
      const v = l.heroBylineFontScale;
      if (typeof v !== "number" || !Number.isFinite(v)) return 1.0;
      return clampHeroFontScale(v);
    })(),
    heroBylineColor: normalizeHexColor(l.heroBylineColor),
    heroBylineTracking: (() => {
      const v = l.heroBylineTracking;
      if (v === "tight" || v === "normal" || v === "wide") return v;
      return "normal" as const;
    })(),
    heroBylineCase: (() => {
      const v = l.heroBylineCase;
      if (v === "upper" || v === "capitalize" || v === "none") return v;
      return "upper" as const;
    })(),
    heroBylineWeight: (() => {
      const v = l.heroBylineWeight;
      if (v === "normal" || v === "medium" || v === "bold") return v;
      return "normal" as const;
    })(),
    heroSplitRatio: (() => {
      const v = l.heroSplitRatio;
      if (v === "image-narrow" || v === "image-wide") return v;
      return "normal" as const;
    })(),
    heroImageFocus: (() => {
      const v = l.heroImageFocus;
      if (v === "top" || v === "bottom") return v;
      return "center" as const;
    })(),
    heroSplitImageAspect: (() => {
      const v = l.heroSplitImageAspect;
      if (v === "tall" || v === "wide") return v;
      return "square" as const;
    })(),
    heroSplitTextAlign: (() => {
      const v = l.heroSplitTextAlign;
      if (v === "top" || v === "bottom") return v;
      return "center" as const;
    })(),
    heroSplitTextAlignX: (() => {
      const v = l.heroSplitTextAlignX;
      if (v === "center" || v === "right") return v;
      return "left" as const;
    })(),
    heroSplitTextPadding: (() => {
      const v = l.heroSplitTextPadding;
      if (v === "tight" || v === "roomy") return v;
      return "normal" as const;
    })(),
    heroSplitMobilePadY: (() => {
      const v = l.heroSplitMobilePadY;
      if (v === "tight" || v === "roomy") return v;
      return "normal" as const;
    })(),
    heroSplitGap: (() => {
      const v = l.heroSplitGap;
      if (v === "tight" || v === "loose") return v;
      return "normal" as const;
    })(),
    heroSplitMobileOrder: (() => {
      const v = l.heroSplitMobileOrder;
      if (v === "text-first") return v;
      return "image-first" as const;
    })(),
    heroSplitTextBg: normalizeHexColor(l.heroSplitTextBg),
    heroSplitHeight: (() => {
      const v = l.heroSplitHeight;
      if (v === "content" || v === "compact") return v;
      return "normal" as const;
    })(),
    heroMagazineRuleWeight: (() => {
      const v = l.heroMagazineRuleWeight;
      if (v === "medium" || v === "thick") return v;
      return "normal" as const;
    })(),
    heroMagazineRuleTone: (() => {
      const v = l.heroMagazineRuleTone;
      if (v === "faint" || v === "strong" || v === "accent") return v;
      return "normal" as const;
    })(),
    heroMagazineGap: (() => {
      const v = l.heroMagazineGap;
      if (v === "tight" || v === "medium") return v;
      return "normal" as const;
    })(),
    heroMagazineTextWidth: (() => {
      const v = l.heroMagazineTextWidth;
      if (v === "narrow" || v === "rule" || v === "full") return v;
      return "normal" as const;
    })(),
    heroMagazineSubtitleWidth: (() => {
      const v = l.heroMagazineSubtitleWidth;
      if (v === "narrow" || v === "wide" || v === "title") return v;
      return "normal" as const;
    })(),
    heroMagazineTextGap: (() => {
      const v = l.heroMagazineTextGap;
      if (v === "tight" || v === "loose") return v;
      return "normal" as const;
    })(),
    heroMagazineBg: normalizeHexColor(l.heroMagazineBg),
    heroMinimalWidth: (() => {
      const v = l.heroMinimalWidth;
      if (v === "narrow" || v === "wide") return v;
      return "normal" as const;
    })(),
    heroMinimalPadding: (() => {
      const v = l.heroMinimalPadding;
      if (v === "compact" || v === "spacious") return v;
      return "normal" as const;
    })(),
    heroMinimalRule: (() => {
      const v = l.heroMinimalRule;
      if (v === "none" || v === "short" || v === "long") return v;
      return "normal" as const;
    })(),
    heroMinimalRuleColor: normalizeHexColor(l.heroMinimalRuleColor),
    heroMinimalBg: normalizeHexColor(l.heroMinimalBg),
    heroMinimalGap: (() => {
      const v = l.heroMinimalGap;
      if (v === "tight" || v === "loose") return v;
      return "normal" as const;
    })(),
    heroMinimalAlign: (() => {
      const v = l.heroMinimalAlign;
      if (v === "left" || v === "right") return v;
      return "center" as const;
    })(),
    heroTextBg: normalizeHexColor(l.heroTextBg),
    heroTextPadding: (() => {
      const v = l.heroTextPadding;
      if (v === "compact" || v === "spacious") return v;
      return "normal" as const;
    })(),
    heroTextWidth: (() => {
      const v = l.heroTextWidth;
      if (v === "narrow" || v === "wide" || v === "full") return v;
      return "normal" as const;
    })(),
    heroTextGap: (() => {
      const v = l.heroTextGap;
      if (v === "tight" || v === "loose") return v;
      return "normal" as const;
    })(),
    heroImageMaxHeight: (() => {
      const v = l.heroImageMaxHeight;
      if (v === "screen" || v === "short") return v;
      return "none" as const;
    })(),
    heroHeight: (() => {
      const v = l.heroHeight;
      if (v === "short" || v === "tall" || v === "full" || v === "auto") return v;
      return "auto" as const;
    })(),
    fontScale: (() => {
      const v = l.fontScale;
      if (typeof v !== "number" || !Number.isFinite(v)) return 1.0;
      return clampFontScale(v);
    })(),
    sectionPaddingScale: (() => {
      const v = l.sectionPaddingScale;
      if (v === "compact" || v === "default" || v === "spacious") return v;
      return "default" as const;
    })(),
    buttonRadius: (() => {
      const v = l.buttonRadius;
      if (v === "pill" || v === "soft" || v === "square") return v;
      return "pill" as const;
    })(),
    footerBg: normalizeHexColor(l.footerBg),
    footerText: normalizeHexColor(l.footerText),
    featuredCount: (() => {
      const v = l.featuredCount;
      if (typeof v !== "number" || !Number.isFinite(v)) return 6;
      return clampFeaturedCount(v);
    })(),
    featuredColumns: (() => {
      const v = l.featuredColumns;
      if (v === 2 || v === 3 || v === 4) return v;
      return 3 as const;
    })(),
    collectionsColumns: (() => {
      const v = l.collectionsColumns;
      if (v === 2 || v === 3 || v === 4) return v;
      return 3 as const;
    })(),
    testimonialsColumns: (() => {
      const v = l.testimonialsColumns;
      if (v === 2 || v === 3 || v === 4) return v;
      return 3 as const;
    })(),
    statsColumns: (() => {
      const v = l.statsColumns;
      if (v === 2 || v === 3 || v === 4) return v;
      return 4 as const;
    })(),
    galleryColumns: (() => {
      const v = l.galleryColumns;
      if (v === 2 || v === 3 || v === 4) return v;
      return 3 as const;
    })(),
    journalColumns: (() => {
      const v = l.journalColumns;
      if (v === 2 || v === 3) return v;
      return 3 as const;
    })(),
    faqDefaultOpen: (() => {
      const v = l.faqDefaultOpen;
      if (v === "first" || v === "all") return v;
      return "none" as const;
    })(),
    // 欄位表與合法值都在 lib/section-style-schema，跟編輯器存檔那層走同一支——
    // 以前這裡跟 actions.ts 各手抄一條長判斷鏈，漏在哪一邊就是「控制看起來壞的」。
    sectionStyles: sanitizeSectionStyles(l.sectionStyles),
    freePositions: (() => {
      // 1. unified freePositions Record (preferred new path)
      const fp = l.freePositions;
      const result: Record<string, { x: number; y: number }> = {};
      if (fp && typeof fp === "object" && !Array.isArray(fp)) {
        for (const [k, v] of Object.entries(fp as Record<string, unknown>)) {
          if (!v || typeof v !== "object") continue;
          const obj = v as Record<string, unknown>;
          const x = typeof obj.x === "number" ? obj.x : NaN;
          const y = typeof obj.y === "number" ? obj.y : NaN;
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          result[k] = {
            x: clampFreePos(x),
            y: clampFreePos(y),
          };
        }
      }
      // 2. legacy fallback：把舊 heroTaglinePosition 自動 migrate 到 freePositions["hero-tagline"]
      const legacy = (l as { heroTaglinePosition?: unknown }).heroTaglinePosition;
      if (legacy && typeof legacy === "object" && !result["hero-tagline"]) {
        const obj = legacy as Record<string, unknown>;
        const x = typeof obj.x === "number" ? obj.x : NaN;
        const y = typeof obj.y === "number" ? obj.y : NaN;
        if (Number.isFinite(x) && Number.isFinite(y)) {
          result["hero-tagline"] = {
            x: clampFreePos(x),
            y: clampFreePos(y),
          };
        }
      }
      return result;
    })(),
  };
}

function resolveHomepage(raw: unknown): StoreTheme["homepage"] {
  const h = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(h.collectionItems) ? h.collectionItems : [];
  const items = itemsRaw
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const obj = c as Record<string, unknown>;
      return {
        key: typeof obj.key === "string" ? obj.key : "",
        title: typeof obj.title === "string" ? obj.title.trim() : "",
        subtitle: typeof obj.subtitle === "string" ? obj.subtitle.trim() : "",
      };
    })
    .filter((c) => c.key && c.title);
  const journalCardsRaw = Array.isArray(h.journalCards) ? h.journalCards : [];
  const journalCards = journalCardsRaw
    .filter((c) => c && typeof c === "object")
    .map((c) => {
      const obj = c as Record<string, unknown>;
      return {
        eyebrow: typeof obj.eyebrow === "string" ? obj.eyebrow.trim() : "",
        title: typeof obj.title === "string" ? obj.title.trim() : "",
        excerpt: typeof obj.excerpt === "string" ? obj.excerpt.trim() : "",
      };
    })
    .filter((c) => c.title || c.excerpt || c.eyebrow);
  return {
    collectionsIntro:
      typeof h.collectionsIntro === "string" && h.collectionsIntro.trim()
        ? h.collectionsIntro
        : null,
    collectionsEyebrow:
      typeof h.collectionsEyebrow === "string" && h.collectionsEyebrow.trim()
        ? h.collectionsEyebrow.trim()
        : null,
    collectionItems: items,
    promise:
      typeof h.promise === "string" && h.promise.trim() ? h.promise : null,
    promiseEyebrow:
      typeof h.promiseEyebrow === "string" && h.promiseEyebrow.trim()
        ? h.promiseEyebrow.trim()
        : null,
    featuredTitle:
      typeof h.featuredTitle === "string" && h.featuredTitle.trim()
        ? h.featuredTitle.trim()
        : null,
    featuredEyebrow:
      typeof h.featuredEyebrow === "string" && h.featuredEyebrow.trim()
        ? h.featuredEyebrow.trim()
        : null,
    featuredCta:
      typeof h.featuredCta === "string" && h.featuredCta.trim()
        ? h.featuredCta.trim()
        : null,
    visitTitle:
      typeof h.visitTitle === "string" && h.visitTitle.trim()
        ? h.visitTitle
        : null,
    visitEyebrow:
      typeof h.visitEyebrow === "string" && h.visitEyebrow.trim()
        ? h.visitEyebrow.trim()
        : null,
    journalEyebrow:
      typeof h.journalEyebrow === "string" && h.journalEyebrow.trim()
        ? h.journalEyebrow.trim()
        : null,
    journalTitle:
      typeof h.journalTitle === "string" && h.journalTitle.trim()
        ? h.journalTitle.trim()
        : null,
    journalSubtitle:
      typeof h.journalSubtitle === "string" && h.journalSubtitle.trim()
        ? h.journalSubtitle.trim()
        : null,
    journalCardLabel:
      typeof h.journalCardLabel === "string" && h.journalCardLabel.trim()
        ? h.journalCardLabel.trim()
        : null,
    journalCards,
    testimonialsEyebrow:
      typeof h.testimonialsEyebrow === "string" && h.testimonialsEyebrow.trim()
        ? h.testimonialsEyebrow.trim()
        : null,
    testimonialsTitle:
      typeof h.testimonialsTitle === "string" && h.testimonialsTitle.trim()
        ? h.testimonialsTitle.trim()
        : null,
    faqEyebrow:
      typeof h.faqEyebrow === "string" && h.faqEyebrow.trim()
        ? h.faqEyebrow.trim()
        : null,
    faqTitle:
      typeof h.faqTitle === "string" && h.faqTitle.trim()
        ? h.faqTitle.trim()
        : null,
    galleryEyebrow:
      typeof h.galleryEyebrow === "string" && h.galleryEyebrow.trim()
        ? h.galleryEyebrow.trim()
        : null,
    galleryTitle:
      typeof h.galleryTitle === "string" && h.galleryTitle.trim()
        ? h.galleryTitle.trim()
        : null,
    partnersEyebrow:
      typeof h.partnersEyebrow === "string" && h.partnersEyebrow.trim()
        ? h.partnersEyebrow.trim()
        : null,
    statsEyebrow:
      typeof h.statsEyebrow === "string" && h.statsEyebrow.trim()
        ? h.statsEyebrow.trim()
        : null,
    statsTitle:
      typeof h.statsTitle === "string" && h.statsTitle.trim()
        ? h.statsTitle.trim()
        : null,
    heroCta:
      typeof h.heroCta === "string" && h.heroCta.trim()
        ? h.heroCta.trim()
        : null,
    heroMagazineByline:
      typeof h.heroMagazineByline === "string" && h.heroMagazineByline.trim()
        ? h.heroMagazineByline.trim()
        : null,
    heroSecondaryCta:
      typeof h.heroSecondaryCta === "string" && h.heroSecondaryCta.trim()
        ? h.heroSecondaryCta.trim()
        : null,
    collectionsCardCta:
      typeof h.collectionsCardCta === "string" && h.collectionsCardCta.trim()
        ? h.collectionsCardCta.trim()
        : null,
    aboutEyebrow:
      typeof h.aboutEyebrow === "string" && h.aboutEyebrow.trim()
        ? h.aboutEyebrow.trim()
        : null,
    aboutTitle:
      typeof h.aboutTitle === "string" && h.aboutTitle.trim()
        ? h.aboutTitle.trim()
        : null,
    contactEyebrow:
      typeof h.contactEyebrow === "string" && h.contactEyebrow.trim()
        ? h.contactEyebrow.trim()
        : null,
    contactTitle:
      typeof h.contactTitle === "string" && h.contactTitle.trim()
        ? h.contactTitle.trim()
        : null,
    shopEyebrow:
      typeof h.shopEyebrow === "string" && h.shopEyebrow.trim()
        ? h.shopEyebrow.trim()
        : null,
    shopTitle:
      typeof h.shopTitle === "string" && h.shopTitle.trim()
        ? h.shopTitle.trim()
        : null,
    footerWordsLabel:
      typeof h.footerWordsLabel === "string" && h.footerWordsLabel.trim()
        ? h.footerWordsLabel.trim()
        : null,
    footerFollowLabel:
      typeof h.footerFollowLabel === "string" && h.footerFollowLabel.trim()
        ? h.footerFollowLabel.trim()
        : null,
    footerTrackLabel:
      typeof h.footerTrackLabel === "string" && h.footerTrackLabel.trim()
        ? h.footerTrackLabel.trim()
        : null,
    enableAnimation: h.enableAnimation === false ? false : true, // default true
  };
}

// 從 theme 物件產生 CSS variables（套到 layout root style）
export function themeToCssVars(theme: StoreTheme): React.CSSProperties {
  // 區段上下空白 → padding multiplier
  const sectionPad =
    theme.layout.sectionPaddingScale === "compact"
      ? 0.6
      : theme.layout.sectionPaddingScale === "spacious"
      ? 1.4
      : 1.0;
  // 按鈕圓角 → 一個長度值，.sproutly-btn 讀它。soft 給 8px 不給更大：按鈕本身只有 44px
  // 上下高，圓角一過 12px 兩端的弧就接起來、又變回藥丸的樣子，中間那一檔就白給了。
  const btnRadius =
    theme.layout.buttonRadius === "square"
      ? "0px"
      : theme.layout.buttonRadius === "soft"
      ? "8px"
      : "9999px";
  return {
    "--store-primary": theme.primary,
    "--store-accent": theme.accent,
    "--store-bg": theme.bg,
    "--store-surface": theme.surface,
    "--store-text": theme.text,
    "--store-text-muted": theme.textMuted,
    "--store-border": theme.border,
    "--store-font": FONT_LABELS[theme.font].family,
    // 全網站字體 scale — body 套用
    fontSize: `${theme.layout.fontScale * 100}%`,
    "--store-section-pad": String(sectionPad),
    "--store-btn-radius": btnRadius,
  } as React.CSSProperties;
}
