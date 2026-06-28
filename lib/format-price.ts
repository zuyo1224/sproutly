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

// 把幣別代碼正規化成結構化資料（JSON-LD 的 priceCurrency）能用的乾淨值：
// 去空白、轉大寫，沒填（舊商品 null／空字串）就當台灣店退回 TWD——跟 formatPrice
// 顯示端同一條防呆線。原本 offers.priceCurrency 直接塞 product.currency，沒填的
// 商品會丟出 priceCurrency: null 給 Google，整段 offer 會被判無效。
export function currencyForSchema(currency?: string | null): string {
  return (currency ?? "").trim().toUpperCase() || "TWD";
}

// 後台「填價格的輸入框前綴」「CSV 金額欄表頭」要顯示的貨幣符號——TWD 顯示台灣客人
// 最習慣的「NT$」，其他幣別就顯示代碼本身（USD / JPY…）。這跟 formatPrice 顯示端不同：
// 那邊是「金額連符號一起格式化」，這邊只要「光一個前綴符號」貼在 input／表頭旁邊。
// 原本商品編輯頁與客人匯出各抄一份「currency === 'TWD' ? 'NT$' : currency」的條件，
// 收成同一份；正規化（去空白／轉大寫／沒填當 TWD）跟 currencyForSchema 同一條防呆線，
// 順手讓小寫「twd」或前後空白的髒資料也對得上 NT$。
export function currencySymbol(currency?: string | null): string {
  const code = currencyForSchema(currency);
  return code === "TWD" ? "NT$" : code;
}

// 給結構化資料（Product JSON-LD 的 offers.price）用的純數字價格字串——不帶貨幣
// 符號、不帶千分位（schema.org 的 price 只收純數值），但小數位數要跟著幣別走。
// 這是 formatPrice 顯示端那條「日圓／韓元不硬塞小數」防呆線在「餵給 Google」這端
// 的對應：原本 offers.price 寫死 .toFixed(2)，對日圓／韓元這種零小數幣別會丟出
// 「1200.00」這種它們根本不存在的小數金額。
export function priceForSchema(cents: number, currency?: string | null): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  const code = currencyForSchema(currency);
  // TWD 跟顯示端一致，四捨五入到整數、不留小數（台灣客人不用小數）。
  if (code === "TWD") return String(Math.round(amount));
  try {
    // 問 Intl 這個幣別自然的小數位數：日圓／韓元 0 位、美金／歐元 2 位。
    const digits =
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
      }).resolvedOptions().maximumFractionDigits ?? 2;
    return amount.toFixed(digits);
  } catch {
    // 不認得的幣別代碼退回兩位小數，跟 formatPrice 的退路同一個態度。
    return amount.toFixed(2);
  }
}

// 商品詳情頁與逛街頁 ItemList 的 schema.org Offer，共用同一組「跟價格綁在一起」的欄位：
// 幣別、純數字價格、價格有效期限、商品狀態（全新）。以前這幾欄是兩頁各抄一份，
// 逛街頁還漏抄了 priceValidUntil 與 itemCondition——這兩欄缺了 Search Console 會報
// 「缺少建議欄位」、rich result 也可能不顯示價格。集中成一份後兩頁保證一致、不再漏。
//
// - priceValidUntil：商家不設到期日，預設一年後，免得 Google 把價格當成過期的。
// - itemCondition：商品都是全新品（盆栽、家居用品），標明 NewCondition 補上建議欄位。
// availability（庫存）依各商品 stock 算，走 availability-schema.ts 那份共用，這裡不重複。
export function productOfferFieldsForSchema(cents: number, currency?: string | null) {
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return {
    priceCurrency: currencyForSchema(currency),
    price: priceForSchema(cents, currency),
    priceValidUntil,
    itemCondition: "https://schema.org/NewCondition",
  };
}
