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
