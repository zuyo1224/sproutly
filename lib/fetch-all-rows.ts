// 通用的「一頁頁翻到撈齊為止」helper。
//
// Supabase 一次查詢最多回約 1000 列，任何「整家店 / 整個帳號一次 select」的
// 查詢在資料量超過之後都會默默少算（b21488f 的客人列表、7f9d6d0 的匯出品項
// 都是這個病）。這裡把「固定排序 + .range() 翻頁到不滿一頁為止」收成一支，
// 呼叫端只要提供「給我 from..to 這一頁」的查詢。
//
// 呼叫端務必在查詢裡下穩定排序（時間欄位 + id 之類的 tiebreaker），
// 不然每頁切點會浮動，翻頁可能漏列或重複。
const PAGE_SIZE = 1000;

export async function fetchAllRows<Row>(
  queryPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: Row[] | null }>
): Promise<Row[]> {
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await queryPage(from, from + PAGE_SIZE - 1);
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}
