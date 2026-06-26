// 撥號連結 helper。
//
// 商家在後台填電話時想怎麼打就怎麼打 ——「(02) 1234-5678」「0912 345 678」
// 「02-1234-5678 #123」甚至全形數字「０９１２」都有人這樣寫，因為這樣人看得舒服。
// 但這串原文直接塞進 <a href="tel:..."> 時，部分 Android 撥號器遇到空格、括號、
// 全形字會整串解析失敗，客人在手機上點了卻撥不出去。RFC 3966 規定 tel: 的 href
// 只該留可撥號字元（數字，開頭可有一個 + 代表國碼）。
//
// 還有分機：市話常寫成「02-1234-5678 #123」「(02) 1234-5678 分機 123」「02-…轉 9」。
// 分機那串數字不是主號的一部分，直接 replace(/\D/g,"") 會把它黏在主號後面，
// 撥出去變成「0212345678123」這種根本不存在的號碼，比漏掉分機更糟（撥錯人）。
// RFC 3966 規定分機要用 `;ext=` 另外掛，像 `tel:+886212345678;ext=123`，
// 主流撥號器（iOS / Android）認得，會先撥主號、接通後再送分機。
//
// 所以：畫面上「顯示」的電話維持商家原本打的好看格式不動，只有「href」這串清乾淨。
// 清的規則：全形數字先轉半形 → 用分機標記（# / 分機 / 轉 / ext）把主號與分機切開
// → 主號只留數字、若原文開頭是國碼（+ 或全形＋）就補回開頭的 + → 分機數字用 ;ext= 掛回去。
export function telHref(phone: string | null | undefined): string {
  if (!phone) return "tel:";

  // 全形數字 ０-９（U+FF10–U+FF19）轉成半形 0-9，順手把全形加號＋也歸一成 +
  const normalized = phone.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 第一個分機標記之前算主號、之後算分機。# ＃ 分機 轉 ext/extension 都常見，
  // 大小寫不分；只切第一個標記，避免把後面備註裡的字也誤當分機。
  const extMatch = normalized.match(/[#＃]|分機|轉|ext(?:ension)?\.?/i);
  const mainRaw = extMatch ? normalized.slice(0, extMatch.index) : normalized;
  const extRaw = extMatch ? normalized.slice(extMatch.index! + extMatch[0].length) : "";

  const hasPlus = /^[\s　]*[+＋]/.test(mainRaw);
  const digits = mainRaw.replace(/\D/g, "");
  const extDigits = extRaw.replace(/\D/g, "");

  // 主號一個數字都沒有就退回最陽春的 "tel:"，不硬掛一個只有分機的壞連結。
  if (!digits) return "tel:";

  return `tel:${hasPlus ? "+" : ""}${digits}${extDigits ? `;ext=${extDigits}` : ""}`;
}

// Email 連結 helper，跟 telHref 同個道理：商家在後台填 Email 時常多打了前後空白、
// 用全形字（＠ 或全形英數，注音輸入法切換時很容易誤打）、甚至整段貼成「mailto:abc@x.com」。
// 這串原文直接塞進 <a href="mailto:..."> 時，開頭的 mailto: 會被當成位址一部分、
// 內部空白會讓部分信件 app 整串解析失敗，客人點了卻開不了寫信。
// 所以畫面上「顯示」的 Email 維持商家原本打的不動，只把「href」這串清乾淨：
// 全形字轉半形 → 去前後空白與內部空白 → 去掉誤貼的開頭 mailto: → 沒位址就退回陽春 "mailto:"。
// subject / body 另外用 query 掛上去（各自 encode），讓各頁不必再自己拼 ?subject= 字串。
export function mailHref(
  email: string | null | undefined,
  opts?: { subject?: string; body?: string }
): string {
  // 全形英數與符號（U+FF01–FF5E）轉半形，全形空白 U+3000 一併歸成一般空白好 trim
  const normalized = (email ?? "")
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");

  // 去掉誤貼的開頭 mailto:（大小寫不分），再清掉所有空白——Email 位址本來就不含空白
  const cleaned = normalized
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/\s+/g, "");

  // 沒有位址就退回最陽春的 "mailto:"，不硬掛一個只有 subject 的壞連結
  if (!cleaned) return "mailto:";

  const params: string[] = [];
  if (opts?.subject) params.push(`subject=${encodeURIComponent(opts.subject)}`);
  if (opts?.body) params.push(`body=${encodeURIComponent(opts.body)}`);

  return `mailto:${cleaned}${params.length ? `?${params.join("&")}` : ""}`;
}
