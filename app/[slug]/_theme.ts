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
    // Featured / Collections 顯示
    featuredCount: number;             // 顯示幾個商品 3-12（預設 6）
    featuredColumns: 2 | 3 | 4;        // 排成幾欄（預設 3）
    collectionsColumns: 2 | 3 | 4;     // 選物提案排成幾欄（預設 3）
    testimonialsColumns: 2 | 3 | 4;    // 好評卡排成幾欄（預設 3）
    statsColumns: 2 | 3 | 4;           // 數字排成幾欄（預設 4）
    galleryColumns: 2 | 3 | 4;         // 相簿排成幾欄（預設 3）
    journalColumns: 2 | 3;             // 慢讀卡排成幾欄（預設 3；固定三張卡，4 欄永遠填不滿所以不開）
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
