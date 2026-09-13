// 「四捨五入到小數第 N 位」——店面首頁把主標字距／行距／CTA 字級這些算出來的
// 小數塞進 inline style 之前都會過這一支，避免 0.02 + 0.05 這種加法跑出
// 0.07000000000000001em 直接印進 HTML。
//
// 算法就是 Math.round(x * 10^N) / 10^N，跟原本各處手寫的一模一樣（10 ** 1 與
// 10 ** 3 都是精確整數）。不處理 NaN／Infinity：進來什麼樣出去什麼樣，呼叫端的
// 值都已經先過 resolveTheme 的 clamp。
export function roundTo(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
