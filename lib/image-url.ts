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
