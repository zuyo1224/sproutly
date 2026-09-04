// 判斷一串字是不是正規 UUID（8-4-4-4-12、十六進位、不分大小寫）。
// 商品／訂單 id 在資料庫都是 uuid 欄位，把不是這個格式的字串丟進 .eq / .in 查詢，
// PostgREST 會整句回 22P02 錯誤，不是「這筆查不到」而是「整批都查不到」。
// 從客人瀏覽器 localStorage、網址查詢字串來的 id 先過這關再進資料庫。
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
