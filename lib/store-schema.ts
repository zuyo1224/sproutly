// 店家本體（schema.org Store）結構化資料的共用 builder。
//
// 為什麼集中到這裡：首頁（app/[slug]/page.tsx）和聯絡頁（app/[slug]/contact/page.tsx）
// 各自手拼一份幾乎一模一樣的 Store JSON-LD——同樣的 @id、name、url，同樣對描述 trim、
// 對 image／logo 走 absoluteImageUrls、對電話走 telDigits、對 Email 走 cleanEmail、
// 對地址組 PostalAddress、對社群走 socialUrl、對營業時間走 parseBusinessHoursToSpec。
// 聯絡頁的註解自己都寫「跟首頁那份用同一套欄位」——兩份靠人工維持一致，改一頁忘了
// 另一頁，餵給 Google 的店家資料就兩頁對不上（少一個 sameAs、少一段營業時間都會）。
// 收成這一份單一來源後，哪頁要顯示店家結構化資料都呼叫同一支，欄位定義與防呆線只剩一處。
// 這跟 format-price、availability-schema、contact-href 把重複邏輯收成單一來源是同個出發點。
//
// 注意：「要不要放這段 Store」的判斷仍留在各頁——首頁一律放，聯絡頁只在真的有任一聯絡
// 資訊時才放（空店面不丟空殼給 Google）。這支只負責把資料組成乾淨的 Store 物件。
import { parseBusinessHoursToSpec } from "./business-hours-schema";
import { telDigits, cleanEmail, socialUrl } from "./contact-href";
import { absoluteImageUrls } from "./image-url";

// 網站基底網址：店面同時掛在短網址（sproutly-drab）與 Vercel 長網址底下，結構化資料
// 與 canonical 都得指同一個基底，否則 Google 當成兩個重複頁面。各頁原本各自寫一份
// `process.env... ?? "https://sproutly-drab.vercel.app"`，集中成一支，預設值只剩一處。
export function siteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://sproutly-drab.vercel.app"
  );
}

// 店家在整個網站的唯一身分證（@id）。首頁、聯絡頁的 Store、首頁 WebSite 的 publisher、
// 商品頁 offer 的 seller 全指同一個 @id，Google 才知道散在各頁的結構化資料講的是「同一間
// 店」，而不是好幾間同名的不同店。`#store` 這個格式原本在四處各寫一遍裸字串，漏改一處
// 就斷開連結——收成這一支，格式只剩單一來源。
export function storeSchemaId(baseUrl: string, slug: string): string {
  return `${baseUrl}/${slug}#store`;
}

// 組出餵給 Google 的 Store 結構化資料物件。每個欄位都先走對應的防呆 helper，
// 清不出有效值（商家只打空白、填了非網址、營業時間判讀不出來）就整欄省略，
// 不送空值或壞值——少一個欄位也比餵錯讓整段 rich result 失效好。
export function buildStoreJsonLd(input: {
  baseUrl: string;
  slug: string;
  name: string;
  description?: string | null;
  heroUrl?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  // 社群連結原始值（Instagram / Facebook / LINE，順序不拘），交給 socialUrl 各自清。
  socialLinks?: (string | null | undefined)[];
  businessHoursText?: string | null;
}): Record<string, unknown> {
  const { baseUrl, slug } = input;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": storeSchemaId(baseUrl, slug),
    name: input.name,
    url: `${baseUrl}/${slug}`,
  };

  // 描述先 trim：商家只打空白時，原本 if (description) 對「  」也成立，會吐一筆空白
  // description 給 Google。trim 後仍有字才放。
  const description = input.description?.trim();
  if (description) jsonLd.description = description;

  // image／logo 走 absoluteImageUrls（去空白＋只留 http(s) 絕對網址）：heroUrl／logoUrl
  // 是商家貼的，可能是相對路徑或一串空白，直接放會餵無效圖讓 Store rich result 失效。
  const image = absoluteImageUrls([input.heroUrl])[0];
  if (image) jsonLd.image = image;
  const logo = absoluteImageUrls([input.logoUrl])[0];
  if (logo) jsonLd.logo = logo;

  // 電話／Email 走跟畫面撥號／寫信連結同一份清理，給 Google 的號碼／位址不會跟頁面對不上。
  const telephone = telDigits(input.phone);
  if (telephone) jsonLd.telephone = telephone;
  const email = cleanEmail(input.email);
  if (email) jsonLd.email = email;

  // 地址先 trim：商家只打空白（或前後黏了換行）時別吐一個 streetAddress 是空白的
  // PostalAddress 給 Google。trim 後仍有字才組地址。
  const address = input.address?.trim();
  if (address) {
    jsonLd.address = {
      "@type": "PostalAddress",
      streetAddress: address,
      addressCountry: "TW",
    };
  }

  // 營業時間：schema.org 的 openingHours 只吃結構化星期＋24 小時時間，商家打的是中文
  // 自由文字，直接塞會被判無效、連整段 Store 一起忽略。解析得出來才放，判讀不出來就不放
  //（頁面上給客人看的原始文字照常顯示）。
  const openingHoursSpec = parseBusinessHoursToSpec(input.businessHoursText ?? "");
  if (openingHoursSpec) jsonLd.openingHoursSpecification = openingHoursSpec;

  // sameAs：把店家填的 Instagram / Facebook / LINE 連回同一個店家實體，Google 用這條把
  // 社群帳號跟搜尋結果的店家對起來。sameAs 只吃絕對網址，socialUrl 清不出網址的略過不放。
  const socialUrls = (input.socialLinks ?? [])
    .map(socialUrl)
    .filter((u): u is string => u !== null);
  if (socialUrls.length > 0) jsonLd.sameAs = socialUrls;

  return jsonLd;
}

