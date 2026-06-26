// 把以「分」為單位的金額，轉成跟著各店幣別走的顯示字串。
//
// 以前這段在二十幾個頁面各抄一份，寫法還不一致（有的四捨五入、有的留兩位小數），
// 集中到這裡只留一份，金額顯示全站才會一致。
//
// 規則：
// - TWD 維持「NT$ 1,234」的老樣子，不留小數（台灣客人最習慣這個寫法）。
// - 其他幣別交給瀏覽器內建的 Intl 處理，符號跟小數位都照那個幣別自己的規矩走——
//   例如日圓、韓元本來就沒有小數，不會再被硬塞「.00」；美金、歐元才會顯示兩位。
// - 舊商品有的根本沒填幣別（null / 空字串），這種就當台灣店看，退回 TWD，
//   不然以前會跑出「null 12.34」這種醜字串給客人看到。
// - 金額本身也可能是非有限數字：舊商品沒填價（null / undefined）、或後台統計時
//   「總額 ÷ 0 筆訂單」算出 NaN / Infinity。這種一律當 0 處理，免得客人或店家
//   看到「NT$ NaN」「NT$ ∞」這種壞字串（跟上面沒填幣別是同一條防呆線）。
export function formatPrice(cents: number, currency?: string | null): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  // 正規化：去空白、轉大寫，沒填就當 TWD（台灣店預設）。
  const code = (currency ?? "").trim().toUpperCase() || "TWD";
  if (code === "TWD") {
    return `NT$ ${Math.round(amount).toLocaleString("zh-TW")}`;
  }
  try {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    // 遇到不認得的幣別代碼（資料怪怪的）就退回最陽春的「代碼 + 金額」，不讓整頁壞掉。
    return `${code} ${amount.toFixed(2)}`;
  }
}
