// 店家基本資料（店名／店介紹／電話／信箱／地址）的字數上限，開店頁與店面設定頁的表單
// （瀏覽器端 maxLength）跟兩支 Server Action（createStore / updateStore）共用同一份數字。
//
// 以前 new-store 只擋了 slug 3–32 字、settings 只擋空店名，這五欄長度哪裡都沒擋。DB
// 五欄都是 text，塞多長都不會爆，問題在顯示端：店名會進 <title>、店面 header、OG 圖、
// sitemap、後台店家列表；描述整段印在店面「關於」區；電話／地址印在聯絡區跟 footer。
// 一串幾百字的店名會把 header 撐爆、讓螢幕閱讀器一口氣唸一整段。
//
// 數字跟視覺編輯器那邊的 sanitize 對齊：店名 60 字（editor 各 section 小標同數字）、
// 描述 2000 字（跟 promise / 常見問題答案同數字）。電話給 40 字（「02-2345-6789 分機
// 123」這種帶分機的寫法還放得下）、信箱 254 字（RFC 5321 的信箱長度上限）、地址 200 字
// （跟 gallery caption 同數字，台灣含樓層的完整地址不到 60 字）。兩邊都用 JS 的 .length
// （UTF-16 code unit）算，跟瀏覽器 maxLength 的算法一致，不會出現「瀏覽器放行、伺服器
// 退回」或反過來的對不上。
//
// "use server" 的模組只准 export async function，常數放不進 actions.ts 給頁面 import，
// 所以才另開這支純資料檔（跟 product-limits 同一種做法）。
export const MAX_STORE_NAME_LEN = 60;
export const MAX_STORE_DESC_LEN = 2000;
export const MAX_STORE_PHONE_LEN = 40;
export const MAX_STORE_EMAIL_LEN = 254;
export const MAX_STORE_ADDRESS_LEN = 200;

type StoreTextFields = {
  name: string;
  description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
};

/**
 * 伺服器端真正擋下「太長」的那一層（瀏覽器端 maxLength 能被停用 JS 或改 DOM 繞過）。
 * 回傳第一個超限欄位的中文錯誤訊息，全部合格回 null；由呼叫端決定怎麼 redirect
 * （createStore 跟 updateStore 的錯誤頁不同）。空店名的檢查留在呼叫端（那句訊息跟其他
 * 必填欄位同一組），這裡只管「太長」。
 */
