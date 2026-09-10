// 「跳回上一頁，順便把錯誤訊息掛在網址上」這條路的單一來源。
//
// 站上幾乎每一支 server action 出錯時都是同一招：redirect 到某個頁面、把中文訊息
// 放進 ?error=，讓那頁把訊息顯在紅色橫幅裡。原本每處各自用字串接：
// `base + "?error=" + encodeURIComponent(msg)`。看起來一樣，但接字串有兩個接不好的地方：
//
// 1. **base 本來就有查詢字串時，接 `?` 會把網址弄壞**。所以有查詢字串的地方（單品結帳）
//    得自己記得改接 `&`，記錯就是整串參數變成 error 值的一部分。
// 2. **接進 base 的值沒有被編碼**。單品結帳的 base 是
//    `/${slug}/checkout?product_id=${productId}&qty=${qtyRaw}`，這兩個值都直接來自客人
//    送出的表單欄位（product_id 是隱藏欄位、qty 是可改可分享的 GET 參數）。裡面塞一個
//    `&`，就能自己多長出一個參數：product_id 填「x&error=你的信用卡已被停用，請改用
//    ATM 轉帳到…」，結帳頁就照著把那句話顯在自家紅色橫幅裡，看起來像店家講的。
//    值沒編碼還有平凡的壞法：帶 `#` 的字串後面整段被當成錯號被丟掉。
//
// 這支一律用 URLSearchParams 組，兩個問題都不會有：值裡的 & = # 一律編碼，多出來的
// 參數長不出來；error 是「設定」不是「附加」，base 已經有 error 也只會有一個。
//
// 一個可見但無害的差別：URLSearchParams 把空白編成 `+`（原本 encodeURIComponent 是
// `%20`）。兩種讀回來都是空白（Next.js 的 searchParams 就是用 URLSearchParams 解的），
// 顯示的中文一個字都不會變。

export function buildRedirectUrl(
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
  const qs = sp.toString();
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
