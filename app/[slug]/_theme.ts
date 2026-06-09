// 公開店面主題系統：4 個 preset + 商家可微調主色 / 強調色 / 字體 / Logo / Hero / Section 開關 / 社群連結 / 標語

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
    heroHeight: "auto" | "short" | "tall" | "full"; // 預設 auto（adaptive 比例）
    // 全網站
    fontScale: number;                 // 全網站字體 multiplier 0.8-1.3（預設 1.0）
    sectionPaddingScale: "compact" | "default" | "spacious"; // 區段上下空白
    // Featured / Collections 顯示
    featuredCount: number;             // 顯示幾個商品 3-12（預設 6）
    featuredColumns: 2 | 3 | 4;        // 排成幾欄（預設 3）
    collectionsColumns: 2 | 3 | 4;     // 選物提案排成幾欄（預設 3）
    // 每個 section 的元素級樣式覆寫（北極星：超越 Wix 的元素級控制覆蓋率）
    sectionStyles: Record<string, {
      headingAlign?: "left" | "center" | "right";
      bgColor?: string | null;          // null = 用 theme.bg；hex = 覆寫
      textColor?: string | null;        // null = 用 theme.text；hex = 覆寫（深底配淺字常用）
      paddingScale?: "compact" | "default" | "spacious"; // 該 section 獨立上下空白（覆寫全網站值）
      divider?: "none" | "top" | "bottom" | "both"; // 分隔線（上 / 下 / 上下都有 / 沒有）
      headingScale?: "small" | "default" | "large"; // 該 section 標題字級（small 0.85x / default 1x / large 1.25x）
      minHeight?: "auto" | "tall" | "fullscreen"; // 該 section 最低高度（auto 不限制 / tall 80vh / fullscreen 100vh）
      outline?: "none" | "subtle" | "strong"; // 該 section 外框（subtle 1px / strong 2px，用 outline 避免跟 divider borderTop/Bottom 打架）
      shadow?: "none" | "soft" | "deep"; // 該 section 陰影（soft 淺 / deep 深），讓有 bgColor 的 section 像卡片浮起
      borderRadius?: "none" | "soft" | "strong"; // 該 section 圓角（soft 16px / strong 32px），跟 bgColor + outline + shadow 三件套組成卡片風
      entrance?: "none" | "fade" | "slide-up"; // 該 section 進場動畫（fade 淡入 / slide-up 上滑），靠 CSS scroll-driven 觸發，edit mode 內 disable
      fontFamily?: "default" | "serif" | "sans"; // 該 section 字體（default 跟全網站 / serif 思源宋體 / sans 思源黑體），讓某段獨立切字體做雜誌 / 現代風對比
      letterSpacing?: "tight" | "normal" | "wide"; // 該 section 字距（tight -0.02em / normal 預設 / wide 0.1em），雜誌大標常見 wide
      lineHeight?: "tight" | "normal" | "relaxed"; // 該 section 行高（tight 1.4 緊湊 / normal 預設不套 / relaxed 2.0 舒展），給內文段落獨立調整呼吸感
      opacity?: "default" | "muted" | "faint"; // 該 section 淡化（default 不套 / muted 0.85 / faint 0.7），讓 partners / stats / faq 次要 section 變淡，襯托 hero / featured 跳出
      filter?: "none" | "grayscale" | "sepia"; // 該 section 濾鏡（grayscale 黑白 / sepia 復古褐），用 CSS filter 套整段含 children，partners / gallery / hero 套黑白做雜誌感
    }>;
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
      return Math.max(1.0, Math.min(2.5, z));
    })(),
    // Per-viewport zoom — 預設不同 viewport 套不同值修米色 strip
    // 沒設定就 fallback：若 legacy heroZoom 有值就用它，否則套各 viewport 預設
    heroZoomMobile: (() => {
      const z = l.heroZoomMobile;
      if (typeof z === "number" && Number.isFinite(z)) {
        return Math.max(1.0, Math.min(2.5, z));
      }
      const fallback = l.heroZoom;
      if (typeof fallback === "number" && Number.isFinite(fallback)) {
        return Math.max(1.0, Math.min(2.5, fallback));
      }
      return 1.5;
    })(),
    heroZoomTablet: (() => {
      const z = l.heroZoomTablet;
      if (typeof z === "number" && Number.isFinite(z)) {
        return Math.max(1.0, Math.min(2.5, z));
      }
      const fallback = l.heroZoom;
      if (typeof fallback === "number" && Number.isFinite(fallback)) {
        return Math.max(1.0, Math.min(2.5, fallback));
      }
      return 1.3;
    })(),
    heroZoomDesktop: (() => {
      const z = l.heroZoomDesktop;
      if (typeof z === "number" && Number.isFinite(z)) {
        return Math.max(1.0, Math.min(2.5, z));
      }
      const fallback = l.heroZoom;
      if (typeof fallback === "number" && Number.isFinite(fallback)) {
        return Math.max(1.0, Math.min(2.5, fallback));
      }
      return 1.0;
    })(),
    heroTaglineFontScale: (() => {
      const v = l.heroTaglineFontScale;
      if (typeof v !== "number" || !Number.isFinite(v)) return 1.0;
      return Math.max(0.6, Math.min(1.8, v));
    })(),
    heroTaglineColor: (() => {
      const v = l.heroTaglineColor;
      if (typeof v !== "string") return null;
      return /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : null;
    })(),
    heroTaglineAlign: (() => {
      const v = l.heroTaglineAlign;
      if (v === "left" || v === "center" || v === "right") return v;
      return "left" as const;
    })(),
    heroHeight: (() => {
      const v = l.heroHeight;
      if (v === "short" || v === "tall" || v === "full" || v === "auto") return v;
      return "auto" as const;
    })(),
    fontScale: (() => {
      const v = l.fontScale;
      if (typeof v !== "number" || !Number.isFinite(v)) return 1.0;
      return Math.max(0.8, Math.min(1.3, v));
    })(),
    sectionPaddingScale: (() => {
      const v = l.sectionPaddingScale;
      if (v === "compact" || v === "default" || v === "spacious") return v;
      return "default" as const;
    })(),
    featuredCount: (() => {
      const v = l.featuredCount;
      if (typeof v !== "number" || !Number.isFinite(v)) return 6;
      return Math.max(3, Math.min(12, Math.floor(v)));
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
    sectionStyles: (() => {
      const raw = l.sectionStyles;
      const result: Record<string, { headingAlign?: "left" | "center" | "right"; bgColor?: string | null; textColor?: string | null; paddingScale?: "compact" | "default" | "spacious"; divider?: "none" | "top" | "bottom" | "both"; headingScale?: "small" | "default" | "large"; minHeight?: "auto" | "tall" | "fullscreen"; outline?: "none" | "subtle" | "strong"; shadow?: "none" | "soft" | "deep"; borderRadius?: "none" | "soft" | "strong"; entrance?: "none" | "fade" | "slide-up"; fontFamily?: "default" | "serif" | "sans"; letterSpacing?: "tight" | "normal" | "wide"; lineHeight?: "tight" | "normal" | "relaxed"; opacity?: "default" | "muted" | "faint"; filter?: "none" | "grayscale" | "sepia" }> = {};
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (!v || typeof v !== "object" || typeof k !== "string") continue;
          const obj = v as Record<string, unknown>;
          const entry: { headingAlign?: "left" | "center" | "right"; bgColor?: string | null; textColor?: string | null; paddingScale?: "compact" | "default" | "spacious"; divider?: "none" | "top" | "bottom" | "both"; headingScale?: "small" | "default" | "large"; minHeight?: "auto" | "tall" | "fullscreen"; outline?: "none" | "subtle" | "strong"; shadow?: "none" | "soft" | "deep"; borderRadius?: "none" | "soft" | "strong"; entrance?: "none" | "fade" | "slide-up"; fontFamily?: "default" | "serif" | "sans"; letterSpacing?: "tight" | "normal" | "wide"; lineHeight?: "tight" | "normal" | "relaxed"; opacity?: "default" | "muted" | "faint"; filter?: "none" | "grayscale" | "sepia" } = {};
          if (obj.headingAlign === "left" || obj.headingAlign === "center" || obj.headingAlign === "right") {
            entry.headingAlign = obj.headingAlign;
          }
          if (typeof obj.bgColor === "string" && /^#[0-9a-fA-F]{6}$/.test(obj.bgColor.trim())) {
            entry.bgColor = obj.bgColor.trim();
          } else if (obj.bgColor === null) {
            entry.bgColor = null;
          }
          if (typeof obj.textColor === "string" && /^#[0-9a-fA-F]{6}$/.test(obj.textColor.trim())) {
            entry.textColor = obj.textColor.trim();
          } else if (obj.textColor === null) {
            entry.textColor = null;
          }
          if (obj.paddingScale === "compact" || obj.paddingScale === "default" || obj.paddingScale === "spacious") {
            entry.paddingScale = obj.paddingScale;
          }
          if (obj.divider === "none" || obj.divider === "top" || obj.divider === "bottom" || obj.divider === "both") {
            entry.divider = obj.divider;
          }
          if (obj.headingScale === "small" || obj.headingScale === "default" || obj.headingScale === "large") {
            entry.headingScale = obj.headingScale;
          }
          if (obj.minHeight === "auto" || obj.minHeight === "tall" || obj.minHeight === "fullscreen") {
            entry.minHeight = obj.minHeight;
          }
          if (obj.outline === "none" || obj.outline === "subtle" || obj.outline === "strong") {
            entry.outline = obj.outline;
          }
          if (obj.shadow === "none" || obj.shadow === "soft" || obj.shadow === "deep") {
            entry.shadow = obj.shadow;
          }
          if (obj.borderRadius === "none" || obj.borderRadius === "soft" || obj.borderRadius === "strong") {
            entry.borderRadius = obj.borderRadius;
          }
          if (obj.entrance === "none" || obj.entrance === "fade" || obj.entrance === "slide-up") {
            entry.entrance = obj.entrance;
          }
          if (obj.fontFamily === "default" || obj.fontFamily === "serif" || obj.fontFamily === "sans") {
            entry.fontFamily = obj.fontFamily;
          }
          if (obj.letterSpacing === "tight" || obj.letterSpacing === "normal" || obj.letterSpacing === "wide") {
            entry.letterSpacing = obj.letterSpacing;
          }
          if (obj.lineHeight === "tight" || obj.lineHeight === "normal" || obj.lineHeight === "relaxed") {
            entry.lineHeight = obj.lineHeight;
          }
          if (obj.opacity === "default" || obj.opacity === "muted" || obj.opacity === "faint") {
            entry.opacity = obj.opacity;
          }
          if (obj.filter === "none" || obj.filter === "grayscale" || obj.filter === "sepia") {
            entry.filter = obj.filter;
          }
          if (entry.headingAlign !== undefined || entry.bgColor !== undefined || entry.textColor !== undefined || entry.paddingScale !== undefined || entry.divider !== undefined || entry.headingScale !== undefined || entry.minHeight !== undefined || entry.outline !== undefined || entry.shadow !== undefined || entry.borderRadius !== undefined || entry.entrance !== undefined || entry.fontFamily !== undefined || entry.letterSpacing !== undefined || entry.lineHeight !== undefined || entry.opacity !== undefined || entry.filter !== undefined) {
            result[k] = entry;
          }
        }
      }
      return result;
    })(),
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
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
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
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
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
  } as React.CSSProperties;
}
