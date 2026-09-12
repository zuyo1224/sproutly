// 把商家在後台填的圖片網址，清成「能安全餵給 Google 與社群爬蟲」的乾淨清單。
//
// 為什麼要這層：商品圖網址是商家自己貼的，image_urls 陣列裡可能混進空字串、
// 只有空白的列（編輯器開了一格圖片卻沒填）、或相對路徑／根本不是網址的怪字串。
// 這些值直接塞進外部要吃的欄位會出事：
//   - Product 結構化資料的 image：schema.org／Google 規定要絕對網址，混進空白或
//     相對路徑，整段 Product rich result 會被判無效、價格庫存一起不顯示。
//   - Open Graph／Twitter Card 的 og:image：Facebook、Twitter 只認絕對網址，
//     相對路徑或一串空白會讓分享出去的預覽圖開天窗。
//
// 所以這裡做三件事：去前後空白 → 只留真的以 http(s):// 開頭的絕對網址 → 去重，
// 並保持商家原本的排序（第一張仍是主圖）。這跟 sameAs 社群連結那條「只放絕對網址」
// 的防呆線同一個態度：寧可少放一張，也不要餵錯的給外部。
//
// 注意：頁面上實際的 <img> 渲染不走這條，維持原本能吃相對路徑的彈性——這裡只清
// 「餵給 Google／社群」這一端，不動給客人看的那一端。
export function absoluteImageUrls(
  urls: (string | null | undefined)[] | null | undefined,
): string[] {
  if (!Array.isArray(urls)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (typeof raw !== "string") continue;
    const u = raw.trim();
    if (!/^https?:\/\//i.test(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

// 這張圖能不能交給 next/image 的圖片最佳化（/_next/image）去抓。
//
// 為什麼要判：next.config.mjs 的 remotePatterns 只登記 https://**，而 next/image 的預設
// loader 是在「render 時」就檢查 src——不是網址（「abc」「my photo.jpg」）會 throw
// 「Failed to parse src」、http:// 或 ftp:// 這種名單外的協定會 throw「hostname is not
// configured」。這些字串是商家自己在編輯器相簿那格、商品「貼網路圖片 URL」那格手打
// 進 DB 的，一存進去，店面首頁六處 <Image> 只要有一處吃到，整頁就 500，客人什麼都
// 看不到；而且錯在公開頁、不在後台，商家自己回編輯器看不出哪裡壞。
//
// 判得過（true）：https:// 開頭的絕對網址、或以單一「/」開頭的站內相對路徑。
// 判不過（false）：其他全部——呼叫端把 <Image> 標成 unoptimized，next/image 就不再
// 經過 loader、原字串直接放進 <img src>，最壞就是那一張圖開天窗，整頁還在。
// 這是渲染端的保險，跟寫入端要不要擋是兩回事：DB 裡早就存進去的舊值也得靠這條活著。
export function isOptimizableImageSrc(src: string | null | undefined): boolean {
  if (typeof src !== "string") return false;
  const s = src.trim();
  if (!s) return false;
  if (s.startsWith("/")) return !s.startsWith("//");
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

// 商家在後台「貼網路圖片 URL」那格填的字串，能不能收進 image_urls。
//
// 跟上面 isOptimizableImageSrc 的差別：那支是渲染端保險，站內路徑（「/logo.png」）也放行，
// 因為程式自己塞的預設圖就是走站內路徑。但商家手貼的字串沒有這種情況——「/photo.jpg」
// 對商家來說多半是漏了網域的半截網址，寫入端放行了，店面會去抓 sproutly 自己網域底下
// 根本不存在的檔，那張圖照樣開天窗，而且表單提示文案講的是「要 https:// 開頭」，跟實際
// 放行的範圍對不上。所以這格另開一支：只認 https:// 開頭、URL 解析得過的絕對網址，
// 寫入端（products/actions.ts）與輸入框即時提示（ImageUrlHintInput）共用，兩邊口徑一致。
// 站內預設圖、DB 裡的舊值不經過這條，渲染端仍由 isOptimizableImageSrc 兜底。
export function isPastedRemoteImageUrl(src: string | null | undefined): boolean {
  if (typeof src !== "string") return false;
  const s = src.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && u.hostname !== "";
  } catch {
    return false;
  }
}

// 商品詳情頁要掛給客人看的圖片清單：把 image_urls 裡「店面注定顯示不出來」的那幾張先挑掉。
//
// 為什麼要這層：後台商品編輯頁（e71ebb1）已經會對 image_urls 每張用 isPastedRemoteImageUrl
// 判一次、判不過標「店面顯示不出來」，但那只是讓商家看得見，DB 裡更早存進去的 http://、
// 漏網域的半截網址、空白字串還是原樣進了公開頁的 ImageCarousel 與主圖。這些值在 https 店面
// 上一定壞：http:// 被瀏覽器當混合內容擋掉、「/photo.jpg」去抓 sproutly 自己網域下不存在的檔、
// 「  」是一張空 src。客人端一張破圖框比少一張圖難看得多，尤其詳情頁第一張就是整頁的主視覺。
//
// 所以這裡只留 isPastedRemoteImageUrl 判得過的（https:// 完整網址），去前後空白、去重、
// 保持商家原本排序（第一張仍是主圖）。全部濾光就回空陣列，呼叫端照原本「沒有圖」的
// 版位走（詳情頁本來就有 images.length === 0 的佔位格），不會多出一個新狀態。
// 跟 absoluteImageUrls 的差別：那支只認「是不是絕對網址」、http:// 也放行；這支是給客人看
// 的那一端，口徑跟後台標記那條一致，商家在後台看到標記的那幾張，店面就真的不掛。餵給
// Google／社群的幾處（商品詳情頁 og:image 與 JSON-LD、逛街頁 ItemList、sitemap 商品圖與
// 店面主視覺、店面 og:image、Store JSON-LD 的 image／logo）也走這支或下面的單值版：對外
// 報的圖要跟頁面實際掛的是同一批，不能報一張頁上根本沒有的 http:// 圖。absoluteImageUrls
// 現在只剩商品 JSON-LD 那處保留原本語意再過一次，新 code 一律走這支。
export function displayableImageUrls(
  urls: (string | null | undefined)[] | null | undefined,
): string[] {
  if (!Array.isArray(urls)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (!isPastedRemoteImageUrl(raw)) continue;
    const u = (raw as string).trim();
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

// 後台標記用：image_urls 裡「店面不會放」的張數（isPastedRemoteImageUrl 判不過的）。
//
// 為什麼收成一支：商品列表頁的琥珀點與編輯頁的提醒句各自手抄同一段 filter，口徑要跟
// displayableImageUrls 一致（那支留的就是判得過的那批），兩處各抄一次哪天一處改了判法
// 另一處就對不上。這支不去重、不去空白，算的是「DB 裡原始那幾格有幾格判不過」——商家看
// 的是自己貼的每一格，同一張壞網址貼了兩次就是兩格要處理。非陣列輸入回 0。
export function brokenImageCount(
  urls: (string | null | undefined)[] | null | undefined,
): number {
  if (!Array.isArray(urls)) return 0;
  return urls.filter((u) => !isPastedRemoteImageUrl(u)).length;
}

// 單一欄位版：heroUrl／logoUrl 這種只有一個值的欄位用。
//
// 為什麼另開一支：hero 與 logo 不像商品圖是陣列，各處要用時都得寫
// displayableImageUrls([x])[0] ?? null 這串，五個檔各抄一次容易有一處漏了 ?? null 變成
// undefined 塞進 JSON-LD。收成一支後口徑跟 displayableImageUrls 完全一樣（只認 https://
// 完整網址、去前後空白），判不過回 null，呼叫端照原本「沒有圖」的路走。
// 寫入端（editor/actions.ts 的 hero_url／logo_url）也用這支：那兩欄的 UI 只能從圖庫挑
// （Supabase Storage、Pexels，都是 https），payload 若帶了別的東西就是手打請求或舊值，
// 存進去店面也掛不出來，不如寫入時就擋，後台跟店面才不會各說各話。
export function displayableImageUrl(src: string | null | undefined): string | null {
  return displayableImageUrls([src])[0] ?? null;
}

// 從圖片網址的副檔名推 MIME type，給 web manifest 的 icons[].type 用。
//
// 為什麼要這支：各店 site.webmanifest 的 icons 之前把 type 寫死 image/png，但 logo 是商家從
// 圖庫挑的——Supabase Storage 上傳什麼副檔名就是什麼（jpg、webp、svg 都有），Pexels 給的
// 一律是 .jpeg。manifest 規格裡 type 是「提示」，瀏覽器拿到 image/png 卻抓回 jpeg 時，
// Chromium 會照實際內容解碼、Safari 與部分 Android 啟動器則可能直接跳過這個圖示，
// 加到主畫面就是一塊空白或退回平台 favicon，而後台完全看不出來。填錯不如不填：
// 規格允許省略 type，瀏覽器會用回應的 Content-Type 自己判。
//
// 只看 URL 的 pathname、忽略 query 與 hash（Pexels 的 .jpeg 後面接一串 ?auto=compress&w=…），
// 副檔名不分大小寫；認得的只有幾種瀏覽器真的會拿來當圖示的格式，其他一律回 null，
// 呼叫端看到 null 就不放 type 這個 key。不是網址（URL 解析失敗）也回 null。
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
  ico: "image/x-icon",
};

export function imageMimeTypeFromUrl(src: string | null | undefined): string | null {
  if (typeof src !== "string") return null;
  const s = src.trim();
  if (!s) return null;
  let pathname: string;
  try {
    // 站內相對路徑（/favicon.ico）也要判得出來，補一個假 base 只為了讓 URL 幫忙切掉 query／hash
    pathname = new URL(s, "https://placeholder.invalid").pathname;
  } catch {
    return null;
  }
  const lastSegment = pathname.split("/").pop() ?? "";
  const dot = lastSegment.lastIndexOf(".");
  if (dot <= 0 || dot === lastSegment.length - 1) return null;
  const ext = lastSegment.slice(dot + 1).toLowerCase();
  return IMAGE_MIME_BY_EXT[ext] ?? null;
}
