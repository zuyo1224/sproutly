// 撥號連結 helper。
//
// 商家在後台填電話時想怎麼打就怎麼打 ——「(02) 1234-5678」「0912 345 678」
// 「02-1234-5678 #123」甚至全形數字「０９１２」都有人這樣寫，因為這樣人看得舒服。
// 但這串原文直接塞進 <a href="tel:..."> 時，部分 Android 撥號器遇到空格、括號、
// 全形字會整串解析失敗，客人在手機上點了卻撥不出去。RFC 3966 規定 tel: 的 href
// 只該留可撥號字元（數字，開頭可有一個 + 代表國碼）。
//
// 所以：畫面上「顯示」的電話維持商家原本打的好看格式不動，只有「href」這串清乾淨。
// 清的規則：全形數字先轉半形 → 只留數字 → 若原文開頭是國碼（+ 或全形＋）就補回開頭的 +。
export function telHref(phone: string | null | undefined): string {
  if (!phone) return "tel:";

  // 全形數字 ０-９（U+FF10–U+FF19）轉成半形 0-9，順手把全形加號＋也歸一成 +
  const normalized = phone.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const hasPlus = /^[\s　]*[+＋]/.test(normalized);
  const digits = normalized.replace(/\D/g, "");

  return `tel:${hasPlus ? "+" : ""}${digits}`;
}
