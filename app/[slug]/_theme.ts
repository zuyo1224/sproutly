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
    collectionItems: Array<{ key: string; title: string; subtitle: string }>;
    promise: string | null;
    visitTitle: string | null;
    enableAnimation: boolean;
  };
  layout: {
    heroStyle: HeroStyle;
    heroSubtitle: string | null;       // minimal / magazine 用副標
    heroEyebrow: string | null;        // magazine top metadata
    heroImageSide: "left" | "right";   // split 用
    sectionOrder: SectionKey[];
    testimonials: Testimonial[];       // 顧客評語（optional block）
    faqItems: FaqItem[];               // 首頁 FAQ（optional block；和現有 about/contact FAQ 分開）
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

export const HOMEPAGE_DEFAULTS = {
  collectionsIntro: "告訴我們你的空間，我們幫你選對的那一株。",
  promise:
    "帶回家以後，我們不會消失。\n植物有狀況，傳訊息給我們。\n九十天內沒養活，原價換新一次。",
  visitTitle: "來店裡走走",
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
  return {
    collectionsIntro:
      typeof h.collectionsIntro === "string" && h.collectionsIntro.trim()
        ? h.collectionsIntro
        : null,
    collectionItems: items,
    promise:
      typeof h.promise === "string" && h.promise.trim() ? h.promise : null,
    visitTitle:
      typeof h.visitTitle === "string" && h.visitTitle.trim()
        ? h.visitTitle
        : null,
    enableAnimation: h.enableAnimation === false ? false : true, // default true
  };
}

// 從 theme 物件產生 CSS variables（套到 layout root style）
export function themeToCssVars(theme: StoreTheme): React.CSSProperties {
  return {
    "--store-primary": theme.primary,
    "--store-accent": theme.accent,
    "--store-bg": theme.bg,
    "--store-surface": theme.surface,
    "--store-text": theme.text,
    "--store-text-muted": theme.textMuted,
    "--store-border": theme.border,
    "--store-font": FONT_LABELS[theme.font].family,
  } as React.CSSProperties;
}