// 麵包屑（schema.org BreadcrumbList）結構化資料的共用 builder。
//
// 為什麼集中到這裡：shop／about／contact／商品詳情四頁各自手拼一份同形的 BreadcrumbList——
// position 1 永遠是「店名 → 店根網址」，後面接各頁自己那一兩層；連 @context、ListItem 的
// 欄位順序、position 怎麼遞增都各抄一遍。改一處（譬如基底網址規則）忘了另外三頁，餵給
// Google 的麵包屑就各頁對不上。收成這一支：各頁只給「店根之後的那幾層」，position 遞增與
// 店根那一層由這支統一補。這跟 buildStoreJsonLd、format-price 把重複邏輯收成單一來源同個出發點。
export function buildBreadcrumbJsonLd(input: {
  baseUrl: string;
  slug: string;
  storeName: string;
  // 店根之後的各層麵包屑，由淺到深；path 是接在 /${slug} 後面的子路徑（如 "shop"、
  // "contact"、"products/abc"），最末層通常就是當前頁。位置 1 的店根這支會自動補上。
  trail: { name: string; path: string }[];
}): Record<string, unknown> {
  const { baseUrl, slug } = input;
  const root = `${baseUrl}/${slug}`;
  const crumbs = [
    { name: input.storeName, item: root },
    ...input.trail.map((t) => ({ name: t.name, item: `${root}/${t.path}` })),
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };
}

// 常見問題（schema.org FAQPage）結構化資料的共用 builder。
//
// 為什麼集中到這裡：首頁（FAQ block）與關於頁（store.faq 文字欄）各自手拼一份同形的
// FAQPage——同樣的 @context、@type，同樣把每筆問答組成 Question + acceptedAnswer/Answer。
// 兩頁問答的「來源」不同，但「組成 FAQPage 的形狀」完全一樣，卻各抄一遍：連「空問／空答
// 要濾掉、文字要去前後空白」這條 Google 要求（每題都得有答案文字，否則整段 rich result
// 失效）都得兩頁各自顧。實際上還已經各走各的——首頁在 map 裡補 trim、關於頁直接塞 raw 值，
// 同一筆前後黏了空白的問答在兩頁輸出不一致。收成這一支：濾空與 trim 只剩一處，兩頁保證同款。
// 這跟 buildStoreJsonLd、buildBreadcrumbJsonLd、format-price 把重複邏輯收成單一來源同個出發點。
//
// 注意：「這頁到底要不要放 FAQ」的判斷仍留在各頁（首頁要 FAQ 區段有開、關於頁要解析得出
// 問答）。這支只負責把問答清乾淨、組成 FAQPage；清完一筆有效問答都不剩就回 null，呼叫端
// 的 `if (faqJsonLd)` 自然略過，不丟一個 mainEntity 空陣列的 FAQPage 給 Google。
export function buildFaqJsonLd(
  items: { question: string; answer: string }[],
): Record<string, unknown> | null {
  const mainEntity = items
    .map((it) => ({ question: it.question.trim(), answer: it.answer.trim() }))
    .filter((it) => it.question !== "" && it.answer !== "")
    .map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer },
    }));
  if (mainEntity.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}
