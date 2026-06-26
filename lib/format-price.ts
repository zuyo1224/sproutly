// 把以「分」為單位的金額，轉成跟著各店幣別走的顯示字串。
//
// 以前這段在二十幾個頁面各抄一份，寫法還不一致（有的四捨五入、有的留兩位小數），
// 集中到這裡只留一份，金額顯示全站才會一致。
//
// 規則：
// - TWD 維持「NT$ 1,234」的老樣子，不留小數（台灣客人最習慣這個寫法）。
// - 其他幣別交給瀏覽器內建的 Intl 處理，符號跟小數位都照那個幣別自己的規矩走——
//   例如日圓、韓元本來就沒有小數，不會再被硬塞「.00」；美金、歐元才會顯示兩位。
export function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  if (currency === "TWD") {
    return `NT$ ${Math.round(amount).toLocaleString("zh-TW")}`;
  }
  try {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // 遇到不認得的幣別代碼（資料怪怪的）就退回最陽春的「代碼 + 金額」，不讓整頁壞掉。
    return `${currency} ${amount.toFixed(2)}`;
  }
}
