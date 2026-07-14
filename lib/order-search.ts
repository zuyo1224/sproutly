import { phoneDigits } from "./phone-match";
import { normalizeSearchText } from "./search-normalize";

// 後台訂單「用關鍵字搜姓名／電話／Email」單一來源。訂單列表頁與匯出 route 是同一份
// 訂單名單的兩個出口，兩邊都吃同一個搜尋字串 q，也都該用同一套「比對哪些欄位、怎麼
// 轉義」的規則。原本這段在兩處各抄一份逐字相同的：先把 q 裡的 ilike 萬用字元（% 和 _）
// 轉義——不轉的話客人打「50%」的 % 會被 PostgREST 當成「比對任意字串」的萬用符，搜出
// 一堆不相干的單——再組 customer_name／customer_phone／customer_email 三欄的 or ilike 查詢。
// 日後要多搜一個欄位（例如訂單編號）、或改轉義規則，得兩處同步；漏一處就變成「在列表
// 搜得到的單，按同一個關鍵字匯出時卻被濾掉」這種同一份名單兩個出口對不上。收成這支，
// 兩處吃同一條比對規則。跟 lib/customer-search 的 matchesCustomerSearch 用途不同：那邊是
// 客人名單「在記憶體裡逐筆比對」的述詞，這邊是訂單查詢「交給資料庫 ilike 過濾」，機制不同、
// 不合併。呼叫端自行決定何時走這條（兩處都是「q 非空且不含數字」才交給 DB ilike，
// 含數字的走下面 matchesOrderSearch 的記憶體比對）。
//
// 型別用 { or }: PostgREST 的 filter builder 每個方法都回傳自己（this），這裡只約束「有一個
// 吃 filter 字串、回傳同型 builder 的 or 方法」，就不必把 Supabase 那串泛型型別搬進來。
//
// 搜尋字串除了原文，再多一組「全形轉半形」（lib/search-normalize）的 needle 一起
// or 進去：商家用中文輸入法搜「ｄａｎｎｙ」，訂單存的姓名／Email 多半是半形，
// 原文 ilike 一律不中，明明單在列表裡卻搜不到——商品搜尋（c923c04）修過同一種病。
// 原文那組照舊保留，資料反過來存成全形、搜尋也打全形的情況不受影響。
// DB ilike 沒辦法正規化「存在資料庫那一邊」，全形存檔＋半形搜尋這個方向這裡救不了
// （記憶體比對的 matchesOrderSearch 兩邊都轉、救得了）；正規化在轉義之前做，
// 全形％＿轉出來的半形萬用字元照樣被轉義掉。
export function applyOrderSearch<T extends { or(filter: string): T }>(
  query: T,
  q: string,
): T {
  // 半形的 , ( ) 是 PostgREST or() 語法的保留字元，全形，（ ）轉出來會把整條
  // 查詢弄壞（原本查無資料、變成查詢錯誤），這種 needle 不加、只留原文那組。
  const norm = normalizeSearchText(q);
  const needles = [q];
  if (norm !== q && !/[,()]/.test(norm)) needles.push(norm);
  const conditions = needles.flatMap((n) => {
    const escaped = n.replace(/[%_]/g, (m) => `\\${m}`);
    return [
      `customer_name.ilike.%${escaped}%`,
      `customer_phone.ilike.%${escaped}%`,
      `customer_email.ilike.%${escaped}%`,
    ];
  });
  return query.or(conditions.join(","));
}

// 上面那支 DB ilike 是「逐字比對」：訂單存的電話是客人下單當下打的原文
// （0912-345-678、0912 345 678、+886912…、全形數字都有可能），商家搜
// 「0912345678」就一筆對不上，明明單在列表裡卻搜不到；客人頁「看訂單」帶的
// 也是分群後顯示的最近一筆原文電話，同一位客人另一種格式的單會被篩掉
// （客人頁看到 2 筆、點進來剩 1 筆）。
//
// 所以搜尋字串裡有數字時，兩個出口（列表頁、匯出 route）改用這支在記憶體逐筆比：
// 姓名 / Email / 電話原文的子字串照舊（跟 ilike 同義），再補一條「兩邊都轉純數字」
// 的比對（lib/phone-match 的 phoneDigits），格式怎麼打都找得到。純文字查詢
// （搜姓名、Email）維持走 DB ilike，行為與成本都不變。
// 跟 lib/customer-search 的 matchesCustomerSearch 是同一套精神，但欄位形狀不同
// （那邊吃分群後的客人、這邊吃訂單列），不合併。
// 子字串比對同樣改吃 lib/search-normalize 的口徑（兩邊都轉），全形半形怎麼打都中。
export function matchesOrderSearch(
  order: {
    customer_name: string | null;
    customer_phone: string | null;
    customer_email: string | null;
  },
  query: string,
): boolean {
  const needle = normalizeSearchText(query);
  const needleDigits = phoneDigits(query);
  return (
    normalizeSearchText(order.customer_name ?? "").includes(needle) ||
    normalizeSearchText(order.customer_phone ?? "").includes(needle) ||
    normalizeSearchText(order.customer_email ?? "").includes(needle) ||
    (needleDigits !== "" &&
      phoneDigits(order.customer_phone).includes(needleDigits))
  );
}