export function storeTextLimitError(fields: StoreTextFields): string | null {
  if (fields.name.length > MAX_STORE_NAME_LEN) {
    return `店名最多 ${MAX_STORE_NAME_LEN} 個字，長一點的介紹放到店介紹欄`;
  }
  if (fields.description && fields.description.length > MAX_STORE_DESC_LEN) {
    return `店介紹最多 ${MAX_STORE_DESC_LEN.toLocaleString("zh-TW")} 個字`;
  }
  if (fields.contact_phone && fields.contact_phone.length > MAX_STORE_PHONE_LEN) {
    return `聯絡電話最多 ${MAX_STORE_PHONE_LEN} 個字`;
  }
  if (fields.contact_email && fields.contact_email.length > MAX_STORE_EMAIL_LEN) {
    return `聯絡信箱最多 ${MAX_STORE_EMAIL_LEN} 個字`;
  }
  if (fields.address && fields.address.length > MAX_STORE_ADDRESS_LEN) {
    return `地址最多 ${MAX_STORE_ADDRESS_LEN} 個字`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// theme JSON 裡的文案欄位。這批欄位有兩個入口：視覺編輯器（editor/actions.ts 收 JSON
// payload，超長直接 slice 截掉）跟店面設定頁（settings/actions.ts 收 FormData）。以前
// 編輯器那邊每個欄位各寫死一個數字、設定頁完全沒擋，讀取端 resolveTheme 也只 trim 不截，
// 同一個欄位從編輯器進去最多 500 字、從設定頁進去無上限。現在兩支 action 都 import 這裡，
// 數字只有一份。
//
// 數字沿用編輯器原本的：底部標語 500、Hero 小標 200、Hero 副標 1000、選物提案中標 500、
// 提案卡標題 60／副標 80、Promise 2000、來店標題 100。營業時間 2000（一行一筆，三十行
// 綽綽有餘）與 FAQ 5000（自由格式問答，約 15 組）是設定頁獨有的欄位，編輯器沒有對應；
// 社群連結 500 跟編輯器裡所有 URL 欄位（logo／hero／partner href）同數字。
export const MAX_THEME_TAGLINE_LEN = 500;
export const MAX_HERO_EYEBROW_LEN = 200;
export const MAX_HERO_SUBTITLE_LEN = 1000;
export const MAX_COLLECTIONS_INTRO_LEN = 500;
export const MAX_COLLECTION_TITLE_LEN = 60;
export const MAX_COLLECTION_SUBTITLE_LEN = 80;
export const MAX_PROMISE_LEN = 2000;
export const MAX_VISIT_TITLE_LEN = 100;
export const MAX_BUSINESS_HOURS_LEN = 2000;
export const MAX_FAQ_TEXT_LEN = 5000;
export const MAX_SOCIAL_URL_LEN = 500;

type StoreThemeTextFields = {
  tagline: string | null;
  heroEyebrow: string | null;
  heroSubtitle: string | null;
  collectionsIntro: string | null;
  collectionItems: { title: string; subtitle: string }[];
  promise: string | null;
  visitTitle: string | null;
  businessHours: string;
  faq: string;
  social: { instagram: string | null; facebook: string | null; line: string | null };
};

/**
 * 店面設定頁的文案欄位版 storeTextLimitError：回傳第一個超限欄位的中文訊息，全部合格回
 * null。設定頁跟編輯器對「太長」的處理不同（編輯器 slice 截掉、設定頁退回給商家改），
 * 因為 FormData 那條路商家看得到錯誤訊息，截掉反而會讓人以為存好了。
 */
export function storeThemeTextLimitError(f: StoreThemeTextFields): string | null {
  const over = (v: string | null, max: number) => !!v && v.length > max;
  if (over(f.tagline, MAX_THEME_TAGLINE_LEN)) {
    return `底部標語最多 ${MAX_THEME_TAGLINE_LEN} 個字`;
  }
  if (over(f.heroEyebrow, MAX_HERO_EYEBROW_LEN)) {
    return `Hero 小標最多 ${MAX_HERO_EYEBROW_LEN} 個字`;
  }
  if (over(f.heroSubtitle, MAX_HERO_SUBTITLE_LEN)) {
    return `Hero 副標最多 ${MAX_HERO_SUBTITLE_LEN.toLocaleString("zh-TW")} 個字`;
  }
  if (over(f.collectionsIntro, MAX_COLLECTIONS_INTRO_LEN)) {
    return `選物提案中標最多 ${MAX_COLLECTIONS_INTRO_LEN} 個字`;
  }
  for (const c of f.collectionItems) {
    if (c.title.length > MAX_COLLECTION_TITLE_LEN) {
      return `提案卡標題最多 ${MAX_COLLECTION_TITLE_LEN} 個字`;
    }
    if (c.subtitle.length > MAX_COLLECTION_SUBTITLE_LEN) {
      return `提案卡副標最多 ${MAX_COLLECTION_SUBTITLE_LEN} 個字`;
    }
  }
  if (over(f.promise, MAX_PROMISE_LEN)) {
    return `Promise 承諾文字最多 ${MAX_PROMISE_LEN.toLocaleString("zh-TW")} 個字`;
  }
  if (over(f.visitTitle, MAX_VISIT_TITLE_LEN)) {
    return `來店標題最多 ${MAX_VISIT_TITLE_LEN} 個字`;
  }
  if (f.businessHours.length > MAX_BUSINESS_HOURS_LEN) {
    return `營業時間最多 ${MAX_BUSINESS_HOURS_LEN.toLocaleString("zh-TW")} 個字`;
  }
  if (f.faq.length > MAX_FAQ_TEXT_LEN) {
    return `常見問題最多 ${MAX_FAQ_TEXT_LEN.toLocaleString("zh-TW")} 個字`;
  }
  for (const [label, v] of [
    ["Instagram", f.social.instagram],
    ["Facebook", f.social.facebook],
    ["LINE", f.social.line],
  ] as const) {
    if (over(v, MAX_SOCIAL_URL_LEN)) {
      return `${label} 連結最多 ${MAX_SOCIAL_URL_LEN} 個字`;
    }
  }
  return null;
}
