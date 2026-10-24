// 站上「自己組一條帶查詢字串的網址」全部走這裡：跳轉、連結 href、前端去打自家
// 介面的網址，都是同一件事。
//
// 原本每處各自用字串接：`base + "?q=" + encodeURIComponent(值)`。看起來一樣，但接
// 字串有兩個接不好的地方：
//
// 1. **base 本來就有查詢字串時，接 `?` 會把網址弄壞**。所以有查詢字串的地方（單品結帳）
//    得自己記得改接 `&`，記錯就是整串參數變成 error 值的一部分。
// 2. **接進 base 的值忘了編碼**。單品結帳的 base 是
//    `/${slug}/checkout?product_id=${productId}&qty=${qtyRaw}`，這兩個值都直接來自客人
//    送出的表單欄位（product_id 是隱藏欄位、qty 是可改可分享的 GET 參數）。裡面塞一個
//    `&`，就能自己多長出一個參數：product_id 填「x&error=你的信用卡已被停用，請改用
//    ATM 轉帳到…」，結帳頁就照著把那句話顯在自家紅色橫幅裡，看起來像店家講的。
//    值沒編碼還有平凡的壞法：帶 `#` 的字串後面整段被當成錯號被丟掉。
//
// 這兩支一律用 URLSearchParams 組，兩個問題都不會有：值裡的 & = # 一律編碼，多出來的
// 參數長不出來；error 是「設定」不是「附加」，base 已經有 error 也只會有一個。
//
// 兩個可見但無害的差別（跟原本一處一處手接的寫法比）：URLSearchParams 把空白編成 `+`
// （原本是 `%20`）、`/` 與 `,` 不編（原本編成 `%2F` `%2C`）。三種讀回來都一模一樣
// （Next.js 的 searchParams 就是用 URLSearchParams 解的），顯示的中文一個字都不會變。
//
// 對外站的網址（Google Maps、mailto、Pexels 介面）不走這裡：那是別人家的規格，
// 該長什麼樣由對方決定，見 lib/contact-href.ts。

export function buildUrl(
  path: string,
  params: Record<string, string | number | null | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // null / undefined 代表「這個參數這次不帶」；空字串是有意義的值（例如清空搜尋），
    // 照樣帶上去。
    if (value === null || value === undefined) continue;
    sp.set(key, String(value));
  }
  return withQuery(path, sp.toString());
}

// 已經組好的查詢字串（列表頁的篩選＋搜尋、回跳用的 returnQs）接到路徑後面：
// 空字串就只回路徑，不留一個孤單的問號。qs 不再編碼，呼叫端要給 URLSearchParams
// 組出來的字串。後台三張列表以前在九處各手接一次同一個三元式。
export function withQuery(path: string, qs: string): string {
  return qs ? `${path}?${qs}` : path;
}

export function withErrorParam(url: string, message: string): string {
  const [path, qs = ""] = splitQuery(url);
  const sp = new URLSearchParams(qs);
  sp.set("error", message);
  return `${path}?${sp.toString()}`;
}

// 只切第一個 `?`：後面的問號是查詢字串裡合法的字元，不該再切一次。
function splitQuery(url: string): [string, string?] {
  const i = url.indexOf("?");
  if (i === -1) return [url];
  return [url.slice(0, i), url.slice(i + 1)];
}

// 登入完要跳去哪（網址列上的 next 參數）只收「自家站內的路徑」，其他一律退回 fallback。
// next 是任何人都能改的網址參數，信它就等於讓別人決定登入成功的人被送去哪。
//
// 必須以 `/` 開頭：auth/callback 會把它接在 origin 後面，`.evil.com` 這種會黏成
// `https://本站.evil.com`、掛到別人網域下。另外擋 `//` 與 `/\` 開頭：接在 origin 後面
// 時無害（只是本站一條怪路徑），但哪天有人直接 redirect(next)，瀏覽器會把它當成
// 「省略 https: 的外站網址」（`//evil.com` → https://evil.com，反斜線瀏覽器也當斜線），
// 先擋掉免得留一條看不見的坑。正常的站內路徑沒有這樣開頭的。
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

// 跳轉目標是不是 base 本身或 base 底下的站內路徑：本身、`base/…`、`base?…` 才算。
// 用在 server action 的 bind 參數（例如訂單快速推進的 returnTo）：bind 參數照樣能被
// 人直接改掉送來，原樣丟給 redirect 會被拿去跳外站。只比前綴不夠：`base/../../x`
// 會被瀏覽器正規化成 base 外面的路徑、反斜線瀏覽器當斜線，所以帶 `..` 或 `\` 一律
// 不收；`base-x`（別間店的 slug 剛好以這間開頭）也不算在底下。
export function isUnderPath(path: string, base: string): boolean {
  if (path.includes("..") || path.includes("\\")) return false;
  return path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`);
}
