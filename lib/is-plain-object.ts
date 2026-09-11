// 「這個值是不是一個能拿鍵去讀的物件」——jsonb 讀進來、AI 回的 patch、localStorage
// parse 出來的東西都先過這一關，過了才把它當 Record<string, unknown> 逐鍵 typeof 檢查。
//
// 陣列刻意不算：theme 裡的 sections／social／collections 這些格子存的是「鍵→值」，
// 舊資料或手改 DB 塞成陣列時，Object.entries 會把 0、1、2 這種索引當鍵收進去，
// 店面就多出一堆看不見來源的鍵；擋在這裡讓它跟「沒填」一樣回空物件。
// null 也不算（typeof null === "object" 是 JS 的老坑）。
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
