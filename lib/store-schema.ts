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
