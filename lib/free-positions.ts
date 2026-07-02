// 自由定位（拖動版位）的 element key，全站只認這一份。
//
// 這組 key 同時出現在三個地方，字串對不上任何一邊就整條斷：
//   1. 公開頁 markup 的 data-edit-drag 屬性（app/[slug]/page.tsx）——拖動的目標。
//   2. 拖完存進 theme.layout.freePositions 的 key（editor-click-bridge 讀屬性值回報）。
//   3. render 時 freePositions[key] 的 lookup（page.tsx 決定走 absolute 分支）。
//
// 為什麼有 -v2：第一代 key（collection-intro 等六個）在 beta 期存進 DB 的殘留座標
// 會在 SSR 就把元素 absolute 到奇怪的位置、跟別的區塊重疊（3b081e7 因此全面停用）。
// 重開時 key 換代——舊座標掛在舊 key 下，render 端查新 key 查不到就走正常 flow，
// 等於不用碰 DB 就把殘留座標全部作廢；新拖動才會寫進新 key。
// hero-tagline 從頭到尾沒停用（一直只綁 h1、行為正常），維持原 key 不換代。
export const FREE_POS_KEYS = {
  heroTagline: "hero-tagline",
  // 副標是主標之後才開拖動的，停用風波（3b081e7）時沒有這個 key，
  // DB 不可能有殘留座標，跟 faq-intro 那批一樣不用 -v2 換代。
  heroSubtitle: "hero-subtitle",
  // CTA 按鈕跟副標同期之後才開拖動，同理不用 -v2 換代。
  heroCta: "hero-cta",
  collectionIntro: "collection-intro-v2",
  featuredTitle: "featured-title-v2",
  journalIntro: "journal-intro-v2",
  promiseCard: "promise-card-v2",
  visitCard: "visit-card-v2",
  testimonialsTitle: "testimonials-title-v2",
  // 下面四個是後來才開拖動的區段，第一代停用風波（3b081e7）時根本還沒有
  // 這些 key，DB 不可能有殘留座標，所以不用 -v2 換代。
  faqIntro: "faq-intro",
  statsIntro: "stats-intro",
  partnersEyebrow: "partners-eyebrow",
  galleryIntro: "gallery-intro",
} as const;

// 停用世代留在 DB 的殘留 key（含更早期的 featured-h2 命名）。
// render 端已經不認得它們，但每次存檔會把整份 freePositions 原樣送回去，
// 不清掉就永遠躺在 DB 裡。編輯器組存檔 payload 時用 stripLegacyFreePositions
// 過濾，第一次存檔就順手把垃圾座標掃乾淨。
const LEGACY_FREE_POS_KEYS = [
  "collection-intro",
  "featured-title",
  "featured-h2",
  "journal-intro",
  "promise-card",
  "visit-card",
  "testimonials-title",
];

export function stripLegacyFreePositions(
  fp: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  const out = { ...fp };
  for (const k of LEGACY_FREE_POS_KEYS) delete out[k];
  return out;
}

// 每個區段可拖動的元素——編輯器「版位」重設 UI 靠這張表知道
// 選中的區段對應哪個 key、跟使用者講人話時叫它什麼。
// hero 不在表裡：hero 的版位 UI 在自己的 panel（跟 heroStyle 綁一起）。
export const SECTION_DRAG_ELEMENT: Record<
  string,
  { key: string; label: string } | undefined
> = {
  collections: { key: FREE_POS_KEYS.collectionIntro, label: "開頭文字" },
  featured: { key: FREE_POS_KEYS.featuredTitle, label: "區段標題" },
  journal: { key: FREE_POS_KEYS.journalIntro, label: "開頭文字" },
  promise: { key: FREE_POS_KEYS.promiseCard, label: "引言卡片" },
  visit: { key: FREE_POS_KEYS.visitCard, label: "資訊卡片" },
  testimonials: { key: FREE_POS_KEYS.testimonialsTitle, label: "區段標題" },
  faq: { key: FREE_POS_KEYS.faqIntro, label: "開頭文字" },
  stats: { key: FREE_POS_KEYS.statsIntro, label: "開頭文字" },
  partners: { key: FREE_POS_KEYS.partnersEyebrow, label: "開頭小字" },
  gallery: { key: FREE_POS_KEYS.galleryIntro, label: "開頭文字" },
};
