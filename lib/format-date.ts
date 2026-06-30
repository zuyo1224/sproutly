// 分日統計的 key、日期區間切點、CSV 檔名日期，全站一律走這支。
// 重點：用台灣時區切日界線。伺服器（Vercel）跑在 UTC，若直接 toISOString()
// 或拿 created_at 前 10 碼當 key，凌晨 0-8 點的單會被算進前一天，統計差一天。
//
// en-CA 的 toLocaleDateString 輸出剛好是 YYYY-MM-DD，最適合當 key / 檔名 / 拼
// `${key}T00:00:00+08:00` 算當天午夜。
export function taipeiDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

// 以下是「給人看的」台灣時區時間戳，跟上面 key 用途不同（這些有 zh-TW 在地格式、
// 會出現在畫面與匯出 CSV）。同一種版面在多處各抄一份 toLocaleString options，
// 日後要改格式（例如年份要不要顯示）得逐處同步，漏一處兩邊就對不齊。各版面收成
// 一支：時區一律台灣，伺服器跑 UTC 也不會差一天。

// 後台列表用：月/日 時:分（不顯示年份，畫面省空間）。
// 用於店家首頁近期訂單、訂單列表（卡片與表格列）。
export function taipeiStampShort(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 後台日期用：年/月/日（純數字、不含時間）。
// 用於客人列表頁與客人匯出 CSV 的加入日期。
export function taipeiDateNumeric(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 客人端正式用：年 月（長名）日 時:分。
// 用於結帳成功頁與會員訂單詳情頁的下單時間。
export function taipeiStampLong(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 後台訂單詳情頁的下單／付款／出貨三個時間點：台灣時區的完整日期時間（年月日時分秒，
// 用瀏覽器 zh-TW 預設版面，不另指定欄位）。原本詳情頁自寫一份只帶 timeZone 的
// toLocaleString，收進這支跟其餘人看的時間戳同住一檔。
export function taipeiStampFull(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

// 訂單匯出 CSV 的下單時間：純數字「年/月/日 時:分」（年用 numeric、月日補零）。
// 跟 taipeiStampShort 差在多了年份、跟 taipeiStampLong 差在月份用數字不用長名——
// CSV 給人在試算表裡排序，純數字最好對齊。
export function taipeiStampNumeric(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 查訂單頁「這台裝置下過的單」捷徑列出的下單日期：月（長名）日，不含年份與時間
// （清單只是讓客人認出是哪一單，日期給個概念就好）。
export function taipeiDateMonthDay(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "long",
    day: "numeric",
  });
}

// 查訂單頁進度時間軸每個節點的時間：月（長名）日 時:分，不含年份
// （同一張單的進度都在近期，年份省略畫面更乾淨）。
export function taipeiStampMonthDay(iso: string): string {
  return new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 會員訂單列表的下單日期：年 月（長名）日，不含時間（會員可能翻很久以前的單，
// 年份要留；詳情頁才用到時:分，走 taipeiStampLong）。
export function taipeiDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// 訂單篩選「今天 / 本週 / 本月」的時間起點（含起、查 created_at >= since）。
// 一律以台灣午夜為界：今天=今天 0:00；本週=回推到本週一 0:00（週日算上一週的尾，
// 回推 6 天）；本月=當月 1 號 0:00。其餘（如「全部時間」）回 null 表不設下界。
// 訂單列表頁與匯出 route 原本各抄一份同形邏輯，收成這支；日後改週界定義只動一處。
export function taipeiRangeSince(key: string): Date | null {
  const todayKey = taipeiDateKey(new Date()); // YYYY-MM-DD（台灣的今天）
  const midnight = new Date(`${todayKey}T00:00:00+08:00`);
  if (key === "today") return midnight;
  if (key === "week") {
    const day = new Date(`${todayKey}T00:00:00Z`).getUTCDay(); // 台灣今天星期幾，0 = 週日
    const back = day === 0 ? 6 : day - 1; // 回到本週一
    return new Date(midnight.getTime() - back * 86_400_000);
  }
  if (key === "month") {
    return new Date(`${todayKey.slice(0, 8)}01T00:00:00+08:00`);
  }
  return null;
}
