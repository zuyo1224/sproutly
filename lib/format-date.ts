// 分日統計的 key、日期區間切點、CSV 檔名日期，全站一律走這支。
// 重點：用台灣時區切日界線。伺服器（Vercel）跑在 UTC，若直接 toISOString()
// 或拿 created_at 前 10 碼當 key，凌晨 0-8 點的單會被算進前一天，統計差一天。
//
// en-CA 的 toLocaleDateString 輸出剛好是 YYYY-MM-DD，最適合當 key / 檔名 / 拼
// `${key}T00:00:00+08:00` 算當天午夜。
export function taipeiDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}
